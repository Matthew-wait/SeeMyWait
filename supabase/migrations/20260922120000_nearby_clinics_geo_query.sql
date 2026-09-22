-- ============================================================================
-- nearby_clinics — real server-side geo filtering for the "browse nearby"
-- list on /app, replacing an unbounded `select * from clinics`.
-- ============================================================================
-- That query had no LIMIT and no distance filter, so PostgREST's default
-- 1000-row cap silently applied, ordered alphabetically by name (the only
-- ORDER BY the client specified) — completely unrelated to the user's actual
-- location. With 26k+ seeded clinics, "nearby" almost never included the
-- clinics actually closest to the user, and never changed when location did.
--
-- This computes true haversine distance in SQL, filters to the requested
-- radius, and returns at most p_limit rows ordered by distance ascending —
-- so the client only ever receives clinics that are actually nearby.
-- ============================================================================

create index if not exists clinics_lat_lng_idx on public.clinics (latitude, longitude);

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
  with bounds as (
    -- Cheap bounding-box pre-filter (1 deg lat ~= 69 mi; degrees-per-mile of
    -- longitude shrinks with latitude) so the index narrows the candidate set
    -- before the more expensive haversine calc runs on it.
    select
      greatest(1, least(coalesce(p_radius_miles, 100), 500)) as radius_miles,
      greatest(1, least(coalesce(p_limit, 500), 2000)) as row_limit
  )
  select
    c.id, c.name, c.address, c.city, c.state, c.postal_code,
    c.latitude, c.longitude, c.phone, c.google_place_id, c.npi, c.specialty,
    (3959 * acos(least(1::double precision, greatest(-1::double precision,
      cos(radians(p_lat)) * cos(radians(c.latitude))
        * cos(radians(c.longitude) - radians(p_lng))
      + sin(radians(p_lat)) * sin(radians(c.latitude))
    )))) as distance_miles
  from public.clinics c, bounds b
  where c.is_active
    and c.latitude between p_lat - (b.radius_miles / 69.0) and p_lat + (b.radius_miles / 69.0)
    and c.longitude between
      p_lng - (b.radius_miles / (69.0 * greatest(cos(radians(p_lat)), 0.01)))
      and p_lng + (b.radius_miles / (69.0 * greatest(cos(radians(p_lat)), 0.01)))
  order by distance_miles asc
  limit (select row_limit from bounds);
$$;
