-- ============================================================================
-- Backfill `geog` — v2: keyset pagination instead of `WHERE geog IS NULL`.
-- ============================================================================
-- v1 (20260928000002) filtered each batch with `WHERE geog IS NULL`, which
-- re-scans the whole 6.7M-row table every iteration (geog has no useful
-- index for an IS NULL lookup — GiST doesn't index nulls). That made each
-- batch cost O(table size), and the Management API's own per-call
-- statement_timeout killed the procedure after only ~1 batch's worth of
-- progress.
--
-- v2 instead paginates by primary key (`id`, which has clinics_pkey) using
-- keyset pagination (`id > last_id order by id limit batch_size`) — an
-- indexed range scan, not a table scan. Progress is persisted in a bookmark
-- table so repeated invocations (needed because the Management API times out
-- a single call before the whole backfill can finish) resume exactly where
-- they left off instead of re-scanning from the start.
-- ============================================================================

create table if not exists public._geog_backfill_progress (
  id integer primary key default 1,
  last_id uuid not null default '00000000-0000-0000-0000-000000000000'
);

insert into public._geog_backfill_progress (id, last_id)
values (1, '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

create or replace procedure public.backfill_clinics_geog_v2(batch_size integer default 20000)
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

    select max(b.id) into new_last_id from (
      select id from public.clinics where id > cur_last_id order by id limit batch_size
    ) b;

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
