-- ============================================================================
-- nearby_clinics — add source/place_types/verified columns for mobile parity.
-- ============================================================================
-- Mobile's Clinic type (apps/mobile/src/hooks/use-clinics.ts) reads `source`,
-- `place_types`, and `verified` off each row (used by SearchResults.tsx and
-- MapView.tsx). Web's narrower column list didn't need them. Porting mobile
-- to this RPC (replacing its old `select('*')` full-table fetch) requires
-- adding them here so mobile doesn't silently lose data it already renders.
--
-- Return type changes require dropping the function first — `create or
-- replace` cannot alter an existing function's OUT columns.
-- ============================================================================

drop function if exists public.nearby_clinics(double precision, double precision, double precision, integer);

create function public.nearby_clinics(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles double precision default 100,
  p_limit integer default 500
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  phone text,
  google_place_id text,
  npi text,
  specialty text,
  source text,
  place_types text[],
  verified boolean,
  distance_miles double precision
)
language sql
stable
as $$
  with params as (
    select
      greatest(1, least(coalesce(p_radius_miles, 100), 500)) as radius_miles,
      greatest(1, least(coalesce(p_limit, 500), 2000)) as row_limit,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as origin
  )
  select
    c.id, c.name, c.address, c.city, c.state, c.postal_code,
    c.latitude, c.longitude, c.phone, c.google_place_id, c.npi, c.specialty,
    c.source, c.place_types, c.verified,
    (ST_Distance(c.geog, params.origin) / 1609.344) as distance_miles
  from public.clinics c, params
  where c.is_active
    and c.geog is not null
    and ST_DWithin(c.geog, params.origin, params.radius_miles * 1609.344)
  order by c.geog <-> params.origin
  limit (select row_limit from params);
$$;
