import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { corsHeaders } from '@/lib/cors';
import { isAccountAllowed } from '@/lib/account-access';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Handle CORS for /api routes
  if (pathname.startsWith('/api')) {
    const origin = request.headers.get('origin');
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers,
      });
    }

    Object.entries(headers).forEach(([key, val]) => {
      supabaseResponse.headers.set(key, val);
    });
  }

  // Protected route checking
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/policies') ||
    pathname.startsWith('/import') ||
    pathname.startsWith('/renewals') ||
    pathname.startsWith('/follow-ups') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings');
  const isAuthRoute = pathname === '/login' || pathname === '/signup';

  if (user && !isAccountAllowed(user.email) && (isProtectedRoute || isAuthRoute)) {
    return NextResponse.json({ error: 'This account is not enabled for this business. Contact the owner for access.' }, { status: 403 });
  }

  if (!user && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
