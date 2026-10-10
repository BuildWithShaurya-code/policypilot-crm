import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSafeEnvStatus, validateClientEnv } from '@/lib/env';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const envValidation = validateClientEnv();
  const safeEnv = getSafeEnvStatus();

  const healthReport: {
    status: 'ok' | 'error';
    timestamp: string;
    environment: typeof safeEnv;
    database: {
      connected: boolean;
      tables: {
        profiles: boolean;
        customers: boolean;
        policies: boolean;
        follow_ups: boolean;
        activities: boolean;
        imports: boolean;
        import_errors: boolean;
      };
      error?: string;
    };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: safeEnv,
    database: {
      connected: false,
      tables: {
        profiles: false,
        customers: false,
        policies: false,
        follow_ups: false,
        activities: false,
        imports: false,
        import_errors: false,
      },
    },
  };

  if (!envValidation.isValid) {
    healthReport.status = 'error';
    return NextResponse.json(healthReport, { status: 500 });
  }

  try {
    const healthClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? getSupabaseAdminClient()
      : createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        );

    // Check all Phase 2 tables
    const [profiles, customers, policies, followUps, activities, imports, importErrors] =
      await Promise.all([
        healthClient.from('profiles').select('*', { count: 'exact', head: true }),
        healthClient.from('customers').select('*', { count: 'exact', head: true }),
        healthClient.from('policies').select('*', { count: 'exact', head: true }),
        healthClient.from('follow_ups').select('*', { count: 'exact', head: true }),
        healthClient.from('activities').select('*', { count: 'exact', head: true }),
        healthClient.from('imports').select('*', { count: 'exact', head: true }),
        healthClient.from('import_errors').select('*', { count: 'exact', head: true }),
      ]);

    healthReport.database.tables.profiles = !profiles.error;
    healthReport.database.tables.customers = !customers.error;
    healthReport.database.tables.policies = !policies.error;
    healthReport.database.tables.follow_ups = !followUps.error;
    healthReport.database.tables.activities = !activities.error;
    healthReport.database.tables.imports = !imports.error;
    healthReport.database.tables.import_errors = !importErrors.error;

    const allOk =
      !profiles.error &&
      !customers.error &&
      !policies.error &&
      !followUps.error &&
      !activities.error &&
      !imports.error &&
      !importErrors.error;

    if (allOk) {
      healthReport.database.connected = true;
    } else {
      healthReport.status = 'error';
      const firstError =
        profiles.error?.message ||
        customers.error?.message ||
        policies.error?.message ||
        followUps.error?.message ||
        activities.error?.message ||
        imports.error?.message ||
        importErrors.error?.message;
      healthReport.database.error = firstError;
    }
  } catch (err: unknown) {
    healthReport.status = 'error';
    healthReport.database.error = err instanceof Error ? err.message : 'Unknown database error';
  }

  const statusCode = healthReport.status === 'ok' ? 200 : 503;
  return NextResponse.json(healthReport, { status: statusCode });
}
