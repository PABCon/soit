import { createBrowserClient } from "@supabase/ssr";

/** Browser-side Supabase client. Only ever uses the anon key — RLS (§6) is the
 *  security boundary, never client-side filtering. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
