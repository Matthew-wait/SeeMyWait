-- ============================================================================
-- nearby_clinics — PostGIS GiST spatial index. Part 2 of 2 (see 20260928000000).
-- ============================================================================
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block, so this
-- is its own migration file (each file runs as one transaction under
-- `supabase db push`). The `geog` generated column from part 1 must already
-- exist and be backfilled before this runs.
--
-- nearby_clinics() is only swapped over to use `geog`/the new index here,
-- in the same file as the index itself — so there's never a window where
-- the function references `geog` before its index exists.
-- ============================================================================

create index concurrently if not exists clinics_geog_gist_idx
  on public.clinics using gist (geog);

create or replace function public.nearby_clinics(
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
    (ST_Distance(c.geog, params.origin) / 1609.344) as distance_miles
  from public.clinics c, params
  where c.is_active
    and c.geog is not null
    and ST_DWithin(c.geog, params.origin, params.radius_miles * 1609.344)
  order by c.geog <-> params.origin
  limit (select row_limit from params);
$$;

-- The old (latitude, longitude) B-tree index is no longer needed by this
-- function, but left in place — other queries may still use it, and
-- dropping it is a separate, non-urgent cleanup.
