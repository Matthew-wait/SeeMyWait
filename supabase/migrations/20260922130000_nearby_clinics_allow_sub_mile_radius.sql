-- ============================================================================
-- nearby_clinics: allow sub-mile radii (e.g. a 1000m/0.62mi demo radius)
-- ============================================================================
-- The initial version clamped p_radius_miles to a 1-mile floor, which would
-- silently round any smaller admin-configured radius back up to a full mile.
-- Lower the floor to 0.05 miles (~264 ft) — small enough for a tight demo
-- radius, still large enough to never become a zero-width/degenerate box.
-- ============================================================================

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
    select
      greatest(0.05, least(coalesce(p_radius_miles, 100), 500)) as radius_miles,
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
