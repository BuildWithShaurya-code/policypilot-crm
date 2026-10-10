import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';

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
    const updatePayload: Record<string, unknown> = {};

    if (body.date || body.scheduled_date || body.scheduledDate) {
      updatePayload.scheduled_date = body.date || body.scheduled_date || body.scheduledDate;
    }
    if (body.time !== undefined || body.scheduled_time !== undefined || body.scheduledTime !== undefined) {
      updatePayload.scheduled_time = body.time || body.scheduled_time || body.scheduledTime;
    }
    if (body.notes !== undefined) {
      updatePayload.notes = body.notes;
    }
    if (body.reason !== undefined) {
      updatePayload.reason = body.reason.toLowerCase();
    }
    if (body.status !== undefined) {
      updatePayload.status = body.status.toLowerCase();
    }

    // When rescheduling, if not specified, ensure status returns to pending
    if (updatePayload.scheduled_date && !body.status) {
      updatePayload.status = 'pending';
    }

    const { data, error } = await auth.supabase
      .from('follow_ups')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        customer:customers(id, name, phone, email),
        policy:policies(id, policy_number, insurer, policy_type)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Follow-up not found', 404);
      }
      return errorResponse(error.message, 400);
    }

    return jsonResponse(data);
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
  const { error } = await auth.supabase.from('follow_ups').delete().eq('id', id);

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ success: true, message: 'Follow-up deleted successfully' });
}
