-- ============================================================================
-- nearby_clinics — replace the (latitude, longitude) B-tree bounding-box
-- pre-filter with a real PostGIS GiST spatial index. Part 1 of 2.
-- ============================================================================
-- The original version (20260922120000) was built and tested at ~26k rows,
-- where a bounding-box scan over a plain composite B-tree index was plenty
-- fast. Now that `clinics` has grown past 6.7M rows from the national NPPES
-- import, that same query times out (57014, statement timeout) for dense
-- metro areas — confirmed empirically: a 25-mile radius query centered on
-- NYC took 8.4s and then failed outright. A B-tree index on (lat, lng) can
-- only use one dimension efficiently for a 2D range scan; in a dense area
-- the bounding box still matches tens of thousands of candidate rows before
-- haversine + sort + limit ever runs.
--
-- This file adds the PostGIS extension and a `geog` column. Unlike the
-- first attempt, this is a PLAIN nullable column (no GENERATED ALWAYS ...
-- STORED) — a generated/stored column forces Postgres to rewrite the whole
-- table in one atomic ALTER TABLE, which needs roughly 2x the table's disk
-- footprint at once. On this project's Micro compute instance that blew the
-- disk budget outright (53100, "No space left on device") on a 6.7M-row
-- table. A plain ADD COLUMN with no default is metadata-only and instant.
--
-- A trigger keeps `geog` populated for every new/updated row going forward.
-- Existing rows are backfilled separately, in small committed batches
-- (see scripts/backfill-clinics-geog.mjs / the Management API loop used to
-- run it) so no single transaction touches more than a slice of the table
-- at once — this lets Supabase's disk autoscaler keep pace instead of
-- needing the full extra footprint instantaneously.
--
-- Part 2 (20260928000001) builds the spatial index (CREATE INDEX
-- CONCURRENTLY, which can't run inside this transaction) and swaps
-- `nearby_clinics()` over to use it, once the backfill above is complete.
-- ============================================================================

create extension if not exists postgis;

alter table public.clinics
  add column if not exists geog geography(point, 4326);

create or replace function public.clinics_set_geog()
returns trigger
language plpgsql
as $$
begin
  if new.latitude between -90 and 90 and new.longitude between -180 and 180 then
    new.geog := ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.geog := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clinics_set_geog_trigger on public.clinics;
create trigger clinics_set_geog_trigger
  before insert or update of latitude, longitude on public.clinics
  for each row
  execute function public.clinics_set_geog();
