
-- Seed sample clinics in Miami
INSERT INTO public.clinics (name, address, latitude, longitude, phone, specialty, google_place_id) VALUES
  ('Dr. Maria Santos - Family Medicine', '1500 NW 12th Ave, Miami, FL 33136', 25.7905, -80.2153, '(305) 555-0101', 'Family Medicine', NULL),
  ('Miami Pediatric Associates', '8940 N Kendall Dr, Miami, FL 33176', 25.6867, -80.3393, '(305) 555-0102', 'Pediatrics', NULL),
  ('Coral Gables Internal Medicine', '2750 SW 37th Ave, Miami, FL 33133', 25.7382, -80.2571, '(305) 555-0103', 'Internal Medicine', NULL),
  ('Dr. James Chen - Cardiology', '1150 NW 14th St, Miami, FL 33136', 25.7889, -80.2172, '(305) 555-0104', 'Cardiology', NULL),
  ('South Beach Urgent Care', '1000 Lincoln Rd, Miami Beach, FL 33139', 25.7907, -80.1395, '(305) 555-0105', 'Urgent Care', NULL),
  ('Brickell Health Center', '1395 Brickell Ave, Miami, FL 33131', 25.7580, -80.1920, '(305) 555-0106', 'General Practice', NULL),
  ('Dr. Patricia Gomez - Dermatology', '9100 S Dadeland Blvd, Miami, FL 33156', 25.6901, -80.3132, '(305) 555-0107', 'Dermatology', NULL),
  ('Aventura Family Clinic', '2780 NE 183rd St, Aventura, FL 33160', 25.9571, -80.1410, '(305) 555-0108', 'Family Medicine', NULL),
  ('Doral Medical Group', '8200 NW 41st St, Doral, FL 33166', 25.8122, -80.3553, '(305) 555-0109', 'Multi-Specialty', NULL),
  ('Little Havana Community Health', '1501 SW 1st St, Miami, FL 33135', 25.7705, -80.2165, '(305) 555-0110', 'Community Health', NULL),
  ('Dr. Robert Kim - Orthopedics', '8750 N Kendall Dr, Miami, FL 33176', 25.6871, -80.3375, '(305) 555-0111', 'Orthopedics', NULL),
  ('Wynwood Walk-In Clinic', '2520 NW 2nd Ave, Miami, FL 33127', 25.8024, -80.1995, '(305) 555-0112', 'Walk-In Clinic', NULL)
ON CONFLICT DO NOTHING;

-- Seed wait time reports (using the clinics we just inserted)
-- We'll use a CTE to get clinic IDs by name, then insert reports with varied times
DO $$
DECLARE
  clinic_rec RECORD;
  categories text[] := ARRAY['on_time', '30_min', '1_hour', '1.5_hours_plus'];
  fingerprints text[] := ARRAY['fp_demo_1', 'fp_demo_2', 'fp_demo_3', 'fp_demo_4', 'fp_demo_5'];
  i int;
BEGIN
  FOR clinic_rec IN SELECT id, name FROM public.clinics LOOP
    -- Insert 2-5 reports per clinic with random times in last 2 hours
    FOR i IN 1..3 + (random() * 2)::int LOOP
      INSERT INTO public.wait_time_reports (clinic_id, wait_time, device_fingerprint, reported_at)
      VALUES (
        clinic_rec.id,
        categories[1 + (random() * 3)::int]::wait_time_category,
        fingerprints[1 + (random() * 4)::int],
        now() - (random() * interval '2 hours')
      );
    END LOOP;
  END LOOP;
END $$;

-- Also seed a couple of pending clinic suggestions
INSERT INTO public.clinic_suggestions (doctor_name, address) VALUES
  ('Dr. Ana Rodriguez - ENT', '3200 SW 60th Ct, Miami, FL 33155'),
  ('Kendall Wellness Center', '12100 SW 127th Ave, Miami, FL 33186'),
  ('Dr. Michael Torres - Psychiatry', '1680 Meridian Ave, Miami Beach, FL 33139')
ON CONFLICT DO NOTHING;
