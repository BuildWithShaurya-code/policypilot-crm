import { NextRequest } from 'next/server';
import { getAuthContext, jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return errorResponse('Unauthorized: Please sign in', 401);
  }

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();

  return jsonResponse({
    user: {
      id: auth.user.id,
      email: auth.user.email,
      fullName: profile?.full_name || auth.user.user_metadata?.full_name || 'Broker',
    },
    profile,
  });
}
