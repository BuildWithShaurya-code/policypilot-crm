import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import { getActivities } from '@/lib/services/activity-service';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId') || undefined;
  const policyId = searchParams.get('policyId') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

  const result = await getActivities({ customerId, policyId, limit }, auth.supabase);
  if (result.error) {
    return errorResponse(result.error, 400);
  }

  return jsonResponse(result.data);
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
    const type = body.type || 'contact';
    const description = body.description || '';
    const metadata = body.metadata || {};

    if (!description) {
      return errorResponse('Description is required', 400);
    }

    const { data, error } = await auth.supabase
      .from('activities')
      .insert({
        owner_id: auth.user.id,
        customer_id: customerId || null,
        policy_id: policyId,
        type,
        description,
        metadata,
      })
      .select()
      .single();

    if (error) {
      return errorResponse(error.message, 400);
    }

    return jsonResponse(data, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid request payload';
    return errorResponse(msg, 400);
  }
}
