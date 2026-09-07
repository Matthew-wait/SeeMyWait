-- R&D §6 (Google Maps replacement): store the practice-address components that
-- the NPPES `add` action already parses out of the registry's LOCATION address.
--
-- Enables ZIP/state/city-scoped search and gives dedup a second signal beyond
-- the free-text `address`. All nullable — older rows and manual map-point adds
-- have no components, only the concatenated `address`.

alter table public.clinics
  add column if not exists city text,
  add column if not exists state text,          -- 2-letter USPS
  add column if not exists postal_code text;    -- 5-digit ZIP

create index if not exists clinics_state_city_idx on public.clinics (state, city);
create index if not exists clinics_postal_code_idx on public.clinics (postal_code);

comment on column public.clinics.city is
  'Practice-location city (from the NPPES LOCATION address). NULL for legacy/manual rows.';
comment on column public.clinics.state is
  'Practice-location state, 2-letter USPS code.';
comment on column public.clinics.postal_code is
  'Practice-location ZIP, 5 digits.';
