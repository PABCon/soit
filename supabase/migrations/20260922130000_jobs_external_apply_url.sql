-- SóIT — external apply URL (build spec §5.2, v1.11)
--
-- When set, the public Apply button is a plain outbound link to the
-- employer's own site and SóIT never collects an application for this
-- job at all. Unset (the default): the normal account-free apply flow.

alter table jobs add column external_apply_url text;
