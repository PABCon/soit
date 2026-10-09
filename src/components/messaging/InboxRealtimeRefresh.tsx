"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Inbox-list counterpart to ThreadRealtimeRefresh — a new message updates
 * its thread's `last_message_at` (see messaging.ts's sendMessage), so
 * watching that UPDATE is enough to catch "a new message landed in one of
 * my threads" without needing a filter across every thread_id at once.
 * `filter` is the caller's own RLS-matching column (`candidate_id=eq.…`
 * or `company_id=eq.…`) — same scoping either side's own `message_threads`
 * policy already enforces, just expressed as a Realtime filter too.
 */
export function InboxRealtimeRefresh({ filter }: { filter: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`message_threads:${filter}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "message_threads", filter }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, router]);

  return null;
}
