-- Nearest-first, read-only batches. One extra ID detects whether more exist.
begin;
create or replace function clinic_search_internal.nearby_clinics_batch(
 p_lat double precision,p_lng double precision,p_radius_miles double precision default 5,
 p_page_size integer default 1000,p_after_distance double precision default null,p_after_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path=''
set enable_seqscan=off set extra_float_digits=3
as $$
declare
 origin public.geography;
 page_ids uuid[];
 page_distances double precision[];
 size integer := greatest(1,least(coalesce(p_page_size,1000),1000));
 result jsonb;
 bound_m double precision;
begin
 if not (p_lat between -90 and 90 and p_lng between -180 and 180) then
  return jsonb_build_object('clinics','[]'::jsonb,'next_cursor',null);
 end if;
 if not (auth.uid() is not null or coalesce(nullif(current_setting('role',true),'none'),session_user::text) in ('anon','authenticated','service_role','postgres')) then
  return jsonb_build_object('clinics','[]'::jsonb,'next_cursor',null);
 end if;
 origin := public.ST_SetSRID(public.ST_MakePoint(p_lng,p_lat),4326)::public.geography;
 -- KNN finds a small upper bound before exact spheroid ordering. Every row
 -- nearer than this bound participates in the final sort, so spherical KNN
 -- ordering never substitutes for exact nearest-first distance ordering.
 select max(seed.distance_m) into bound_m from (
  select public.ST_Distance(c.geog,origin) as distance_m
  from public.clinics c where c.is_active and c.geog is not null
   and public.ST_DWithin(c.geog,origin,greatest(0.001,least(coalesce(p_radius_miles,5),500))*1609.344)
   and (p_after_distance is null or (public.ST_Distance(c.geog,origin)/1609.344,c.id)>(p_after_distance,p_after_id))
  order by c.geog OPERATOR(public.<->) origin limit size+1
 ) seed;
 if bound_m is null then return jsonb_build_object('clinics','[]'::jsonb,'next_cursor',null); end if;
 perform set_config('enable_indexscan','off',true);
 with candidates as materialized (
  select c.id,public.ST_Distance(c.geog,origin)/1609.344 as distance_miles
  from public.clinics c where c.is_active and c.geog is not null
   and public.ST_DWithin(c.geog,origin,least(bound_m+0.00001,greatest(0.001,least(coalesce(p_radius_miles,5),500))*1609.344))
 ), batch as (
  select id,distance_miles from candidates
  where p_after_distance is null or (distance_miles,id)>(p_after_distance,p_after_id)
  order by distance_miles,id limit size+1
 ) select array_agg(id order by distance_miles,id),array_agg(distance_miles order by distance_miles,id)
 into page_ids,page_distances from batch;
 perform set_config('enable_indexscan','on',true);
 select jsonb_build_object('clinics',coalesce((
  select jsonb_agg(to_jsonb(rows) order by rows.distance_miles,rows.id) from (
   select c.id,c.name,c.address,c.city,c.state,c.postal_code,c.latitude,c.longitude,
    c.phone,c.google_place_id,c.npi,c.specialty,p.distance_miles
   from unnest(page_ids[1:size],page_distances[1:size]) as p(id,distance_miles)
   join public.clinics c on c.id=p.id where c.is_active
  ) rows
 ),'[]'::jsonb),'next_cursor',case when cardinality(page_ids)>size
  then jsonb_build_object('distance',page_distances[size],'id',page_ids[size]) else null end) into result;
 return result;
end;
$$;
revoke all on function clinic_search_internal.nearby_clinics_batch(double precision,double precision,double precision,integer,double precision,uuid) from public;
grant execute on function clinic_search_internal.nearby_clinics_batch(double precision,double precision,double precision,integer,double precision,uuid) to anon,authenticated,service_role;
create or replace function public.nearby_clinics_batch(
 p_lat double precision,p_lng double precision,p_radius_miles double precision default 5,
 p_page_size integer default 1000,p_after_distance double precision default null,p_after_id uuid default null
) returns jsonb language sql stable security invoker set search_path=''
as $$ select clinic_search_internal.nearby_clinics_batch(p_lat,p_lng,p_radius_miles,p_page_size,p_after_distance,p_after_id); $$;
revoke all on function public.nearby_clinics_batch(double precision,double precision,double precision,integer,double precision,uuid) from public;
grant execute on function public.nearby_clinics_batch(double precision,double precision,double precision,integer,double precision,uuid) to anon,authenticated,service_role;
update public.app_settings set value='5' where key='nearby_radius_miles';
notify pgrst,'reload schema';
commit;
