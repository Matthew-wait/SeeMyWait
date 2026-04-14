-- Store in-app user feedback from the settings page
CREATE TABLE public.feedback_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text,
  message text NOT NULL,
  device_fingerprint text NOT NULL,
  page text NOT NULL DEFAULT 'settings',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Allow app users (including anonymous usage) to submit feedback
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback_submissions
  FOR INSERT
  WITH CHECK (true);

-- Admins can review feedback in SQL/dashboard tools
CREATE POLICY "Admins can read feedback"
  ON public.feedback_submissions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
