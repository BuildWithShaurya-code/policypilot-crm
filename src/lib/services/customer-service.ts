import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Customer, CustomerStatus, Policy, Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeDatabaseError } from '@/lib/error-utils';

export interface CustomerWithMetrics extends Customer {
  policies?: Pick<Policy, 'id' | 'premium' | 'expiry_date' | 'status'>[];
  policy_count: number;
  total_premium: number;
  next_renewal: string | null;
}

export interface CustomerFilters {
  search?: string;
  status?: CustomerStatus | 'all';
  page?: number;
  pageSize?: number;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: CustomerStatus;
  notes?: string | null;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: CustomerStatus;
  notes?: string | null;
}

/**
 * Fetch all customers for the authenticated user with aggregated policy counts & premiums.
 * Respects RLS implicitly.
 */
export async function getCustomers(
  filters: CustomerFilters = {},
  clientInstance?: SupabaseClient
): Promise<{ data: CustomerWithMetrics[]; count: number; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    let query = supabase
      .from('customers')
      .select('*, policies(id, premium, expiry_date, status)', { count: 'exact' });

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    // Apply search filter (name, phone, email)
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
    }

    // Ordering
    query = query.order('created_at', { ascending: false });

    // Pagination with safe maximum boundary
    if (filters.page && filters.pageSize) {
      const from = (filters.page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;
      query = query.range(from, to);
    } else {
      // Safe default guard limit (prevents unbounded memory consumption on large databases)
      query = query.range(0, 499);
    }

    const { data, count, error } = await query;

    if (error) {
      return { data: [], count: 0, error: sanitizeDatabaseError(error) };
    }

    // Compute derived metrics
    const customersWithMetrics: CustomerWithMetrics[] = (data || []).map((c) => {
      const policies = (c.policies as Pick<Policy, 'id' | 'premium' | 'expiry_date' | 'status'>[]) || [];
      const total_premium = policies.reduce((acc, p) => acc + (Number(p.premium) || 0), 0);

      // Find earliest future expiry date for next renewal
      const now = new Date().toISOString().split('T')[0];
      const futureExpiries = policies
        .map((p) => p.expiry_date)
        .filter((exp) => exp >= now)
        .sort();
      const next_renewal = futureExpiries.length > 0 ? futureExpiries[0] : (policies[0]?.expiry_date || null);

      return {
        ...c,
        policies,
        policy_count: policies.length,
        total_premium,
        next_renewal,
      };
    });

    return { data: customersWithMetrics, count: count ?? customersWithMetrics.length, error: null };
  } catch (err: unknown) {
    return { data: [], count: 0, error: sanitizeDatabaseError(err, 'Failed to retrieve customers') };
  }
}

/**
 * Get single customer by ID including all child policies and recent activities.
 */
export async function getCustomerById(
  id: string,
  clientInstance?: SupabaseClient
): Promise<{ data: (Customer & { policies: Policy[] }) | null; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from('customers')
      .select('*, policies(*)')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: sanitizeDatabaseError(error) };
    }

    return { data: data as Customer & { policies: Policy[] }, error: null };
  } catch (err: unknown) {
    return { data: null, error: sanitizeDatabaseError(err, 'Customer not found') };
  }
}

/**
 * Create a new customer and log a customer_created activity event.
 */
export async function createCustomer(
  input: CreateCustomerInput,
  clientInstance?: SupabaseClient
): Promise<{ data: Customer | null; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: null, error: 'User is not authenticated' };
    }

    // Input Validation
    if (!input.name || input.name.trim().length < 2) {
      return { data: null, error: 'Customer name must be at least 2 characters long' };
    }

    if (input.phone && input.phone.trim().length > 0 && input.phone.trim().length < 7) {
      return { data: null, error: 'Phone number must be at least 7 digits' };
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        owner_id: user.id,
        name: input.name.trim(),
        phone: input.phone ? input.phone.trim() : null,
        email: input.email ? input.email.trim() : null,
        address: input.address ? input.address.trim() : null,
        status: input.status || 'active',
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: sanitizeDatabaseError(error) };
    }

    // Log activity
    await supabase.from('activities').insert({
      owner_id: user.id,
      customer_id: data.id,
      type: 'customer_created',
      description: `New customer "${data.name}" added`,
      metadata: { customer_name: data.name, phone: data.phone },
    });

    return { data, error: null };
  } catch (err: unknown) {
    return { data: null, error: sanitizeDatabaseError(err, 'Failed to create customer') };
  }
}

/**
 * Update an existing customer.
 */
export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
  clientInstance?: SupabaseClient
): Promise<{ data: Customer | null; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    if (input.name && input.name.trim().length < 2) {
      return { data: null, error: 'Customer name must be at least 2 characters long' };
    }

    const updatePayload: Database['public']['Tables']['customers']['Update'] = {};
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.phone !== undefined) updatePayload.phone = input.phone ? input.phone.trim() : null;
    if (input.email !== undefined) updatePayload.email = input.email ? input.email.trim() : null;
    if (input.address !== undefined) updatePayload.address = input.address ? input.address.trim() : null;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() || null;

    const { data, error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: sanitizeDatabaseError(error) };
    }

    return { data, error: null };
  } catch (err: unknown) {
    return { data: null, error: sanitizeDatabaseError(err, 'Failed to update customer') };
  }
}

/**
 * Delete a customer (cascades to child policies via database FK).
 */
export async function deleteCustomer(
  id: string,
  clientInstance?: SupabaseClient
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = clientInstance || getSupabaseBrowserClient();

    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (error) {
      return { success: false, error: sanitizeDatabaseError(error) };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    return { success: false, error: sanitizeDatabaseError(err, 'Failed to delete customer') };
  }
}
