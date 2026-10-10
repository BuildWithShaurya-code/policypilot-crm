import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import { markPolicyRenewed } from '@/lib/services/policy-service';

export async function OPTIONS() { return handleOptions(); }

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(request);
  if (!auth) return errorResponse('Unauthorized: Please sign in', 401);
  const { id } = await context.params;
  try {
    const text = await request.text();
    const body = text ? JSON.parse(text) : {};
    if (body.newExpiryDate !== undefined && (typeof body.newExpiryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.newExpiryDate))) {
      return errorResponse('Expiry date must use YYYY-MM-DD', 400);
    }
    const result = await markPolicyRenewed(id, body.newExpiryDate, auth.supabase);
    if (result.error) return errorResponse(result.error, 400);
    return jsonResponse(result.data);
  } catch {
    return errorResponse('Invalid renewal request', 400);
  }
}
