import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse, handleOptions } from '@/lib/api-auth';
import { isAccountAllowed } from '@/lib/account-access';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return errorResponse('Email and password are required', 400);
    }

    if (!isAccountAllowed(email)) return errorResponse('This account is not enabled for this business.', 403);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    const supabase = createClient(supabaseUrl, publishableKey);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.session) {
      return errorResponse(error?.message || 'Invalid email or password', 401);
    }

    // Fetch user profile using authenticated user context
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      },
    });
    const { data: profile } = await userClient
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    return jsonResponse({
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: profile?.full_name || data.user.user_metadata?.full_name || 'Broker',
      },
      profile,
      token: data.session.access_token,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return errorResponse(message, 500);
  }
}
