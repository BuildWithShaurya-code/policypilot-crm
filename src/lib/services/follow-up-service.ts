import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { FollowUp, FollowUpReason, Customer, Policy } from '@/types/database.types';
import { sanitizeDatabaseError } from '@/lib/error-utils';

export interface EnrichedFollowUp extends FollowUp {
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'email'> | null;
  policy: Pick<Policy, 'id' | 'policy_number' | 'insurer' | 'policy_type'> | null;
  isOverdue: boolean;
}

export type FollowUpTab = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';

export interface FollowUpMetrics {
  todayCount: number;
  upcomingCount: number;
  completedCount: number;
  overdueCount: number;
  totalCount: number;
}

export interface CreateFollowUpPayload {
  customer_id: string;
  policy_id?: string | null;
  reason: FollowUpReason;
  scheduled_date: string;
  scheduled_time?: string | null;
  notes?: string | null;
}

export interface RescheduleFollowUpPayload {
  scheduled_date: string;
  scheduled_time?: string | null;
  notes?: string | null;
}

import { getTodayDateString, checkIsOverdue } from '@/lib/date-utils';
export { getTodayDateString, checkIsOverdue };

export class FollowUpService {
  /**
   * Fetches follow-ups with joined customer, policy, and dynamic overdue states
   */
  static async getFollowUps(options?: {
    tab?: FollowUpTab;
    customerId?: string;
    policyId?: string;
    search?: string;
    limit?: number;
  }): Promise<{ data: EnrichedFollowUp[]; metrics: FollowUpMetrics; error: string | null }> {
    const supabase = getSupabaseBrowserClient();

    try {
      let query = supabase
        .from('follow_ups')
        .select(`
          *,
          customer:customers(id, name, phone, email),
          policy:policies(id, policy_number, insurer, policy_type)
        `)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(options?.limit || 500);

      if (options?.customerId) {
        query = query.eq('customer_id', options.customerId);
      }

      if (options?.policyId) {
        query = query.eq('policy_id', options.policyId);
      }

      const { data: rawData, error } = await query;

      if (error) {
        return { data: [], metrics: this.emptyMetrics(), error: sanitizeDatabaseError(error) };
      }

      if (!rawData || rawData.length === 0) {
        return { data: [], metrics: this.emptyMetrics(), error: null };
      }

      const todayStr = getTodayDateString();

      let todayCount = 0;
      let upcomingCount = 0;
      let completedCount = 0;
      let overdueCount = 0;

      const enriched: EnrichedFollowUp[] = (rawData as unknown as EnrichedFollowUp[]).map((item) => {
        const isOverdue = checkIsOverdue(item.scheduled_date, item.scheduled_time, item.status);

        if (item.status === 'completed') {
          completedCount++;
        } else if (isOverdue) {
          overdueCount++;
        } else if (item.scheduled_date === todayStr) {
          todayCount++;
        } else if (item.scheduled_date > todayStr) {
          upcomingCount++;
        }

        return {
          ...item,
          isOverdue,
        };
      });

      const metrics: FollowUpMetrics = {
        todayCount,
        upcomingCount,
        completedCount,
        overdueCount,
        totalCount: enriched.length,
      };

      // Filter by tab
      const tab = options?.tab || 'all';
      let filtered = enriched.filter((f) => {
        if (tab === 'today') return f.status !== 'completed' && f.scheduled_date === todayStr && !f.isOverdue;
        if (tab === 'upcoming') return f.status !== 'completed' && f.scheduled_date > todayStr;
        if (tab === 'overdue') return f.status !== 'completed' && f.isOverdue;
        if (tab === 'completed') return f.status === 'completed';
        return true;
      });

      // Filter by search
      if (options?.search) {
        const term = options.search.trim().toLowerCase();
        filtered = filtered.filter(
          (f) =>
            f.customer?.name?.toLowerCase().includes(term) ||
            f.customer?.phone?.toLowerCase().includes(term) ||
            f.policy?.policy_number?.toLowerCase().includes(term) ||
            f.notes?.toLowerCase().includes(term) ||
            f.reason.toLowerCase().includes(term)
        );
      }

      return { data: filtered, metrics, error: null };
    } catch (err: unknown) {
      console.error('FollowUpService error:', err);
      return { data: [], metrics: this.emptyMetrics(), error: err instanceof Error ? err.message : 'Error fetching follow-ups' };
    }
  }

  /**
   * Creates a new follow-up and logs activity
   */
  static async createFollowUp(
    payload: CreateFollowUpPayload
  ): Promise<{ data: FollowUp | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('User not authenticated');

      // 1. Insert follow-up
      const { data: created, error: insertErr } = await supabase
        .from('follow_ups')
        .insert({
          owner_id: user.id,
          customer_id: payload.customer_id,
          policy_id: payload.policy_id || null,
          reason: payload.reason,
          scheduled_date: payload.scheduled_date,
          scheduled_time: payload.scheduled_time || null,
          notes: payload.notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (insertErr) {
        return { data: null, error: sanitizeDatabaseError(insertErr) };
      }

      // 2. Fetch customer name for audit
      const { data: cust } = await supabase
        .from('customers')
        .select('name')
        .eq('id', payload.customer_id)
        .single();

      // 3. Insert activity record
      await supabase.from('activities').insert({
        owner_id: user.id,
        customer_id: payload.customer_id,
        policy_id: payload.policy_id || null,
        type: 'follow_up_created',
        description: `Follow-up (${payload.reason}) scheduled for ${cust?.name || 'Customer'} on ${payload.scheduled_date}`,
        metadata: {
          follow_up_id: created.id,
          reason: payload.reason,
          scheduled_date: payload.scheduled_date,
          scheduled_time: payload.scheduled_time,
          notes: payload.notes,
        },
      });

      return { data: created, error: null };
    } catch (err: unknown) {
      return { data: null, error: sanitizeDatabaseError(err, 'Failed to create follow-up') };
    }
  }

  /**
   * Completes a follow-up, updating status and timestamp
   */
  static async completeFollowUp(
    id: string
  ): Promise<{ data: FollowUp | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('User not authenticated');

      const { data: current } = await supabase
        .from('follow_ups')
        .select('*, customer:customers(name)')
        .eq('id', id)
        .single();

      const { data: updated, error: updateErr } = await supabase
        .from('follow_ups')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) {
        return { data: null, error: sanitizeDatabaseError(updateErr) };
      }

      // Record activity
      if (current) {
        await supabase.from('activities').insert({
          owner_id: user.id,
          customer_id: current.customer_id,
          policy_id: current.policy_id,
          type: 'follow_up_completed',
          description: `Follow-up (${current.reason}) completed for ${current.customer?.name || 'Customer'}`,
          metadata: {
            follow_up_id: id,
            reason: current.reason,
          },
        });
      }

      return { data: updated, error: null };
    } catch (err: unknown) {
      return { data: null, error: sanitizeDatabaseError(err, 'Failed to complete follow-up') };
    }
  }

  /**
   * Reschedules an overdue or pending follow-up
   */
  static async rescheduleFollowUp(
    id: string,
    payload: RescheduleFollowUpPayload
  ): Promise<{ data: FollowUp | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('User not authenticated');

      const { data: current } = await supabase
        .from('follow_ups')
        .select('*, customer:customers(name)')
        .eq('id', id)
        .single();

      const { data: updated, error: updateErr } = await supabase
        .from('follow_ups')
        .update({
          scheduled_date: payload.scheduled_date,
          scheduled_time: payload.scheduled_time || null,
          notes: payload.notes !== undefined ? payload.notes : current?.notes,
          status: 'pending',
          completed_at: null,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) {
        return { data: null, error: sanitizeDatabaseError(updateErr) };
      }

      // Record activity
      if (current) {
        await supabase.from('activities').insert({
          owner_id: user.id,
          customer_id: current.customer_id,
          policy_id: current.policy_id,
          type: 'follow_up_rescheduled',
          description: `Follow-up rescheduled to ${payload.scheduled_date} for ${current.customer?.name || 'Customer'}`,
          metadata: {
            follow_up_id: id,
            previous_date: current.scheduled_date,
            new_date: payload.scheduled_date,
          },
        });
      }

      return { data: updated, error: null };
    } catch (err: unknown) {
      return { data: null, error: sanitizeDatabaseError(err, 'Failed to reschedule follow-up') };
    }
  }

  /**
   * Deletes a follow-up
   */
  static async deleteFollowUp(id: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    try {
      const { error } = await supabase.from('follow_ups').delete().eq('id', id);
      if (error) return { success: false, error: sanitizeDatabaseError(error) };
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: sanitizeDatabaseError(err, 'Failed to delete follow-up') };
    }
  }

  private static emptyMetrics(): FollowUpMetrics {
    return {
      todayCount: 0,
      upcomingCount: 0,
      completedCount: 0,
      overdueCount: 0,
      totalCount: 0,
    };
  }
}
