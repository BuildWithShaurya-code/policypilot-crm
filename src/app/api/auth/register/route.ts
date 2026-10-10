import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAccountAllowed } from '@/lib/account-access';

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json();
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof fullName !== 'string' || !fullName.trim() || typeof password !== 'string') {
      return NextResponse.json({ error: 'A valid email, password, and full name are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }
    if (!isAccountAllowed(email)) {
      return NextResponse.json({ error: 'Registration is limited to approved business team members.' }, { status: 403 });
    }
    // Configuring a server key must never bypass mailbox confirmation.
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const { data, error } = await client.auth.signUp({ email: email.trim().toLowerCase(), password,
      options: { data: { full_name: fullName.trim() } } });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data.user) return NextResponse.json({ error: 'Failed to create user account' }, { status: 400 });
    return NextResponse.json({ success: true, requiresEmailConfirmation: !data.session,
      user: { id: data.user.id, email: data.user.email, fullName: data.user.user_metadata?.full_name } });
  } catch {
    return NextResponse.json({ error: 'Unable to register. Check your details and try again.' }, { status: 400 });
  }
}
