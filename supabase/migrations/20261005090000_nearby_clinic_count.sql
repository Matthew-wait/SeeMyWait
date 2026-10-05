-- Total offices within a radius, returned as a single number (no rows transferred).
create or replace function public.nearby_clinic_count(
  p_lat double precision, p_lng double precision, p_radius_miles double precision default 5
)
returns bigint
language sql stable security invoker set search_path = ''
as $$
  select count(*)
  from public.clinics c
  where c.is_active
    and c.geog is not null
    and public.ST_DWithin(
      c.geog,
      public.ST_SetSRID(public.ST_MakePoint(p_lng, p_lat), 4326)::public.geography,
      greatest(0.001, least(coalesce(p_radius_miles, 5), 500)) * 1609.344
    );
$$;
