-- SóIT — verification retry backoff (build step 3, spec §5.7.3)
--
-- The async VIES lookup can come back "undetermined" (provider unavailable),
-- which must never resolve to failed or verified — it stays pending and is
-- retried with backoff. These columns track that without a cron job: the
-- console layout retries lazily on load once verification_next_retry_at has
-- passed (Vercel Hobby's cron minimum interval is daily, too coarse here).

alter table companies
  add column verification_attempts int not null default 0,
  add column verification_next_retry_at timestamptz;
