import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Customer, Policy, PolicyStatus, Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeDatabaseError } from '@/lib/error-utils';

export interface PolicyWithCustomer extends Policy {
  customer?: Pick<Customer, 'id' | 'name' | 'phone' | 'email' | 'status'> | null;
}

export interface PolicyFilters {
  search?: string;
  status?: PolicyStatus | 'all';
  customerId?: string;
  insurer?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatePolicyInput {
  customer_id: string;
  policy_number: string;
  insurer: string;
  policy_type: string;
  premium: number;
  start_date?: string | null;
  expiry_date: string;
  status?: PolicyStatus;
  notes?: string | null;
}

export interface UpdatePolicyInput {
  policy_number?: string;
  insurer?: string;
  policy_type?: string;
  premium?: number;
  start_date?: string | null;
  expiry_date?: string;
  status?: PolicyStatus;
  notes?: string | null;
}

/**
 * Fetch policies for the authenticated user, joined with associated customer information.
 */
export async function getPolicies(
  filters: PolicyFilters = {},
  clientInstance?: SupabaseClient
): Promise<{ data: PolicyWithCustomer[]; count: number; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    let query = supabase
      .from('policies')
      .select('*, customer:customers(id, name, phone, email, status)', { count: 'exact' });

    // Status filter
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    // Customer filter
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    // Insurer filter
    if (filters.insurer) {
      query = query.eq('insurer', filters.insurer);
    }

    // Search filter (policy_number, insurer, policy_type)
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      query = query.or(`policy_number.ilike.%${term}%,insurer.ilike.%${term}%,policy_type.ilike.%${term}%`);
    }

    // Order by expiry date ascending (renewals priority)
    query = query.order('expiry_date', { ascending: true });

    // Pagination
    if (filters.page && filters.pageSize) {
      const from = (filters.page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;
      query = query.range(from, to);
    } else {
      // Safe default guard limit
      query = query.range(0, 499);
    }

    const { data, count, error } = await query;

    if (error) {
      return { data: [], count: 0, error: sanitizeDatabaseError(error) };
    }

    return {
      data: (data || []) as unknown as PolicyWithCustomer[],
      count: count || (data?.length ?? 0),
      error: null,
    };
  } catch (err: unknown) {
    return { data: [], count: 0, error: sanitizeDatabaseError(err, 'Failed to retrieve policies') };
  }
}

/**
 * Get single policy by ID with customer profile.
 */
export async function getPolicyById(
  id: string,
  clientInstance?: SupabaseClient
): Promise<{ data: PolicyWithCustomer | null; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from('policies')
      .select('*, customer:customers(*)')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as unknown as PolicyWithCustomer, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Policy not found';
    return { data: null, error: message };
  }
}

/**
 * Create a new policy under an existing customer.
 */
export async function createPolicy(
  input: CreatePolicyInput,
  clientInstance?: SupabaseClient
): Promise<{ data: Policy | null; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: null, error: 'User is not authenticated' };
    }

    // Validation
    if (!input.customer_id) {
      return { data: null, error: 'Customer selection is required' };
    }
    if (!input.policy_number || input.policy_number.trim() === '') {
      return { data: null, error: 'Policy number is required' };
    }
    if (!input.insurer || input.insurer.trim() === '') {
      return { data: null, error: 'Insurance company is required' };
    }
    if (!input.policy_type || input.policy_type.trim() === '') {
      return { data: null, error: 'Policy type is required' };
    }
    if (input.premium === undefined || Number(input.premium) < 0) {
      return { data: null, error: 'Premium cannot be negative' };
    }
    if (!input.expiry_date) {
      return { data: null, error: 'Expiry date is required' };
    }
    if (input.start_date && input.start_date > input.expiry_date) {
      return { data: null, error: 'Start date cannot be after expiry date' };
    }

    const { data, error } = await supabase
      .from('policies')
      .insert({
        owner_id: user.id,
        customer_id: input.customer_id,
        policy_number: input.policy_number.trim(),
        insurer: input.insurer.trim(),
        policy_type: input.policy_type.trim(),
        premium: Number(input.premium),
        start_date: input.start_date || null,
        expiry_date: input.expiry_date,
        status: input.status || 'active',
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: sanitizeDatabaseError(error) };
    }

    // Log policy_created activity
    await supabase.from('activities').insert({
      owner_id: user.id,
      customer_id: input.customer_id,
      policy_id: data.id,
      type: 'policy_created',
      description: `New ${data.policy_type} policy ${data.policy_number} (${data.insurer}) added. Premium: ₹${Number(data.premium).toLocaleString('en-IN')}`,
      metadata: {
        policy_number: data.policy_number,
        insurer: data.insurer,
        premium: data.premium,
        expiry_date: data.expiry_date,
      },
    });

    return { data, error: null };
  } catch (err: unknown) {
    return { data: null, error: sanitizeDatabaseError(err, 'Failed to create policy') };
  }
}

/**
 * Update an existing policy.
 */
export async function updatePolicy(
  id: string,
  input: UpdatePolicyInput,
  clientInstance?: SupabaseClient
): Promise<{ data: Policy | null; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    if (input.premium !== undefined && Number(input.premium) < 0) {
      return { data: null, error: 'Premium cannot be negative' };
    }
    if (input.start_date && input.expiry_date && input.start_date > input.expiry_date) {
      return { data: null, error: 'Start date cannot be after expiry date' };
    }

    const updatePayload: Database['public']['Tables']['policies']['Update'] = {};
    if (input.policy_number !== undefined) updatePayload.policy_number = input.policy_number.trim();
    if (input.insurer !== undefined) updatePayload.insurer = input.insurer.trim();
    if (input.policy_type !== undefined) updatePayload.policy_type = input.policy_type.trim();
    if (input.premium !== undefined) updatePayload.premium = Number(input.premium);
    if (input.start_date !== undefined) updatePayload.start_date = input.start_date || null;
    if (input.expiry_date !== undefined) updatePayload.expiry_date = input.expiry_date;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() || null;

    const { data, error } = await supabase
      .from('policies')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: sanitizeDatabaseError(error) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    return { data: null, error: sanitizeDatabaseError(err, 'Failed to update policy') };
  }
}

/**
 * Mark policy as renewed.
 */
export async function markPolicyRenewed(
  id: string,
  newExpiryDate?: string,
  clientInstance?: SupabaseClient
): Promise<{ data: PolicyWithCustomer | null; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();
    // The database function locks the policy and commits all renewal changes together.
    const { data, error } = await supabase.rpc('renew_policy', {
      policy_id_input: id,
      new_expiry_input: newExpiryDate || null,
    });
    if (error) return { data: null, error: sanitizeDatabaseError(error) };
    return { data: data as unknown as PolicyWithCustomer, error: null };
  } catch (err: unknown) {
    return { data: null, error: sanitizeDatabaseError(err, 'Failed to renew policy') };
  }
}

/**
 * Delete a policy.
 */
export async function deletePolicy(
  id: string,
  clientInstance?: SupabaseClient
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    const { error } = await supabase.from('policies').delete().eq('id', id);

    if (error) {
      return { success: false, error: sanitizeDatabaseError(error) };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    return { success: false, error: sanitizeDatabaseError(err, 'Failed to delete policy') };
  }
}

/**
 * Fetch policies for a specific customer.
 */
export async function getPoliciesByCustomerId(
  customerId: string,
  clientInstance?: SupabaseClient
): Promise<{ data: PolicyWithCustomer[]; error: string | null }> {
  const res = await getPolicies({ customerId }, clientInstance);
  return { data: res.data, error: res.error };
}
