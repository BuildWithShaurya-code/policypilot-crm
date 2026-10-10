import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return errorResponse('This account is not enabled for this business. Contact the owner for access.', 403);
  return jsonResponse({ allowed: true });
}
