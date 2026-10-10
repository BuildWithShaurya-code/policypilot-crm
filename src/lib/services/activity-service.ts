import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Activity } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getActivities(
  options: { customerId?: string; policyId?: string; limit?: number } = {},
  clientInstance?: SupabaseClient
): Promise<{ data: Activity[]; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    let query = supabase.from('activities').select('*');

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }
    if (options.policyId) {
      query = query.eq('policy_id', options.policyId);
    }

    query = query.order('created_at', { ascending: false }).limit(options.limit || 50);

    const { data, error } = await query;

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve activities';
    return { data: [], error: message };
  }
}
