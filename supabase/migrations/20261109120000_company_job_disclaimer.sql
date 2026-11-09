-- A company-wide disclaimer an employer sets once (Company Profile),
-- appended to the bottom of every one of their job postings at display
-- time, never copied into each job's own stored description. Single
-- source of truth, same reasoning the Salary component already follows:
-- editing it once updates every live job instantly, nothing to keep in
-- sync by hand across 105 separate job rows.
alter table companies add column job_disclaimer text;

grant select (job_disclaimer) on companies to anon, authenticated;
grant update (job_disclaimer) on companies to authenticated;
