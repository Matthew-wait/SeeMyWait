-- ============================================================================
-- Backfill `geog` for existing clinics rows in small committed batches.
-- ============================================================================
-- `geog` (added in 20260928000000) is a plain nullable column so the ADD
-- COLUMN itself was instant/metadata-only. Existing rows still need their
-- `geog` value computed. Doing that as one giant UPDATE (or as part of a
-- GENERATED ALWAYS ... STORED column, which was the first attempt) rewrites
-- the whole 6.7M-row table in one transaction and blew the disk budget on
-- this project's Micro compute instance (53100, "No space left on device").
--
-- A PL/pgSQL PROCEDURE (not a function) can COMMIT between iterations of its
-- own loop, so this backfill runs entirely server-side in small batches with
-- real commits in between — giving Supabase's disk autoscaler time to keep
-- pace and keeping any one transaction's footprint small. Invoke with a
-- single `call public.backfill_clinics_geog();` (not via db push, since that
-- wraps each migration file in one transaction and would defeat the point).
-- ============================================================================

create or replace procedure public.backfill_clinics_geog(batch_size integer default 20000)
language plpgsql
as $$
declare
  rows_updated integer;
  total_updated bigint := 0;
begin
  loop
    with batch as (
      select id from public.clinics
      where geog is null
        and latitude between -90 and 90
        and longitude between -180 and 180
      limit batch_size
    )
    update public.clinics c
    set geog = ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography
    from batch
    where c.id = batch.id;

    get diagnostics rows_updated = row_count;
    total_updated := total_updated + rows_updated;
    raise notice 'backfill_clinics_geog: +% (total %)', rows_updated, total_updated;

    commit;

    exit when rows_updated = 0;
  end loop;

  raise notice 'backfill_clinics_geog: done, total_updated=%', total_updated;
end;
$$;
