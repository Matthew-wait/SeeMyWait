-- Phase 0 (cost-reduction plan): NPI as the stable identity for directory rows.
--
-- The directory will be sourced from the NPPES NPI Registry instead of Google
-- Places. Each provider/facility there has a 10-digit National Provider
-- Identifier. We key dedup on it going forward; `google_place_id` stays for
-- backward compatibility and is simply no longer written.
--
-- Nullable on purpose: manually-added offices, CSV imports without an NPI, and
-- every existing row have none.

alter table public.clinics
  add column if not exists npi text;

alter table public.clinic_suggestions
  add column if not exists npi text;

-- Format guard: 10 digits, or NULL. Cheap to validate; no existing row has a
-- value so this cannot fail on deploy.
alter table public.clinics
  drop constraint if exists clinics_npi_format;
alter table public.clinics
  add constraint clinics_npi_format
  check (npi is null or npi ~ '^[0-9]{10}$');

alter table public.clinic_suggestions
  drop constraint if exists clinic_suggestions_npi_format;
alter table public.clinic_suggestions
  add constraint clinic_suggestions_npi_format
  check (npi is null or npi ~ '^[0-9]{10}$');

-- Partial unique index: at most one clinic per NPI, but many rows may be NULL.
create unique index if not exists clinics_npi_key
  on public.clinics (npi)
  where npi is not null;

comment on column public.clinics.npi is
  'NPPES National Provider Identifier (10 digits). Stable dedup key for directory-sourced offices; NULL for manual/legacy entries.';
comment on column public.clinic_suggestions.npi is
  'NPPES NPI carried from a user suggestion when the submitter picked a registry match.';
