-- Read-only geographic pages with no total-result cap. The legacy RPC stays compatible.
begin;
create schema if not exists clinic_search_internal;
grant usage on schema clinic_search_internal to anon,authenticated,service_role;
create or replace function clinic_search_internal.nearby_clinics_page(
  p_lat double precision,p_lng double precision,p_radius_miles double precision default 25,
  p_page_size integer default 5000,p_cell integer default 0,p_after_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path=''
set enable_seqscan=off set enable_indexscan=off
as $$
declare
  origin public.geography;
  radius_m double precision;
  lat_margin double precision;
  lng_margin double precision;
  south double precision;
  north double precision;
  tile record;
  size integer := greatest(1,least(coalesce(p_page_size,5000),5000));
  result jsonb;
  page_ids uuid[];
  current_cell integer := p_cell;
  cursor_id uuid := p_after_id;
  iteration integer;
  started_at timestamptz := clock_timestamp();
begin
  if not (p_lat between -90 and 90 and p_lng between -180 and 180) or p_cell not between 0 and 255 then
    return jsonb_build_object('clinics','[]'::jsonb,'next_cursor',null);
  end if;
  if not (auth.uid() is not null or coalesce(nullif(current_setting('role',true),'none'),session_user::text) in ('anon','authenticated','service_role','postgres')) then
    return jsonb_build_object('clinics','[]'::jsonb,'next_cursor',null);
  end if;
  origin := public.ST_SetSRID(public.ST_MakePoint(p_lng,p_lat),4326)::public.geography;
  radius_m := greatest(0.001,least(coalesce(p_radius_miles,25),500))*1609.344;
  -- Conservative bounds; exact ST_DWithin below is authoritative.
  lat_margin := radius_m/100000.0;
  south := greatest(-90.0,p_lat-lat_margin);
  north := least(90.0,p_lat+lat_margin);
  lng_margin := least(180.0,lat_margin/greatest(0.001,cos(radians(least(89.999,abs(p_lat)+lat_margin)))));
  for iteration in 1..8 loop
  select x,y into tile from generate_series(0,15) x cross join generate_series(0,15) y
    order by power(x-7.5,2)+power(y-7.5,2),x,y offset current_cell limit 1;
  select array_agg(p.id order by p.id) into page_ids from (
    select c.id
    from public.clinics c
    where c.is_active and c.geog is not null
      and c.geog OPERATOR(public.&&) public.ST_MakeEnvelope(
        p_lng-lng_margin+tile.x*lng_margin/8.0,south+tile.y*(north-south)/16.0,
        p_lng-lng_margin+(tile.x+1)*lng_margin/8.0,south+(tile.y+1)*(north-south)/16.0,4326)::public.geography
      -- Half-open numeric boundaries assign a clinic to exactly one tile, even
      -- though geography bounding boxes overlap. Normalize dateline longitudes.
      and (case when c.longitude-p_lng>180 then c.longitude-360 when c.longitude-p_lng< -180 then c.longitude+360 else c.longitude end)>=p_lng-lng_margin+tile.x*lng_margin/8.0
      and (case when c.longitude-p_lng>180 then c.longitude-360 when c.longitude-p_lng< -180 then c.longitude+360 else c.longitude end)<p_lng-lng_margin+(tile.x+1)*lng_margin/8.0
      and c.latitude>=south+tile.y*(north-south)/16.0
      and (c.latitude<south+(tile.y+1)*(north-south)/16.0 or (tile.y=15 and c.latitude<=north))
      and public.ST_DWithin(c.geog,origin,radius_m)
      and (cursor_id is null or c.id>cursor_id) order by c.id limit size+1

  ) p;
  if coalesce(cardinality(page_ids),0)=0 and current_cell<255 and iteration<8 and clock_timestamp()-started_at<interval '1 second' then
    current_cell := current_cell+1; cursor_id := null; continue;
  end if;
  -- The selection above needs the spatial bitmap. Hydration uses primary-key
  -- reads, so re-enable ordinary index scans for only the selected page IDs.
  perform set_config('enable_indexscan','on',true);
  select jsonb_build_object(
    'clinics',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from (
      select c.id,c.name,c.address,c.city,c.state,c.postal_code,c.latitude,c.longitude,
        c.phone,c.google_place_id,c.npi,c.specialty,public.ST_Distance(c.geog,origin)/1609.344 as distance_miles
      from public.clinics c where c.id=any(page_ids[1:size]) and c.is_active
    ) c),'[]'::jsonb),
    'next_cursor',case when cardinality(page_ids)>size then jsonb_build_object('cell',current_cell,'id',page_ids[size])
      when current_cell<255 then jsonb_build_object('cell',current_cell+1,'id',null) else null end
  ) into result;
  return result;
  end loop;
end;
$$;
revoke all on function clinic_search_internal.nearby_clinics_page(double precision,double precision,double precision,integer,integer,uuid) from public;
grant execute on function clinic_search_internal.nearby_clinics_page(double precision,double precision,double precision,integer,integer,uuid) to anon,authenticated,service_role;
create or replace function public.nearby_clinics_page(
  p_lat double precision,p_lng double precision,p_radius_miles double precision default 25,
  p_page_size integer default 5000,p_cell integer default 0,p_after_id uuid default null
) returns jsonb language sql stable security invoker set search_path=''
as $$ select clinic_search_internal.nearby_clinics_page(p_lat,p_lng,p_radius_miles,p_page_size,p_cell,p_after_id); $$;
revoke all on function public.nearby_clinics_page(double precision,double precision,double precision,integer,integer,uuid) from public;
grant execute on function public.nearby_clinics_page(double precision,double precision,double precision,integer,integer,uuid) to anon,authenticated,service_role;
-- Remove the unused experimental distance-cursor overload, avoiding RPC ambiguity.
drop function if exists public.nearby_clinics_page(double precision,double precision,double precision,integer,double precision,uuid);
drop function if exists clinic_search_internal.nearby_clinics_page(double precision,double precision,double precision,integer,double precision,uuid);
notify pgrst,'reload schema';
commit;
