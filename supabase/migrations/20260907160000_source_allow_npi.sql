-- Monorepo reconciliation: the mobile repo's medical_search migration added
-- clinics.source with a CHECK of ('admin','google','user'). NPPES-added rows
-- should record their provenance as 'npi'. Extend the allowed set.

alter table public.clinics drop constraint if exists clinics_source_check;
alter table public.clinics
  add constraint clinics_source_check
  check (source in ('admin', 'google', 'user', 'npi'));
