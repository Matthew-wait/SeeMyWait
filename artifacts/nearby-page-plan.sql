set local statement_timeout='20s';
explain (format json)
select c.id,c.geog OPERATOR(public.<->) public.ST_SetSRID(public.ST_MakePoint(-81.4639835,27.7567667),4326)::public.geography as cursor_distance
from public.clinics c where c.is_active and c.geog is not null
and public.ST_DWithin(c.geog,public.ST_SetSRID(public.ST_MakePoint(-81.4639835,27.7567667),4326)::public.geography,25*1609.344)
and (c.geog OPERATOR(public.<->) public.ST_SetSRID(public.ST_MakePoint(-81.4639835,27.7567667),4326)::public.geography,c.id)>(5000,'00000000-0000-0000-0000-000000000000'::uuid)
order by c.geog OPERATOR(public.<->) public.ST_SetSRID(public.ST_MakePoint(-81.4639835,27.7567667),4326)::public.geography
fetch first 5001 rows with ties;
