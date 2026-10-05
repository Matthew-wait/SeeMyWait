-- Rows from the NPI registry import are trusted and read-only in admin.
-- Default true: existing rows (all imported) and future pipeline rows.
alter table public.clinics add column if not exists npi_imported boolean not null default true;

-- Admin-created, Google-added and suggestion-approved rows are editable.
update public.clinics set npi_imported = false
where npi is null or added_by is not null;
