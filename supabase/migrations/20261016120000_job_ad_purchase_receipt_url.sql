-- Round 35 — visual-fidelity pass on /recruit/jobs/ads: the reference
-- design shows a real "Download" link per billing-history row. Stripe
-- always generates a receipt_url on a successful Charge (no separate
-- "invoice" object needed for a one-time payment) — captured once at
-- webhook-fulfillment time and stored here rather than calling the
-- Stripe API on every page render.
alter table job_ad_purchases add column receipt_url text;
