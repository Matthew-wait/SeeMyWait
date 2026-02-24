
-- App settings table for admin-controlled values
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can read settings" ON public.app_settings
  FOR SELECT USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can update settings" ON public.app_settings
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert settings" ON public.app_settings
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete settings" ON public.app_settings
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default values
INSERT INTO public.app_settings (key, value, description) VALUES
  ('nearby_radius_miles', '100', 'Radius in miles for nearby clinics display'),
  ('report_cooldown_minutes', '60', 'Minutes before a user can report again for the same clinic');
