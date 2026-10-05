-- ============================================================================
-- Backfill `geog` per state, prioritized by user-visible impact.
-- ============================================================================
-- The global ID-ordered backfill (backfill_clinics_geog_v2) keeps timing out
-- under contention because each batch has to scan across the ENTIRE table in
-- id order. Scoping to one state at a time uses the existing state index to
-- narrow the working set drastically (e.g. FL's ~590K rows instead of 8.5M),
-- and directly fixes what users in that state actually see first.
-- ============================================================================

create or replace procedure public.backfill_clinics_geog_by_state(p_state text, batch_size integer default 5000)
language plpgsql
as $$
declare
  rows_updated integer;
  total_updated bigint := 0;
begin
  loop
    with batch as (
      select id from public.clinics
      where state = p_state
        and geog is null
        and latitude between -90 and 90
        and longitude between -180 and 180
      limit batch_size
    )
    update public.clinics c
    set geog = ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography
    from batch
    where c.id = batch.id;

    get diagnostics rows_updated = row_count;
    exit when rows_updated = 0;

    total_updated := total_updated + rows_updated;
    commit;

    raise notice 'backfill_clinics_geog_by_state(%): +% (total %)', p_state, rows_updated, total_updated;

    exit when rows_updated < batch_size;
  end loop;

  raise notice 'backfill_clinics_geog_by_state(%): done, total_updated=%', p_state, total_updated;
end;
$$;
