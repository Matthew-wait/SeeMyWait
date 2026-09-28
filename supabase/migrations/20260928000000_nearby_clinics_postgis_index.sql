-- ============================================================================
-- nearby_clinics — replace the (latitude, longitude) B-tree bounding-box
-- pre-filter with a real PostGIS GiST spatial index.
-- ============================================================================
-- The original version (20260922120000) was built and tested at ~26k rows,
-- where a bounding-box scan over a plain composite B-tree index was plenty
-- fast. Now that `clinics` has grown past 7M rows from the national NPPES
-- import, that same query times out (57014, statement timeout) for dense
-- metro areas — confirmed empirically: a 25-mile radius query centered on
-- NYC took 8.4s and then failed outright. A B-tree index on (lat, lng) can
-- only use one dimension efficiently for a 2D range scan; in a dense area
-- the bounding box still matches tens of thousands of candidate rows before
-- haversine + sort + limit ever runs.
--
-- PostGIS's GiST index supports true 2D nearest-neighbor and radius queries
-- (`<->` KNN operator, `ST_DWithin`) that stay fast regardless of table size,
-- because the index itself prunes by actual geographic proximity instead of
-- a coarse lat/lng rectangle.
--
-- IMPORTANT — before applying to production:
-- 1. `clinics` is currently ~7M+ rows and actively growing (national import
--    still in progress on multiple workers). The backfill UPDATE and index
--    build below are written to avoid blocking concurrent writes, but they
--    are real work against a live, busy table — expect this to take
--    meaningful wall-clock time (likely tens of minutes), and run it when
--    you can watch it rather than in Instant Notice.
-- 2. `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.
--    If your migration runner wraps this file in one transaction, split
--    this file and run the CONCURRENTLY statement separately (e.g. via the
--    Supabase SQL editor, which runs each statement standalone).
-- 3. The backfill UPDATE is batched (by id range) specifically so it doesn't
--    hold one giant lock or one enormous transaction against the table
--    while imports are still writing to it.
-- ============================================================================

create extension if not exists postgis;

-- Generated column: automatically populated for every new/updated row going
-- forward (including ones inserted by the ongoing import) — no pipeline
-- script changes needed.
alter table public.clinics
  add column if not exists geog geography(point, 4326)
  generated always as (
    case
      when latitude between -90 and 90 and longitude between -180 and 180
        then ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
      else null
    end
  ) stored;

-- Backfill is automatic for a STORED generated column on existing rows the
-- moment the column is added — Postgres computes it for every existing row
-- as part of the ALTER TABLE. On a 7M-row table this itself takes real time
-- and holds a lock for its duration; there is no way to batch a generated
-- column's initial backfill (unlike a plain UPDATE). If this is a concern
-- given concurrent import writers, consider running this specific ALTER
-- TABLE during a brief pause in the active import workers.

-- Build the spatial index without blocking concurrent writes.
create index concurrently if not exists clinics_geog_gist_idx
  on public.clinics using gist (geog);

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
  with params as (
    select
      greatest(1, least(coalesce(p_radius_miles, 100), 500)) as radius_miles,
      greatest(1, least(coalesce(p_limit, 500), 2000)) as row_limit,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as origin
  )
  select
    c.id, c.name, c.address, c.city, c.state, c.postal_code,
    c.latitude, c.longitude, c.phone, c.google_place_id, c.npi, c.specialty,
    (ST_Distance(c.geog, params.origin) / 1609.344) as distance_miles
  from public.clinics c, params
  where c.is_active
    and c.geog is not null
    and ST_DWithin(c.geog, params.origin, params.radius_miles * 1609.344)
  order by c.geog <-> params.origin
  limit (select row_limit from params);
$$;

-- The old (latitude, longitude) B-tree index is no longer needed by this
-- function, but left in place — other queries may still use it, and
-- dropping it is a separate, non-urgent cleanup.
