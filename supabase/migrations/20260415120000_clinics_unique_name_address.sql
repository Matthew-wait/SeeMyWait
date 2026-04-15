-- Enforce uniqueness of clinic identity: same name + address (case-insensitive, trimmed) cannot appear twice.
-- Remove existing duplicates first, keeping the row with the smallest id (preserves FK references to that row).

DELETE FROM public.clinics a
USING public.clinics b
WHERE a.id > b.id
  AND lower(trim(both from a.name)) = lower(trim(both from b.name))
  AND lower(trim(both from a.address)) = lower(trim(both from b.address));

CREATE UNIQUE INDEX IF NOT EXISTS clinics_unique_name_address_lower
  ON public.clinics (
    lower(trim(both from name)),
    lower(trim(both from address))
  );
