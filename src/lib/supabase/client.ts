import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Returns a singleton Supabase browser client for use in client components and hooks.
 * Validates environment variables safely before creating the client.
 */
export function getSupabaseBrowserClient() {
  if (clientInstance) {
    return clientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-publishable-key';

  clientInstance = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
  return clientInstance;
}
