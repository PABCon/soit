import { createClient } from "@/lib/supabase/server";
import { SELECT, toJob, type JobRow } from "./jobs";
import type { Job } from "@/lib/types";

/** Toggles a candidate's own favorite on a job — insert if not already
 *  favorited, delete if it is. RLS-scoped to the caller's own candidate_id
 *  (favorites' "candidates manage their own favorites" policy); no admin
 *  client needed, this never touches another candidate's rows. */
export async function toggleFavorite(jobId: string): Promise<{ favorited: boolean }> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("favorites").delete().eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { favorited: false };
  }

  const { error } = await supabase.from("favorites").insert({ candidate_id: candidateId, job_id: jobId });
  if (error) throw new Error(error.message);
  return { favorited: true };
}

/** Just the ids — cheap, used to mark hearts filled/empty on a feed without
 *  joining full job rows for every card. Returns null (not an empty array)
 *  when the viewer isn't a candidate at all — that's the signal callers use
 *  to skip rendering the heart button entirely, rather than showing one
 *  that would just fail on click for an anonymous visitor. */
export async function getMyFavoriteJobIds(): Promise<string[] | null> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return null;

  const { data } = await supabase.from("favorites").select("job_id").eq("candidate_id", candidateId);
  return (data ?? []).map((r) => r.job_id);
}

export type FavoriteJob = Job & { favoritedAt: string };

/** Full job cards for the /favorites page. Reuses jobs.ts's own SELECT/
 *  toJob() — same join shape as getMyApplications — and stays visible even
 *  once a job is no longer live via the candidate_favorited_job() RLS
 *  policy, same guarantee getMyApplications already has for applications. */
export async function getMyFavoriteJobs(): Promise<FavoriteJob[]> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return [];

  const { data } = await supabase
    .from("favorites")
    .select(`created_at, jobs!inner ( ${SELECT} )`)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return (data as unknown as { created_at: string; jobs: JobRow }[]).map((row) => ({
    ...toJob(row.jobs),
    favoritedAt: row.created_at,
  }));
}
