import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import type { FollowUpTab } from '@/lib/services/follow-up-service';
import { getTodayDateString, checkIsOverdue } from '@/lib/date-utils';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get('tab') as FollowUpTab) || 'all';
  const customerId = searchParams.get('customerId') || undefined;
  const policyId = searchParams.get('policyId') || undefined;
  const search = searchParams.get('search') || undefined;

  try {
    let query = auth.supabase
      .from('follow_ups')
      .select(`
        *,
        customer:customers(id, name, phone, email),
        policy:policies(id, policy_number, insurer, policy_type)
      `)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (customerId) query = query.eq('customer_id', customerId);
    if (policyId) query = query.eq('policy_id', policyId);

    const { data, error } = await query;
    if (error) {
      return errorResponse(error.message, 400);
    }

    const todayStr = getTodayDateString();

    interface FollowUpWithRelations {
      id: string;
      owner_id: string;
      customer_id: string;
      policy_id: string | null;
      reason: string;
      scheduled_date: string;
      scheduled_time: string | null;
      notes: string | null;
      status: string;
      created_at: string;
      customer?: { id: string; name: string; phone: string | null; email: string | null } | null;
      policy?: { id: string; policy_number: string; insurer: string; policy_type: string } | null;
    }

    // Enrich and compute dynamic overdue flags using canonical rule
    const enriched = ((data || []) as unknown as FollowUpWithRelations[]).map((fu) => {
      const isOverdue = checkIsOverdue(
        fu.scheduled_date,
        fu.scheduled_time,
        fu.status
      );
      return {
        ...fu,
        isOverdue,
      };
    });

    let filtered = enriched;
    if (tab === 'today') {
      filtered = enriched.filter((f) => f.scheduled_date === todayStr && f.status !== 'completed' && !f.isOverdue);
    } else if (tab === 'upcoming') {
      filtered = enriched.filter((f) => f.scheduled_date > todayStr && f.status !== 'completed');
    } else if (tab === 'overdue') {
      filtered = enriched.filter((f) => f.isOverdue);
    } else if (tab === 'completed') {
      filtered = enriched.filter((f) => f.status === 'completed');
    }

    if (search && search.trim()) {
      const s = search.toLowerCase().trim();
      filtered = filtered.filter(
        (f) =>
          f.customer?.name?.toLowerCase().includes(s) ||
          f.customer?.phone?.includes(s) ||
          f.policy?.policy_number?.toLowerCase().includes(s) ||
          f.notes?.toLowerCase().includes(s)
      );
    }

    const metrics = {
      todayCount: enriched.filter((f) => f.scheduled_date === todayStr && f.status !== 'completed').length,
      upcomingCount: enriched.filter((f) => f.scheduled_date > todayStr && f.status !== 'completed').length,
      completedCount: enriched.filter((f) => f.status === 'completed').length,
      overdueCount: enriched.filter((f) => f.isOverdue).length,
      totalCount: enriched.length,
    };

    return jsonResponse({
      data: filtered,
      metrics,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch follow-ups';
    return errorResponse(msg, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  try {
    const body = await request.json();
    const customerId = body.customerId || body.customer_id;
    const policyId = body.policyId || body.policy_id || null;
    const scheduledDate = body.date || body.scheduled_date || body.scheduledDate;
    const rawReason = (body.reason || 'renewal').toLowerCase().trim();
    const validReasons = ['renewal', 'quote', 'payment', 'document', 'callback', 'other'];
    let reason = 'renewal';
    if (validReasons.includes(rawReason)) {
      reason = rawReason;
    } else if (rawReason.includes('renew')) {
      reason = 'renewal';
    } else if (rawReason.includes('quot')) {
      reason = 'quote';
    } else if (rawReason.includes('pay')) {
      reason = 'payment';
    } else if (rawReason.includes('doc')) {
      reason = 'document';
    } else if (rawReason.includes('call')) {
      reason = 'callback';
    } else {
      reason = 'other';
    }
    const scheduledTime = body.time || body.scheduled_time || body.scheduledTime || null;
    const notes = body.notes || null;

    if (!customerId) return errorResponse('Customer is required', 400);
    if (!scheduledDate) return errorResponse('Scheduled date is required', 400);

    const { data: customer } = await auth.supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    const { data, error } = await auth.supabase
      .from('follow_ups')
      .insert({
        owner_id: auth.user.id,
        customer_id: customerId,
        policy_id: policyId,
        reason,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        notes,
        status: 'pending',
      })
      .select(`
        *,
        customer:customers(id, name, phone, email),
        policy:policies(id, policy_number, insurer, policy_type)
      `)
      .single();

    if (error) {
      return errorResponse(error.message, 400);
    }

    // Log activity
    await auth.supabase.from('activities').insert({
      owner_id: auth.user.id,
      customer_id: customerId,
      policy_id: policyId,
      type: 'followup',
      description: `Follow-up scheduled for ${customer?.name || 'client'} on ${scheduledDate} (${reason})`,
      metadata: {
        reason,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
      },
    });

    return jsonResponse(data, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid request payload';
    return errorResponse(msg, 400);
  }
}
