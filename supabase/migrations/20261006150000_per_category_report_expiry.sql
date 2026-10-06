-- Report expiry was previously one flat value shared with the device
-- cooldown (report_cooldown_minutes), so a 30-min report and a 90+-min
-- report both reverted to "On Time" after the same window. Split expiry out
-- per wait-time category so each reverts on its own schedule, and admin can
-- tune each independently. report_cooldown_minutes keeps its original,
-- narrower job: only the per-device "wait before reporting again" cooldown.
INSERT INTO public.app_settings (key, value, description) VALUES
  ('report_expiry_30min_minutes', '30', 'Minutes before a "~30 min" report reverts to On Time'),
  ('report_expiry_60min_minutes', '60', 'Minutes before a "~1 hour" report reverts to On Time'),
  ('report_expiry_90plus_minutes', '90', 'Minutes before a "1.5+ hours" report reverts to On Time')
ON CONFLICT (key) DO NOTHING;
