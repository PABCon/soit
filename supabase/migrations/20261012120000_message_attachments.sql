-- Round 31: real file attachments on messages (was a decorative paperclip
-- icon only). Mirrors the `cvs` bucket's shape exactly, not `avatars`/
-- `branding`'s: attachments are private, person-to-person content, not
-- public profile media — PRIVATE bucket, no storage.objects RLS policies
-- for anon/authenticated at all. Uploads go through the admin client in
-- `sendMessage()` only after it has already authorized the caller as a
-- legitimate party to that thread; reads go through short-lived signed
-- URLs minted the same way inside `getThreadDetail()`. Same 5MB cap as
-- the `cvs` bucket; the allowed-type list is the union of `cvs`'
-- (pdf/docx) and `avatars`/`branding`'s (png/jpeg/webp) — a message
-- attachment is plausibly either a document or a photo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments', 'message-attachments', false, 5242880, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png', 'image/jpeg', 'image/webp'
  ]
)
on conflict (id) do nothing;

alter table messages
  add column attachment_path text,
  add column attachment_filename text,
  add column attachment_content_type text,
  add column attachment_size_bytes integer;

-- All four attachment columns travel together or not at all.
alter table messages add constraint attachment_fields_paired check (
  (attachment_path is null) = (attachment_filename is null)
  and (attachment_path is null) = (attachment_content_type is null)
  and (attachment_path is null) = (attachment_size_bytes is null)
);

-- The existing `messages_body_check` (`length(trim(body)) > 0`) is left
-- untouched, deliberately, rather than guessed-and-altered sight-unseen
-- against the live project: an attachment-only send (no caption typed)
-- falls back to the attachment's own filename as `body` in application
-- code (`sendMessage()`), so every row still satisfies it honestly —
-- a bare attachment reads naturally as "sent: invoice.pdf" rather than
-- needing a schema change to allow true emptiness.
