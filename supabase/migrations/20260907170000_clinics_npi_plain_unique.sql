-- The partial unique index `clinics_npi_key ... where npi is not null` can't be
-- used by PostgREST's `on_conflict=npi` upsert (partial-index inference isn't
-- supported), which broke the bulk seed. A plain unique index still allows
-- unlimited NULL npi rows (Postgres treats NULLs as distinct) and works with
-- ON CONFLICT.

drop index if exists public.clinics_npi_key;
create unique index if not exists clinics_npi_key on public.clinics (npi);
