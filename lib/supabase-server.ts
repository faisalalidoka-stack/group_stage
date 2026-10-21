import { createClient } from "@supabase/supabase-js";

/**
 * Read-only client for server code (share cards, link-preview metadata).
 * It uses the public key and no session, so it can only see what the public
 * can already see, exactly like a signed-out visitor.
 */
export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
