-- Real bug, found via a real purchase: a 2-credit pack let 4 jobs go live
-- before the 5th was blocked (expected 1 free + 2 credits = 3). Root
-- cause: saveJob/setJobStatus decremented ad_credits_available by reading
-- the current value in application code, computing `old - 1` in JS, then
-- writing that *absolute* number guarded by a `WHERE ad_credits_available
-- > 0` that was already stale by the time the write landed. Two
-- near-simultaneous publishes (e.g. clicking publish on two drafts in
-- quick succession) can both read the same starting value and both
-- satisfy that guard, so both get marked published while the column only
-- ever reflects a single decrement — one extra job published per race,
-- not detected until credits run out one publish "too early" for what was
-- actually paid for.
--
-- Fix: a real atomic decrement, computed from the *live* column value
-- inside a single UPDATE statement — a second concurrent caller re-reads
-- the row IN the same statement, not a JS snapshot from moments earlier.
create or replace function public.decrement_ad_credit(target_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  update companies
  set ad_credits_available = ad_credits_available - 1
  where id = target_company_id and ad_credits_available > 0;
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- Called via the admin client from server-side job-publish code only —
-- authenticated grant kept for symmetry with how every other job-credit
-- RPC in this project is exposed, not because the client ever calls it
-- directly today.
grant execute on function public.decrement_ad_credit(uuid) to authenticated, service_role;
