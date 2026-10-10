import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import type { RenewalWorkflowStatus } from '@/types/database.types';
import { markPolicyRenewed } from '@/lib/services/policy-service';
import { derivePolicyStatus } from '@/lib/import/normalizer';

export async function OPTIONS() {
  return handleOptions();
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
    const stageInput = (body.stage || body.renewalStage || body.renewal_status || '').toLowerCase().replace(/\s+/g, '_');

    const VALID_STAGES: RenewalWorkflowStatus[] = [
      'new',
      'contacted',
      'interested',
      'quote_sent',
      'payment_pending',
      'renewed',
      'not_interested',
    ];

    if (!stageInput || !VALID_STAGES.includes(stageInput as RenewalWorkflowStatus)) {
      return errorResponse(`Stage is required and must be one of: ${VALID_STAGES.join(', ')}`, 400);
    }

    if (stageInput === 'renewed') {
      const result = await markPolicyRenewed(id, undefined, auth.supabase);
      if (result.error) return errorResponse(result.error, 400);
      return jsonResponse(result.data);
    }

    // 1. Fetch current policy
    const { data: currentPolicy, error: fetchErr } = await auth.supabase
      .from('policies')
      .select('*, customer:customers(name)')
      .eq('id', id)
      .single();

    if (fetchErr || !currentPolicy) {
      return errorResponse('Policy not found', 404);
    }

    const updatePayload: Record<string, unknown> = {
      renewal_status: stageInput,
      status: derivePolicyStatus(currentPolicy.expiry_date),
    };

    // If stage becomes renewed, also update status
    if (stageInput === 'renewed') {
      updatePayload.status = 'renewed';
    }

    const { data: updatedPolicy, error: updateErr } = await auth.supabase
      .from('policies')
      .update(updatePayload)
      .eq('id', id)
      .select('*, customer:customers(id, name, phone, email, status)')
      .single();

    if (updateErr) {
      return errorResponse(updateErr.message || 'Failed to update renewal stage', 400);
    }

    // Log activity
    await auth.supabase.from('activities').insert({
      owner_id: auth.user.id,
      customer_id: currentPolicy.customer_id,
      policy_id: id,
      type: 'renewal_status_updated',
      description: `Renewal stage updated to "${stageInput.replace(/_/g, ' ').toUpperCase()}" for policy ${currentPolicy.policy_number}`,
      metadata: {
        new_stage: stageInput,
        previous_stage: currentPolicy.renewal_status,
      },
    });

    return jsonResponse({
      ...updatedPolicy,
      renewal_stage: updatedPolicy.renewal_status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid request payload';
    return errorResponse(msg, 400);
  }
}
