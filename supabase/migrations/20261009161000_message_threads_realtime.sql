-- Companion to 20261009160000_messages_realtime.sql's own comment: the
-- inbox list view (InboxRealtimeRefresh) watches each thread's own
-- `last_message_at` UPDATE rather than subscribing to every individual
-- message insert across however many threads a person has.
alter publication supabase_realtime add table message_threads;
