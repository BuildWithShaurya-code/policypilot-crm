import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { AutomationService } from '@/lib/services/automation-service';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const automationSecret = process.env.AUTOMATION_SECRET_KEY;

    // Reject query parameter secrets
    const url = new URL(request.url);
    if (url.searchParams.has('key') || url.searchParams.has('secret')) {
      return NextResponse.json(
        { error: 'Unauthorized: Query parameter authentication is prohibited. Use Authorization: Bearer <token>' },
        { status: 401 }
      );
    }

    // 1. Check for Secret in Bearer Authorization header or x-automation-key
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const headerKey = request.headers.get('x-automation-key')?.trim();

    const isSecretAuthorized =
      Boolean(automationSecret) &&
      ((bearerToken && bearerToken === automationSecret) || (headerKey && headerKey === automationSecret));

    let authorizedUserId: string | null = null;
    let isAdminExecution = false;

    if (isSecretAuthorized) {
      isAdminExecution = true;
    } else {
      // 2. Fall back to Cookie-based User Session
      const ssrClient = createServerClient(supabaseUrl, publishableKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          },
        },
      });

      const {
        data: { user },
      } = await ssrClient.auth.getUser();

      if (user) {
        authorizedUserId = user.id;
      }
    }

    if (!isAdminExecution && !authorizedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid automation bearer token or authenticated broker session required' },
        { status: 401 }
      );
    }

    // Parse options from body if present
    interface DailySummaryRequestBody {
      force?: boolean;
      date?: string;
      owner_id?: string;
    }
    let body: DailySummaryRequestBody = {};
    try {
      body = (await request.json()) as DailySummaryRequestBody;
    } catch {
      // No JSON body
    }

    const force = Boolean(body?.force);
    const date = typeof body?.date === 'string' ? body.date : undefined;

    // Admin Client with Service Role (only used for server-side automation runner)
    const adminClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

    if (isAdminExecution) {
      if (adminClient) {
        // If specific owner_id provided, execute for that owner
        const targetOwnerId = body?.owner_id;
        if (targetOwnerId) {
          const result = await AutomationService.executeDailySummaryAutomation(
            targetOwnerId,
            { force, date },
            adminClient
          );
          return NextResponse.json({
            success: result.success,
            deliveryMode: result.deliveryMode,
            isSimulated: result.isSimulated,
            result,
          });
        }

        // Otherwise execute for all active brokers
        const { data: profiles, error: profErr } = await adminClient.from('profiles').select('id, email');
        if (profErr || !profiles) {
          return NextResponse.json({ error: profErr?.message || 'Failed to fetch profiles' }, { status: 500 });
        }

        const results = [];
        for (const p of profiles) {
          const res = await AutomationService.executeDailySummaryAutomation(
            p.id,
            { force, date },
            adminClient
          );
          results.push({ owner_id: p.id, email: p.email, ...res });
        }

        return NextResponse.json({ success: true, processedBrokersCount: results.length, results });
      } else {
        // Restricted environments retain simulated delivery without a demo login.
        return NextResponse.json({
          success: true,
          deliveryMode: 'simulated',
          isSimulated: true,
          message: 'Automation token verified. No active service role configured.',
        });
      }
    }

    // Authenticated broker session execution
    if (authorizedUserId) {
      const client = adminClient || undefined;
      const result = await AutomationService.executeDailySummaryAutomation(
        authorizedUserId,
        { force, date },
        client
      );
      return NextResponse.json({
        success: result.success,
        deliveryMode: result.deliveryMode,
        isSimulated: result.isSimulated,
        result,
      });
    }

    return NextResponse.json({ error: 'Invalid execution state' }, { status: 400 });
  } catch (err: unknown) {
    console.error('API /api/automation/daily-summary error:', err);
    return NextResponse.json({ error: 'Automation execution failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Reject query parameter secrets
  const url = new URL(request.url);
  if (url.searchParams.has('key') || url.searchParams.has('secret')) {
    return NextResponse.json(
      { error: 'Unauthorized: Query parameter authentication is prohibited. Use Authorization: Bearer <token>' },
      { status: 401 }
    );
  }

  // Forward to POST handler
  return POST(request);
}
