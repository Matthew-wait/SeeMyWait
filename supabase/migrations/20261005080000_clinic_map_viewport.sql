-- Map markers for the visible viewport only (never the whole directory).
-- Uses the geog GiST index, so rows without geog (backfill still running)
-- are not drawn until backfilled.

create or replace function public.clinics_in_view(
  min_lat double precision, min_lng double precision,
  max_lat double precision, max_lng double precision,
  p_limit integer default 1000
)
returns table (id uuid, name text, latitude double precision, longitude double precision)
language sql stable security invoker set search_path = ''
as $$
  select c.id, c.name, c.latitude, c.longitude
  from public.clinics c
  where c.is_active
    and c.geog is not null
    and c.geog operator(public.&&) public.ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::public.geography
  limit greatest(1, least(coalesce(p_limit, 1000), 1000));
$$;

-- clinic_grid_counts was tried for zoomed-out views but times out on a US-wide
-- viewport before the geog backfill completes, so it is intentionally not created.
