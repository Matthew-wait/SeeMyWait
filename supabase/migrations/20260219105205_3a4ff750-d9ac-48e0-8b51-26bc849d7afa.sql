
-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create enum for wait time categories
CREATE TYPE public.wait_time_category AS ENUM ('on_time', '30_min', '1_hour', '1.5_hours_plus');

-- Create clinics table
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  phone TEXT,
  google_place_id TEXT UNIQUE,
  specialty TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create wait_time_reports table
CREATE TABLE public.wait_time_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  wait_time wait_time_category NOT NULL,
  device_fingerprint TEXT NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_flagged BOOLEAN NOT NULL DEFAULT false
);

-- Create clinic_suggestions table
CREATE TABLE public.clinic_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  google_place_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wait_time_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Clinics: everyone can read active clinics, admins can manage
CREATE POLICY "Anyone can view active clinics"
  ON public.clinics FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can insert clinics"
  ON public.clinics FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update clinics"
  ON public.clinics FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clinics"
  ON public.clinics FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Wait time reports: anyone can insert (anonymous), anyone can read, admins can manage
CREATE POLICY "Anyone can view wait time reports"
  ON public.wait_time_reports FOR SELECT
  USING (true);

CREATE POLICY "Anyone can submit wait time reports"
  ON public.wait_time_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update wait time reports"
  ON public.wait_time_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete wait time reports"
  ON public.wait_time_reports FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Clinic suggestions: anyone can insert, admins can manage
CREATE POLICY "Anyone can submit clinic suggestions"
  ON public.clinic_suggestions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view their suggestions"
  ON public.clinic_suggestions FOR SELECT
  USING (true);

CREATE POLICY "Admins can update suggestions"
  ON public.clinic_suggestions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete suggestions"
  ON public.clinic_suggestions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles: only admins can manage, users can read own
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_clinics_location ON public.clinics (latitude, longitude);
CREATE INDEX idx_clinics_google_place_id ON public.clinics (google_place_id);
CREATE INDEX idx_wait_time_reports_clinic ON public.wait_time_reports (clinic_id, reported_at DESC);
CREATE INDEX idx_wait_time_reports_device ON public.wait_time_reports (device_fingerprint, clinic_id, reported_at DESC);
CREATE INDEX idx_clinic_suggestions_status ON public.clinic_suggestions (status);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
