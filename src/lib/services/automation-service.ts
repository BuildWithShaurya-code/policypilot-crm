import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Policy, FollowUp, AutomationLog, NotificationPreferences } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getTodayDateString, formatDateInIndia, checkIsOverdue } from '@/lib/date-utils';

export interface DailySummaryData {
  executionDate: string;
  formattedDate: string;
  recipientEmail: string;
  renewalsToday: Policy[];
  renewalsNext7Days: Policy[];
  overdueRenewals: Policy[];
  todayFollowUps: FollowUp[];
  overdueFollowUps: FollowUp[];
  priorityActions: Array<{
    customerName: string;
    itemType: string;
    urgency: string;
    detail: string;
  }>;
  summaryMetrics: {
    renewalsTodayCount: number;
    renewalsNext7DaysCount: number;
    overdueRenewalsCount: number;
    todayFollowUpsCount: number;
    overdueFollowUpsCount: number;
    totalActionableRecords: number;
  };
  emailSubject: string;
  emailText: string;
  emailHtml: string;
}

export interface AutomationExecutionResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  logId?: string;
  data?: DailySummaryData;
  deliveryMode?: 'live_resend' | 'simulated';
  isSimulated?: boolean;
  error?: string | null;
}

/**
 * Format local date YYYY-MM-DD in Asia/Kolkata
 */
export function getLocalDateString(d?: Date, offsetDays = 0): string {
  if (offsetDays === 0 && !d) {
    return getTodayDateString();
  }
  const base = d ? new Date(d) : new Date();
  if (offsetDays !== 0) {
    base.setDate(base.getDate() + offsetDays);
  }
  return formatDateInIndia(base);
}

export class AutomationService {
  /**
   * Generates the daily summary payload from database records.
   * Does NOT send the email or write logs; pure deterministic computation.
   */
  static async generateDailySummary(
    ownerId: string,
    executionDateStr?: string,
    clientInstance?: SupabaseClient
  ): Promise<{ data: DailySummaryData | null; error: string | null }> {
    const supabase = clientInstance || getSupabaseBrowserClient();
    const todayStr = executionDateStr || getLocalDateString();

    try {
      // 1. Fetch Profile for recipient email and name
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ownerId)
        .single();

      if (profErr || !profile) {
        return { data: null, error: `Profile not found for owner ${ownerId}` };
      }

      const recipientEmail =
        profile.notification_preferences?.notification_email || profile.email || 'broker@policypilot.com';

      // 2. Fetch Policies for owner with joined customer (excluding renewed)
      const { data: policies, error: polErr } = await supabase
        .from('policies')
        .select('*, customer:customers(name, phone)')
        .eq('owner_id', ownerId)
        .neq('status', 'renewed')
        .neq('renewal_status', 'renewed');

      if (polErr) {
        return { data: null, error: `Error fetching policies: ${polErr.message}` };
      }

      // 3. Fetch Follow-ups for owner with joined customer
      const { data: followUps, error: fuErr } = await supabase
        .from('follow_ups')
        .select('*, customer:customers(name, phone), policy:policies(policy_number)')
        .eq('owner_id', ownerId)
        .eq('status', 'pending');

      if (fuErr) {
        return { data: null, error: `Error fetching follow-ups: ${fuErr.message}` };
      }

      const allPolicies = policies || [];
      const allFollowUps = followUps || [];

      // 4. Calculate Expiry Windows
      const next7DaysStr = getLocalDateString(new Date(todayStr), 7);
      const tomorrowStr = getLocalDateString(new Date(todayStr), 1);

      const renewalsToday: Policy[] = [];
      const renewalsNext7Days: Policy[] = [];
      const overdueRenewals: Policy[] = [];

      allPolicies.forEach((p) => {
        if (p.expiry_date === todayStr) {
          renewalsToday.push(p);
        } else if (p.expiry_date > todayStr && p.expiry_date <= next7DaysStr) {
          renewalsNext7Days.push(p);
        } else if (p.expiry_date < todayStr) {
          overdueRenewals.push(p);
        }
      });

      // 5. Calculate Follow-up Windows
      const todayFollowUps: FollowUp[] = [];
      const overdueFollowUps: FollowUp[] = [];

      allFollowUps.forEach((f) => {
        const isOverdue = checkIsOverdue(f.scheduled_date, f.scheduled_time, f.status);
        if (isOverdue) {
          overdueFollowUps.push(f);
        } else if (f.scheduled_date === todayStr) {
          todayFollowUps.push(f);
        }
      });

      // 6. Build Priority Actions List (Top critical items without sensitive customer data)
      const priorityActions: Array<{
        customerName: string;
        itemType: string;
        urgency: string;
        detail: string;
      }> = [];

      // Top today's renewals
      renewalsToday.slice(0, 3).forEach((p) => {
        const pWithCust = p as Policy & { customer?: { name?: string | null } | null };
        priorityActions.push({
          customerName: pWithCust.customer?.name || 'Customer',
          itemType: p.policy_type || 'Policy Renewal',
          urgency: 'Due Today',
          detail: `Policy #${p.policy_number} (₹${(p.premium || 0).toLocaleString('en-IN')})`,
        });
      });

      // Overdue follow-up callbacks
      overdueFollowUps.slice(0, 2).forEach((f) => {
        const fWithCust = f as FollowUp & { customer?: { name?: string | null } | null };
        priorityActions.push({
          customerName: fWithCust.customer?.name || 'Customer',
          itemType: `Follow-up Callback (${f.reason})`,
          urgency: 'Overdue Task',
          detail: f.notes ? `Note: ${f.notes}` : `Scheduled: ${f.scheduled_date}`,
        });
      });

      // Tomorrow's renewals
      allPolicies
        .filter((p) => p.expiry_date === tomorrowStr)
        .slice(0, 2)
        .forEach((p) => {
          const pWithCust = p as Policy & { customer?: { name?: string | null } | null };
          priorityActions.push({
            customerName: pWithCust.customer?.name || 'Customer',
            itemType: p.policy_type || 'Policy Renewal',
            urgency: 'Due Tomorrow',
            detail: `Policy #${p.policy_number}`,
          });
        });

      const summaryMetrics = {
        renewalsTodayCount: renewalsToday.length,
        renewalsNext7DaysCount: renewalsNext7Days.length,
        overdueRenewalsCount: overdueRenewals.length,
        todayFollowUpsCount: todayFollowUps.length,
        overdueFollowUpsCount: overdueFollowUps.length,
        totalActionableRecords:
          renewalsToday.length +
          renewalsNext7Days.length +
          overdueRenewals.length +
          todayFollowUps.length +
          overdueFollowUps.length,
      };

      const dateObj = new Date(todayStr);
      const formattedDate = dateObj.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const emailSubject = `PolicyPilot — Daily Insurance Summary (${formattedDate})`;

      // 7. Compose Plain Text Email Body
      let emailText = `Good morning.\n\nHere is today's insurance activity for ${formattedDate}:\n\n`;
      emailText += `Renewals Today: ${summaryMetrics.renewalsTodayCount}\n`;
      emailText += `Renewals Next 7 Days: ${summaryMetrics.renewalsNext7DaysCount}\n`;
      emailText += `Overdue Renewals: ${summaryMetrics.overdueRenewalsCount}\n\n`;
      emailText += `Today's Follow-ups: ${summaryMetrics.todayFollowUpsCount}\n`;
      emailText += `Overdue Follow-ups: ${summaryMetrics.overdueFollowUpsCount}\n\n`;

      if (priorityActions.length > 0) {
        emailText += `Priority Actions:\n`;
        priorityActions.forEach((item) => {
          emailText += `- ${item.customerName} — ${item.itemType} — ${item.urgency} (${item.detail})\n`;
        });
      } else {
        emailText += `Priority Actions: None pending for today.\n`;
      }
      emailText += `\nAccess your full Command Center: https://policypilot.app/dashboard\n\nPolicyPilot Automated Notifications`;

      // 8. Compose Responsive HTML Email Body
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <div style="border-bottom: 1px solid #374151; padding-bottom: 20px; margin-bottom: 24px;">
      <h1 style="font-size: 20px; color: #60a5fa; margin: 0; font-weight: 800;">PolicyPilot — Daily Insurance Summary</h1>
      <p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0 0;">Activity briefing for ${formattedDate}</p>
    </div>

    <p style="font-size: 15px; color: #d1d5db; line-height: 1.5;">Good morning. Here is what requires your attention today:</p>

    <!-- Metrics Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0;">
      <div style="background-color: #1f2937; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 700;">Renewals Today</div>
        <div style="font-size: 24px; font-weight: 800; color: #fbbf24; margin-top: 4px;">${summaryMetrics.renewalsTodayCount}</div>
      </div>
      <div style="background-color: #1f2937; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 700;">Next 7 Days</div>
        <div style="font-size: 24px; font-weight: 800; color: #60a5fa; margin-top: 4px;">${summaryMetrics.renewalsNext7DaysCount}</div>
      </div>
      <div style="background-color: #1f2937; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444;">
        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 700;">Overdue Renewals</div>
        <div style="font-size: 24px; font-weight: 800; color: #f87171; margin-top: 4px;">${summaryMetrics.overdueRenewalsCount}</div>
      </div>
      <div style="background-color: #1f2937; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 700;">Today's Follow-ups</div>
        <div style="font-size: 24px; font-weight: 800; color: #34d399; margin-top: 4px;">${summaryMetrics.todayFollowUpsCount}</div>
      </div>
    </div>

    <!-- Priority Actions -->
    <div style="margin-top: 28px;">
      <h3 style="font-size: 16px; color: #fff; margin: 0 0 12px 0;">Priority Actions</h3>
      ${
        priorityActions.length > 0
          ? priorityActions
              .map(
                (act) => `
        <div style="background-color: #1f2937; padding: 12px 16px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #fff; font-size: 14px;">${act.customerName}</strong>
            <span style="color: #9ca3af; font-size: 13px;"> — ${act.itemType} (${act.detail})</span>
          </div>
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: rgba(245,158,11,0.2); color: #fbbf24;">${act.urgency}</span>
        </div>`
              )
              .join('')
          : '<p style="color: #9ca3af; font-size: 14px;">No critical priority items pending today.</p>'
      }
    </div>

    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #374151; font-size: 12px; color: #6b7280; text-align: center;">
      This email was generated automatically by PolicyPilot Daily Engine.<br>
      You can manage your notification preferences in PolicyPilot Settings.
    </div>
  </div>
</body>
</html>
      `;

      return {
        data: {
          executionDate: todayStr,
          formattedDate,
          recipientEmail,
          renewalsToday,
          renewalsNext7Days,
          overdueRenewals,
          todayFollowUps,
          overdueFollowUps,
          priorityActions,
          summaryMetrics,
          emailSubject,
          emailText,
          emailHtml,
        },
        error: null,
      };
    } catch (err: unknown) {
      console.error('Error in generateDailySummary:', err);
      return { data: null, error: err instanceof Error ? err.message : 'Failed to generate summary' };
    }
  }

  /**
   * Executes the daily summary automation pipeline:
   * 1. Idempotency validation (prevents sending duplicate daily summaries).
   * 2. User preference check (skips if user disabled daily emails).
   * 3. Summary computation.
   * 4. Notification delivery.
   * 5. Audit logging in automation_logs.
   */
  static async executeDailySummaryAutomation(
    ownerId: string,
    options?: { force?: boolean; date?: string },
    clientInstance?: SupabaseClient
  ): Promise<AutomationExecutionResult> {
    const supabase = clientInstance || getSupabaseBrowserClient();
    const targetDate = options?.date || getLocalDateString();

    try {
      // 1. Idempotency check: see if daily_summary already executed today for this owner
      const { data: existingLog } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('automation_type', 'daily_summary')
        .eq('execution_date', targetDate)
        .maybeSingle();

      if (existingLog && existingLog.status === 'success' && !options?.force) {
        return {
          success: true,
          skipped: true,
          reason: `Daily summary for ${targetDate} has already been sent successfully.`,
          logId: existingLog.id,
        };
      }

      // 2. Fetch profile to check notification preferences
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ownerId)
        .single();

      if (profile && profile.notification_preferences?.daily_summary_email === false && !options?.force) {
        // Record skipped run in automation_logs
        await supabase.from('automation_logs').upsert(
          {
            owner_id: ownerId,
            automation_type: 'daily_summary',
            execution_date: targetDate,
            status: 'skipped',
            records_processed: 0,
            notification_sent: false,
            error_message: 'Skipped: user preference daily_summary_email is disabled',
            payload_summary: { reason: 'preference_disabled' },
          },
          { onConflict: 'owner_id,automation_type,execution_date' }
        );

        return {
          success: true,
          skipped: true,
          reason: 'Daily summary email skipped because user notification preference is disabled.',
        };
      }

      // 3. Generate Daily Summary Data
      const summaryRes = await this.generateDailySummary(ownerId, targetDate, supabase);
      if (summaryRes.error || !summaryRes.data) {
        throw new Error(summaryRes.error || 'Failed to compute daily summary');
      }

      const summaryData = summaryRes.data;

      // 4. Send Email Notification
      // Note: In development/without external API credentials, delivery is logged cleanly
      let deliverySuccessful = true;
      let deliveryError: string | null = null;
      // Check if external mail service configured (e.g. RESEND_API_KEY)
      const resendKey = process.env.RESEND_API_KEY;

      try {
        if (resendKey) {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: 'PolicyPilot Notifications <notifications@policypilot.app>',
              to: summaryData.recipientEmail,
              subject: summaryData.emailSubject,
              text: summaryData.emailText,
              html: summaryData.emailHtml,
            }),
          });
          if (!emailRes.ok) {
            const errBody = await emailRes.text();
            throw new Error(`Email provider error: ${errBody}`);
          }
        } else {
          // Standard simulated delivery: logs email payload for verification
          console.log(`[PolicyPilot Mail Delivery] Sent to ${summaryData.recipientEmail}: "${summaryData.emailSubject}"`);
        }
      } catch (sendErr: unknown) {
        deliverySuccessful = false;
        deliveryError = sendErr instanceof Error ? sendErr.message : 'Email delivery failed';
        console.error('Email delivery error in automation:', sendErr);
      }

      // 5. Record Log in automation_logs
      const logPayload = {
        owner_id: ownerId,
        automation_type: 'daily_summary' as const,
        execution_date: targetDate,
        status: deliverySuccessful ? ('success' as const) : ('failed' as const),
        records_processed: summaryData.summaryMetrics.totalActionableRecords,
        notification_sent: deliverySuccessful,
        error_message: deliveryError,
        payload_summary: {
          recipient: summaryData.recipientEmail,
          subject: summaryData.emailSubject,
          metrics: summaryData.summaryMetrics,
          priorityItemsCount: summaryData.priorityActions.length,
          delivery_mode: resendKey ? 'live_resend' : 'simulated',
          is_simulated: !Boolean(resendKey),
          simulated_note: resendKey ? undefined : 'No RESEND_API_KEY configured; delivery simulated',
        },
      };

      const { data: savedLog, error: logSaveErr } = await supabase
        .from('automation_logs')
        .upsert(logPayload, { onConflict: 'owner_id,automation_type,execution_date' })
        .select()
        .single();

      if (logSaveErr) {
        console.error('Error saving automation log:', logSaveErr);
      }

      if (!deliverySuccessful) {
        return {
          success: false,
          error: deliveryError,
          data: summaryData,
          deliveryMode: resendKey ? ('live_resend' as const) : ('simulated' as const),
          isSimulated: !Boolean(resendKey),
        };
      }

      return {
        success: true,
        logId: savedLog?.id,
        data: summaryData,
        deliveryMode: resendKey ? ('live_resend' as const) : ('simulated' as const),
        isSimulated: !Boolean(resendKey),
      };
    } catch (err: unknown) {
      console.error('Automation failure:', err);

      // Record failed run without modifying any business policy data
      try {
        await supabase.from('automation_logs').upsert(
          {
            owner_id: ownerId,
            automation_type: 'daily_summary',
            execution_date: targetDate,
            status: 'failed',
            records_processed: 0,
            notification_sent: false,
            error_message: err instanceof Error ? err.message : String(err),
          },
          { onConflict: 'owner_id,automation_type,execution_date' }
        );
      } catch (loggingErr) {
        console.error('Failed to log automation error:', loggingErr);
      }

      return {
        success: false,
        error: err instanceof Error ? err.message : 'Automation execution failed',
      };
    }
  }

  /**
   * Fetches recent automation logs for the owner
   */
  static async getAutomationLogs(
    ownerId?: string,
    clientInstance?: SupabaseClient
  ): Promise<{ data: AutomationLog[]; error: string | null }> {
    const supabase = clientInstance || getSupabaseBrowserClient();

    try {
      let query = supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      const { data, error } = await query;
      if (error) {
        return { data: [], error: error.message };
      }
      return { data: data || [], error: null };
    } catch (err: unknown) {
      return { data: [], error: err instanceof Error ? err.message : 'Failed to get logs' };
    }
  }

  /**
   * Updates notification preferences in profiles
   */
  static async updatePreferences(
    ownerId: string,
    preferences: NotificationPreferences,
    clientInstance?: SupabaseClient
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = clientInstance || getSupabaseBrowserClient();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_preferences: preferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ownerId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update preferences' };
    }
  }
}
