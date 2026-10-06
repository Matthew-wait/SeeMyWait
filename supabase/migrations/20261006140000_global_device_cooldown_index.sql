-- The report cooldown check moved from per-clinic to global per-device (one
-- report anywhere locks the device out of reporting ANY clinic until the
-- cooldown window passes). Queries now filter by device_fingerprint +
-- reported_at only, without clinic_id, so index them in that order.
CREATE INDEX IF NOT EXISTS idx_wait_time_reports_device_reported_at
  ON public.wait_time_reports (device_fingerprint, reported_at DESC);
