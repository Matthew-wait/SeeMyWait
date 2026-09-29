-- ============================================================================
-- Backfill `geog` — v3: fix `max(uuid) does not exist` bug in v2, and shrink
-- default batch size. The Micro compute instance's statement_timeout is
-- 120s, and under current write load even a single 20000-row keyset-indexed
-- batch didn't reliably finish in time (contention from concurrent NPPES
-- import writers on other machines/Colab). A smaller batch size (3000)
-- reliably finishes well within the timeout, and this procedure keeps
-- looping/committing until it, too, runs out of time — so each invocation
-- still makes as much progress as the timeout allows.
-- ============================================================================

create or replace procedure public.backfill_clinics_geog_v2(batch_size integer default 3000)
language plpgsql
as $$
declare
  rows_updated integer;
  total_updated bigint := 0;
  cur_last_id uuid;
  new_last_id uuid;
begin
  select last_id into cur_last_id from public._geog_backfill_progress where id = 1;

  loop
    with batch as (
      select id from public.clinics
      where id > cur_last_id
      order by id
      limit batch_size
    )
    update public.clinics c
    set geog = case
      when c.latitude between -90 and 90 and c.longitude between -180 and 180
        then ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography
      else null
    end
    from batch
    where c.id = batch.id;

    get diagnostics rows_updated = row_count;
    exit when rows_updated = 0;

    select b.id into new_last_id
    from (
      select id from public.clinics where id > cur_last_id order by id limit batch_size
    ) b
    order by b.id desc
    limit 1;

    cur_last_id := new_last_id;
    total_updated := total_updated + rows_updated;

    update public._geog_backfill_progress set last_id = cur_last_id where id = 1;
    commit;

    raise notice 'backfill_clinics_geog_v2: +% (total %) last_id=%', rows_updated, total_updated, cur_last_id;

    exit when rows_updated < batch_size;
  end loop;

  raise notice 'backfill_clinics_geog_v2: batch pass done, total_updated=%', total_updated;
end;
$$;
