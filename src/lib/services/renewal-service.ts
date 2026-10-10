import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Policy, Customer, RenewalWorkflowStatus } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeDatabaseError } from '@/lib/error-utils';
import { markPolicyRenewed } from './policy-service';

export interface RenewalPolicy extends Policy {
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'email' | 'address' | 'status'> | null;
  daysRemaining: number;
  lastContact: {
    date: string | null;
    description: string;
  };
}

export type RenewalTab = 'today' | 'next_7_days' | 'next_30_days' | 'overdue' | 'renewed' | 'all';

export interface RenewalMetrics {
  todayCount: number;
  next7DaysCount: number;
  next30DaysCount: number;
  overdueCount: number;
  totalRenewedCount: number;
  todayPremium: number;
  next30DaysPremium: number;
  overduePremium: number;
}

import { getTodayDateString } from '@/lib/date-utils';

/**
 * Calculates days remaining from today to expiry_date in Asia/Kolkata calendar.
 */
export function calculateDaysRemaining(expiryDateStr: string): number {
  if (!expiryDateStr) return 0;
  const parts = expiryDateStr.split('T')[0].split('-');
  if (parts.length !== 3) return 0;

  const expYear = parseInt(parts[0], 10);
  const expMonth = parseInt(parts[1], 10) - 1;
  const expDay = parseInt(parts[2], 10);
  const expiry = new Date(expYear, expMonth, expDay, 0, 0, 0, 0);

  const todayParts = getTodayDateString().split('-');
  const todayYear = parseInt(todayParts[0], 10);
  const todayMonth = parseInt(todayParts[1], 10) - 1;
  const todayDay = parseInt(todayParts[2], 10);
  const today = new Date(todayYear, todayMonth, todayDay, 0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export class RenewalService {
  /**
   * Fetches renewal policies with calculated days remaining and recent customer activities
   */
  static async getRenewals(
    options?: {
      tab?: RenewalTab;
      search?: string;
    },
    clientInstance?: SupabaseClient
  ): Promise<{ data: RenewalPolicy[]; metrics: RenewalMetrics; error: string | null }> {
    const supabase = clientInstance || getSupabaseBrowserClient();

    try {
      // 1. Fetch all policies with joined customer details
      const query = supabase
        .from('policies')
        .select(`
          *,
          customer:customers(id, name, phone, email, address, status)
        `)
        .order('expiry_date', { ascending: true });

      const { data: rawPolicies, error: polError } = await query;

      if (polError) {
        console.error('Error fetching policies for renewals:', polError);
        return { data: [], metrics: this.emptyMetrics(), error: sanitizeDatabaseError(polError) };
      }

      if (!rawPolicies || rawPolicies.length === 0) {
        return { data: [], metrics: this.emptyMetrics(), error: null };
      }

      // 2. Fetch recent contact activities in bulk to compute Last Contact without N+1 queries
      const customerIds = Array.from(
        new Set(rawPolicies.map((p) => p.customer_id).filter(Boolean))
      );

      const { data: activities } = await supabase
        .from('activities')
        .select('customer_id, policy_id, type, description, created_at')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false });

      // Build map of latest activity per customer
      const lastContactMap = new Map<string, { date: string; description: string }>();
      (activities || []).forEach((act) => {
        if (act.customer_id && !lastContactMap.has(act.customer_id)) {
          lastContactMap.set(act.customer_id, {
            date: act.created_at,
            description: act.description || act.type,
          });
        }
      });

      // 3. Process policies and compute metrics dynamically
      let todayCount = 0;
      let next7DaysCount = 0;
      let next30DaysCount = 0;
      let overdueCount = 0;
      let totalRenewedCount = 0;
      let todayPremium = 0;
      let next30DaysPremium = 0;
      let overduePremium = 0;

      const enrichedPolicies: RenewalPolicy[] = (rawPolicies as unknown as RenewalPolicy[]).map((pol) => {
        const days = calculateDaysRemaining(pol.expiry_date);
        const contact = (pol.customer_id && lastContactMap.get(pol.customer_id)) || {
          date: null,
          description: 'Never',
        };

        const isRenewed = pol.status === 'renewed' || pol.renewal_status === 'renewed';

        if (isRenewed) {
          totalRenewedCount++;
        } else {
          if (days < 0) {
            overdueCount++;
            overduePremium += pol.premium || 0;
          } else if (days === 0) {
            todayCount++;
            todayPremium += pol.premium || 0;
            next7DaysCount++;
            next30DaysCount++;
            next30DaysPremium += pol.premium || 0;
          } else if (days > 0 && days <= 7) {
            next7DaysCount++;
            next30DaysCount++;
            next30DaysPremium += pol.premium || 0;
          } else if (days > 7 && days <= 30) {
            next30DaysCount++;
            next30DaysPremium += pol.premium || 0;
          }
        }

        return {
          ...pol,
          daysRemaining: days,
          lastContact: contact,
        };
      });

      const metrics: RenewalMetrics = {
        todayCount,
        next7DaysCount,
        next30DaysCount,
        overdueCount,
        totalRenewedCount,
        todayPremium,
        next30DaysPremium,
        overduePremium,
      };

      // 4. Apply Tab Filter
      const tab = options?.tab || 'all';
      let filtered = enrichedPolicies.filter((p) => {
        const isRenewed = p.status === 'renewed' || p.renewal_status === 'renewed';

        if (tab === 'renewed') {
          return isRenewed;
        }

        // Active renewal tabs exclude renewed policies
        if (isRenewed) return false;

        if (tab === 'today') return p.daysRemaining === 0;
        if (tab === 'next_7_days') return p.daysRemaining >= 0 && p.daysRemaining <= 7;
        if (tab === 'next_30_days') return p.daysRemaining >= 0 && p.daysRemaining <= 30;
        if (tab === 'overdue') return p.daysRemaining < 0;
        return true;
      });

      // 5. Apply Search filter
      if (options?.search) {
        const term = options.search.trim().toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.policy_number?.toLowerCase().includes(term) ||
            p.insurer?.toLowerCase().includes(term) ||
            p.customer?.name?.toLowerCase().includes(term) ||
            p.customer?.phone?.toLowerCase().includes(term)
        );
      }

      return { data: filtered, metrics, error: null };
    } catch (err: unknown) {
      console.error('RenewalService exception:', err);
      return { data: [], metrics: this.emptyMetrics(), error: err instanceof Error ? err.message : 'Error processing renewals' };
    }
  }

  /**
   * Marks a policy as renewed in the database, updates workflow status, and logs audit activity
   */
  static async markRenewed(
    policyId: string,
    clientInstance?: SupabaseClient
  ): Promise<{ data: Policy | null; error: string | null }> {
    return markPolicyRenewed(policyId, undefined, clientInstance);
  }

  /**
   * Updates renewal workflow status (new, contacted, interested, quote_sent, payment_pending, etc.)
   */
  static async updateRenewalStatus(
    policyId: string,
    newStatus: RenewalWorkflowStatus,
    clientInstance?: SupabaseClient
  ): Promise<{ data: Policy | null; error: string | null }> {
    const supabase = clientInstance || getSupabaseBrowserClient();

    if (newStatus === 'renewed') return markPolicyRenewed(policyId, undefined, supabase);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('User not authenticated');

      // Fetch policy for activity metadata
      const { data: currentPol } = await supabase
        .from('policies')
        .select('*, customer:customers(name)')
        .eq('id', policyId)
        .single();

      // If status is renewed, also synchronize policy status
      const updatePayload: Partial<Policy> = {
        renewal_status: newStatus,
      };

      const { data: updated, error: updateErr } = await supabase
        .from('policies')
        .update(updatePayload)
        .eq('id', policyId)
        .select()
        .single();

      if (updateErr) {
        return { data: null, error: sanitizeDatabaseError(updateErr) };
      }

      // Record activity
      if (currentPol) {
        await supabase.from('activities').insert({
          owner_id: user.id,
          customer_id: currentPol.customer_id,
          policy_id: policyId,
          type: 'renewal_status_updated',
          description: `Renewal status changed to "${newStatus.replace('_', ' ').toUpperCase()}" for policy ${currentPol.policy_number}`,
          metadata: {
            new_status: newStatus,
            previous_status: currentPol.renewal_status,
          },
        });
      }

      return { data: updated, error: null };
    } catch (err: unknown) {
      return { data: null, error: sanitizeDatabaseError(err, 'Error updating renewal workflow status') };
    }
  }

  private static emptyMetrics(): RenewalMetrics {
    return {
      todayCount: 0,
      next7DaysCount: 0,
      next30DaysCount: 0,
      overdueCount: 0,
      totalRenewedCount: 0,
      todayPremium: 0,
      next30DaysPremium: 0,
      overduePremium: 0,
    };
  }
}
