import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every comms hook writes here even though nothing consumes it yet (§12.2).
 * Server-side only — the events table has no grants for anon/authenticated
 * (§6.2), so this always goes through the admin client.
 */
export async function logEvent(
  type: string,
  payload: Record<string, unknown> = {},
  actorId?: string,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .insert({ type, payload, actor_id: actorId ?? null });
  if (error) console.error(`logEvent(${type}) failed:`, error.message);
}
