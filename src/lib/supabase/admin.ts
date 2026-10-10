import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Creates an admin Supabase client using the SUPABASE_SERVICE_ROLE_KEY.
 * STRICT SECURITY REQUIREMENT:
 * This client must NEVER be imported, called, or exposed in browser code.
 */
export function getSupabaseAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'CRITICAL SECURITY VIOLATION: Supabase Admin Client cannot be initialized or used in browser environment.'
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable for server-side privileged operations');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
