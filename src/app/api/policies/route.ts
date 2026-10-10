import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import { getPolicies, createPolicy, PolicyFilters, CreatePolicyInput } from '@/lib/services/policy-service';
import type { PolicyStatus } from '@/types/database.types';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const statusParam = searchParams.get('status');
  const status = statusParam === 'all' || !statusParam ? undefined : (statusParam.toLowerCase().replace(' ', '_') as PolicyStatus);
  const customerId = searchParams.get('customerId') || undefined;
  const insurer = searchParams.get('insurer') || undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
  const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined;

  const filters: PolicyFilters = { search, status, customerId, insurer, page, pageSize };
  const result = await getPolicies(filters, auth.supabase);

  if (result.error) {
    return errorResponse(result.error, 400);
  }

  return jsonResponse({
    data: result.data,
    count: result.count,
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  try {
    const body = await request.json();
    const rawStatus = (body.status || 'active').toLowerCase().trim().replace(/[\s-]+/g, '_');
    const validStatus = (rawStatus === 'expiring_soon' || rawStatus === 'due_soon') 
      ? 'expiring_soon' 
      : (['active', 'due_today', 'expired', 'renewed'].includes(rawStatus) ? rawStatus : 'active');

    const input: CreatePolicyInput = {
      customer_id: body.customerId || body.customer_id,
      policy_number: body.policyNumber || body.policy_number,
      insurer: body.insurer,
      policy_type: body.policyType || body.policy_type,
      premium: Number(body.premium),
      start_date: body.startDate || body.start_date || null,
      expiry_date: body.expiryDate || body.expiry_date,
      status: validStatus as PolicyStatus,
      notes: body.notes,
    };

    const result = await createPolicy(input, auth.supabase);
    if (result.error) {
      return errorResponse(result.error, 400);
    }

    return jsonResponse(result.data, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid request body';
    return errorResponse(msg, 400);
  }
}
