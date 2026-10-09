"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Real-usage QA item: a thread only ever updated on a manual reload or
 * after sending your own reply — the other party's message just sat
 * there until you happened to refresh. Renders nothing; subscribes to
 * Postgres Changes on `messages` scoped to this thread (RLS already
 * restricts delivery to someone actually in the thread, the same
 * policies a plain `select` would enforce) and re-fetches the server
 * component on any insert — simplest correct option given the message
 * list is already server-rendered, not duplicated into client state.
 */
export function ThreadRealtimeRefresh({ threadId }: { threadId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, router]);

  return null;
}
