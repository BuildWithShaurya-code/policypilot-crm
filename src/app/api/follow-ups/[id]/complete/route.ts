import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { id } = await context.params;

  try {
    const { data: currentFollowUp, error: fetchErr } = await auth.supabase
      .from('follow_ups')
      .select('*, customer:customers(name)')
      .eq('id', id)
      .single();

    if (fetchErr || !currentFollowUp) {
      return errorResponse('Follow-up not found', 404);
    }

    const { data, error } = await auth.supabase
      .from('follow_ups')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        customer:customers(id, name, phone, email),
        policy:policies(id, policy_number, insurer, policy_type)
      `)
      .single();

    if (error) {
      return errorResponse(error.message, 400);
    }

    // Log completion activity
    await auth.supabase.from('activities').insert({
      owner_id: auth.user.id,
      customer_id: currentFollowUp.customer_id,
      policy_id: currentFollowUp.policy_id,
      type: 'followup',
      description: `Follow-up for ${currentFollowUp.customer?.name || 'client'} marked as completed`,
      metadata: {
        follow_up_id: id,
        reason: currentFollowUp.reason,
        completed_at: new Date().toISOString(),
      },
    });

    return jsonResponse(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to complete follow-up';
    return errorResponse(msg, 500);
  }
}
