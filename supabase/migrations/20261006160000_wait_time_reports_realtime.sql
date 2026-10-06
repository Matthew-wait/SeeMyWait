-- Enable Supabase Realtime on wait_time_reports so the map/list and any
-- already-open clinic detail view update within ~1s of another user's
-- report, instead of relying solely on 60s polling (which also left
-- already-open detail views frozen indefinitely — see client-side fix).
--
-- REPLICA IDENTITY FULL so UPDATE/DELETE events (admin flag/unflag/delete,
-- "reset wait times") carry the full old row too, not just the primary key —
-- the client needs e.g. the old clinic_id to know which clinic to refresh.
ALTER TABLE public.wait_time_reports REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'wait_time_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wait_time_reports;
  END IF;
END $$;
