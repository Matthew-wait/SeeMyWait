-- Approved and applied to the live project on October 5, 2026.
-- Private read-only spatial helper for the current public active-clinic policy.
-- Public RPC remains SECURITY INVOKER; table RLS remains enabled.
create schema if not exists clinic_search_internal;
create or replace function clinic_search_internal.nearby_clinics(
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
security definer
set search_path = ''
stable
as $$
  select
    c.id, c.name, c.address, c.city, c.state, c.postal_code,
    c.latitude, c.longitude, c.phone, c.google_place_id, c.npi, c.specialty,
    c.source, c.place_types, c.verified,
    (public.ST_Distance(c.geog, public.ST_SetSRID(public.ST_MakePoint(p_lng,p_lat),4326)::public.geography) / 1609.344) as distance_miles
  from public.clinics c
  where c.is_active and (auth.uid() is not null or coalesce(nullif(current_setting('role', true), 'none'), session_user::text) in ('anon', 'authenticated', 'service_role', 'postgres'))
    and c.geog is not null
    and public.ST_DWithin(c.geog,
      public.ST_SetSRID(public.ST_MakePoint(p_lng,p_lat),4326)::public.geography,
      greatest(1,least(coalesce(p_radius_miles,100),500)) * 1609.344)
  order by c.geog OPERATOR(public.<->) public.ST_SetSRID(public.ST_MakePoint(p_lng,p_lat),4326)::public.geography
  limit greatest(1,least(coalesce(p_limit,500),2000));
$$;

revoke all on function clinic_search_internal.nearby_clinics(double precision,double precision,double precision,integer) from public;
grant usage on schema clinic_search_internal to anon, authenticated, service_role;
grant execute on function clinic_search_internal.nearby_clinics(double precision,double precision,double precision,integer) to anon, authenticated, service_role;
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
  source text,
  place_types text[],
  verified boolean,
  distance_miles double precision
)
language sql
security invoker
set search_path = ''
stable
as $$ select * from clinic_search_internal.nearby_clinics(p_lat,p_lng,p_radius_miles,p_limit); $$;
