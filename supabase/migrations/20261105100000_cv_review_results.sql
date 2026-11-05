-- CV Quality Score / Review (growth plan, Track C): "upload your CV, get a
-- score instantly, create a free account to see the full breakdown" —
-- mirrors company_claim_invites' own shape and reasoning almost exactly,
-- just for an anonymous *candidate* action instead of an operator-driven
-- company outreach. A review is created with no `candidate_id` at all (the
-- uploader isn't authenticated yet — that's the whole point of the growth
-- loop), then "claimed" by a real candidate account via the same
-- unguessable-token pattern once they register, same `next=` redirect
-- mechanism AuthForm already uses for every other post-auth destination.
--
-- Deliberately admin-client-only throughout, same posture as
-- company_claim_invites: no authenticated owner exists before claiming,
-- and keeping the post-claim read path on the admin client too (rather
-- than adding a second, candidate-owned RLS policy) is simpler and
-- consistent with how this project already treats admin-client-scoped-in-
-- code reads for applications/messaging/candidate-matches.

create table cv_review_results (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  candidate_id  uuid references candidates(id) on delete cascade,
  overall_score int not null check (overall_score between 0 and 100),
  result        jsonb not null,
  cv_text       text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  claimed_at    timestamptz
);

create index cv_review_results_candidate_id_idx on cv_review_results (candidate_id);

alter table cv_review_results enable row level security;
-- No policies — service role (the admin client) only, same reasoning as
-- company_claim_invites' own header comment.

grant all on cv_review_results to service_role;
