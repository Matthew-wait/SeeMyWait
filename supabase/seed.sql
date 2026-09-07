-- ============================================================================
-- Seed: public.clinics
-- ----------------------------------------------------------------------------
-- The live `clinics` table was wiped (0 rows) and no automatic backup exists
-- on the Free tier. This seed restores the map with the APPROVED, geocoded
-- entries from `clinic_suggestions` (status = 'approved', lat/long present).
--
-- This file is the version-controlled source of truth for baseline clinic data
-- so it can never silently vanish again. To restore production, run this whole
-- file in the Supabase SQL Editor (postgres role bypasses RLS).
--
-- Idempotent: re-running will not create duplicates (matched on name+address).
--
-- NOTE: rows marked "-- TEST?" below look like test data. They were marked
-- 'approved' in clinic_suggestions, so they are included, but you should review
-- and DELETE any that are not real clinics.
-- ============================================================================

insert into public.clinics (name, address, latitude, longitude, phone, specialty, google_place_id, is_active)
select v.name, v.address, v.latitude, v.longitude, v.phone, v.specialty, v.google_place_id, true
from (values
  ('Dr. ABC',       'taxila rawalpindi',                                                                                33.744279,        72.867535,        '3105403485',      'surgery',      null),                              -- TEST?
  ('DR. SHAHID',    'taxila rawalpindi',                                                                                33.744364,        72.867538,        '923105403485',    'surgery',      null),
  ('dr. jamal123',  'saddar rawalpindi',                                                                                33.6039774,       73.0483479,       null,              'cardiology',   '422948949'),                       -- TEST?
  ('dr aslam',      'saddar pakistan',                                                                                  24.8605712,       67.0317406,       null,              'cardiology',   '228025479'),
  ('dr. jamal123',  'saddar pakistan',                                                                                  32.5125194,       74.5559372,       null,              'cardiology',   '198608875'),                       -- TEST?
  ('dr. abdullah',  'Saddar, Rawalpindi, Punjab, Pakistan',                                                             33.587696,        73.0594066,       null,              'cardiology',   '198441264'),
  ('dr aryfdfhg',   'Saddar, Rawalpindi, Pakistan',                                                                     33.5968788,       73.0528412,       null,              'cardiologist', 'ChIJo_WHTYOU3zgR5_Ii3b4XblA'),    -- TEST?
  ('dr shaheen',    'Pakistan post Office, PMO Boulevard, PMO Colony Gulshan Colony, Taxila, Pakistan',                 33.7409977,       72.8644415,       null,              'cardiologist', 'ChIJz9YdbQCl3zgR_5P_ZrOq4qY'),
  ('sheikh tets',   'Pakistan Askari School And College, Holy Family Road, Block E Satellite Town, Rawalpindi, Pakistan', 33.6355724,     73.0582482,       null,              'ENT',          'ChIJQ1iM_uGU3zgRUjqhvCFz-Ks'),    -- TEST?
  ('Test Yusra',    'Islamabad property, Street 10, Cabinet Division Employees CHS E-16/2 E-16, Islamabad, Pakistan',   33.6533233,       72.8817821,       null,              'ENT',          'ChIJW8X5BdiX3zgR97dOssp756A'),    -- TEST?
  ('Test clinic DHA','DHA Phase II, Islamabad, Pakistan',                                                               33.5304909,       73.1670768,       null,              'Cardiology',   'ChIJGQ_wq43t3zgRel4CwxgjgQs'),    -- TEST?
  ('Malkan',        'Taxila, Punjab, Pakistan',                                                                         33.7445393,       72.8678413,       '+923105403485',   'Ent',          null)                               -- TEST?
) as v(name, address, latitude, longitude, phone, specialty, google_place_id)
where not exists (
  select 1 from public.clinics c
  where c.name = v.name and c.address = v.address
);
