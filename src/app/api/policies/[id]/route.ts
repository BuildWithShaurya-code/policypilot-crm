import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import { getPolicyById, updatePolicy, deletePolicy, UpdatePolicyInput } from '@/lib/services/policy-service';
import type { PolicyStatus } from '@/types/database.types';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { id } = await context.params;
  const result = await getPolicyById(id, auth.supabase);

  if (result.error || !result.data) {
    return errorResponse(result.error || 'Policy not found', 404);
  }

  return jsonResponse(result.data);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { id } = await context.params;
  try {
    const body = await request.json();
    let validStatus: PolicyStatus | undefined = undefined;
    if (body.status !== undefined) {
      const rawStatus = String(body.status).toLowerCase().trim().replace(/[\s-]+/g, '_');
      validStatus = (rawStatus === 'expiring_soon' || rawStatus === 'due_soon') 
        ? 'expiring_soon' 
        : (['active', 'due_today', 'expired', 'renewed'].includes(rawStatus) ? (rawStatus as PolicyStatus) : 'active');
    }

    const input: UpdatePolicyInput = {
      policy_number: body.policyNumber || body.policy_number,
      insurer: body.insurer,
      policy_type: body.policyType || body.policy_type,
      premium: body.premium !== undefined ? Number(body.premium) : undefined,
      start_date: body.startDate !== undefined ? body.startDate : body.start_date,
      expiry_date: body.expiryDate !== undefined ? body.expiryDate : body.expiry_date,
      status: validStatus,
      notes: body.notes,
    };

    const result = await updatePolicy(id, input, auth.supabase);
    if (result.error || !result.data) {
      return errorResponse(result.error || 'Failed to update policy', 400);
    }

    return jsonResponse(result.data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid request payload';
    return errorResponse(msg, 400);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { id } = await context.params;
  const result = await deletePolicy(id, auth.supabase);
  if (result.error || !result.success) {
    return errorResponse(result.error || 'Failed to delete policy', 400);
  }

  return jsonResponse({ success: true, message: 'Policy deleted successfully' });
}
