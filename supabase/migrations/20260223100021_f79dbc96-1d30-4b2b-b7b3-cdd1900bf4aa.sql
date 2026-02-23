
-- Add specialty, phone, and type fields to clinic_suggestions
ALTER TABLE public.clinic_suggestions
ADD COLUMN specialty text,
ADD COLUMN phone text,
ADD COLUMN clinic_type text DEFAULT 'doctor';
