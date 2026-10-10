import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { isAccountAllowed } from './account-access';

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
  token?: string;
}

import { getAllowedOrigin, corsHeaders } from './cors';
export { getAllowedOrigin, corsHeaders };


export function jsonResponse(
  data: unknown,
  init: { status?: number; headers?: Record<string, string>; origin?: string | null } = {}
) {
  const status = init.status || 200;
  return NextResponse.json(data, {
    status,
    headers: {
      ...corsHeaders(init.origin),
      ...(init.headers || {}),
    },
  });
}

export function errorResponse(message: string, status = 400, details?: unknown, origin?: string | null) {
  return jsonResponse(
    {
      error: message,
      ...(details ? { details } : {}),
    },
    { status, origin }
  );
}

export function handleOptions(request?: NextRequest) {
  const origin = request?.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

/**
 * Extracts authenticated user context from request (Bearer token or cookies).
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  // 1. Try Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const client = createClient(supabaseUrl, publishableKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const { data: { user }, error } = await client.auth.getUser(token);
        if (user && !error && isAccountAllowed(user.email)) {
          return { user, supabase: client, token };
        }
      } catch (err) {
        console.warn('Bearer token authentication error:', err);
      }
    }
  }

  // 2. Try cookie-based session via SSR client
  try {
    const { createSupabaseServerClient } = await import('./supabase/server');
    const serverClient = await createSupabaseServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (user && isAccountAllowed(user.email)) {
      return { user, supabase: serverClient as unknown as SupabaseClient };
    }
  } catch (err) {
    console.warn('Cookie session authentication check error:', err);
  }

  return null;
}
