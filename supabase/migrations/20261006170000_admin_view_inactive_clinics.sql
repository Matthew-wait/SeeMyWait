-- Admins need to see inactive clinics, not just active ones — the Doctors
-- tab's own list query, and the implicit RETURNING on UPDATE (hide/unhide),
-- are both filtered by SELECT policies regardless of the UPDATE policy.
-- Without this, an admin flipping is_active to false fails with
-- "new row violates row-level security policy for table clinics", because
-- the resulting row no longer matches the public "active only" SELECT policy
-- and there was no admin-scoped SELECT policy to fall back on.
CREATE POLICY "Admins can view all clinics"
  ON public.clinics FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
