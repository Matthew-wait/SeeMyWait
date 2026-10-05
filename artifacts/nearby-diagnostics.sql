set local statement_timeout='45s';
select label,count(*) as eligible_clinics
from (values ('Miami-Dade',25.8965,-80.157),('Central Florida',27.7567667,-81.4639835)) as loc(label,lat,lng)
join public.clinics c on c.is_active and c.geog is not null
and public.ST_DWithin(c.geog,public.ST_SetSRID(public.ST_MakePoint(loc.lng,loc.lat),4326)::public.geography,25*1609.344)
group by label;
