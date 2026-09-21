-- SóIT — storage buckets (build spec §6.3)
--
-- CVs are personal data. The bucket is PRIVATE — not public-with-an-
-- unguessable-URL, private. A public bucket makes every CV world-readable to
-- anyone who obtains or guesses a link, which is a GDPR problem (§6.6).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- 5 MB is generous for a CV (§6.7). Type is also sniffed server-side; the
  -- client-declared MIME type is never trusted.
  ('cvs', 'cvs', false, 5242880, array[
     'application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
   ]),
  ('branding', 'branding', true, 2097152, array[
     'image/png','image/jpeg','image/webp','image/svg+xml'
   ])
on conflict (id) do nothing;

-- ── cvs: no client policies at all ───────────────────────────────────────────
-- Uploads go through a server route handler with the service role so the file
-- can be size- and type-checked and rate-limited (§6.7); reads go through
-- short-lived signed URLs minted after the RLS check (§6.3). Since there are
-- no policies for anon/authenticated, neither can touch this bucket directly.

-- ── branding: public read, scoped write ──────────────────────────────────────
-- Path convention: <company_id>/<filename>
create policy "branding is publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'branding');

create policy "owners upload their company's branding"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.my_company_id()::text
    and public.my_employer_role() = 'owner'
  );

create policy "owners replace their company's branding"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.my_company_id()::text
    and public.my_employer_role() = 'owner'
  );

create policy "owners delete their company's branding"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.my_company_id()::text
    and public.my_employer_role() = 'owner'
  );
