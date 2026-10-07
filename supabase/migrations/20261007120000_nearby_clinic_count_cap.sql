-- nearby_clinic_count did an exact count(*) over ST_DWithin. Confirmed against the
-- real production endpoint (anon role, 3s statement_timeout): this times out (57014)
-- in dense metros at ANY practical radius, including the 5-mile default — not just
-- the 100-mile case first reported. NYC alone has 100,000+ offices within 5 miles,
-- so an exact count has to touch too many rows to ever be fast there.
--
-- Fix: a small precomputed grid of office counts (0.025-degree cells, ~2.7km),
-- refreshed nightly by pg_cron (see refresh_clinic_geo_grid, wired into the
-- existing nightly job below). The count sums grid cells within radius + a
-- 1.25-mile buffer approximating the cell's half-diagonal, so cells that could
-- partially overlap the search circle are not missed. Tested against the real
-- production endpoint (anon role): NYC at the 5-mile default went from a
-- 57014 timeout to ~151,000 in under a second, versus an exact 113,783 — a
-- bounded over-count near the radius edge, not an exact figure, in exchange
-- for a count that is always fast.

create table if not exists public.clinic_geo_grid (
  cell_lat double precision not null,
  cell_lng double precision not null,
  n integer not null,
  refreshed_at timestamptz not null default now(),
  primary key (cell_lat, cell_lng)
);

alter table public.clinic_geo_grid enable row level security;

drop policy if exists "clinic_geo_grid readable by everyone" on public.clinic_geo_grid;
create policy "clinic_geo_grid readable by everyone"
  on public.clinic_geo_grid for select
  to anon, authenticated
  using (true);

-- Tables get broad default grants on this project; keep this one to what it needs.
revoke insert, update, delete, truncate, references, trigger on public.clinic_geo_grid from anon, authenticated;

create or replace function public.refresh_clinic_geo_grid()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  inserted integer;
begin
  set local statement_timeout = 0;
  truncate public.clinic_geo_grid;
  insert into public.clinic_geo_grid (cell_lat, cell_lng, n, refreshed_at)
  select floor(latitude / 0.025) * 0.025 + 0.0125, floor(longitude / 0.025) * 0.025 + 0.0125, count(*), now()
  from public.clinics
  where is_active and geog is not null
  group by 1, 2;
  get diagnostics inserted = row_count;
  return inserted;
end;
$fn$;

revoke all on function public.refresh_clinic_geo_grid() from public, anon, authenticated;

create or replace function public.nearby_clinic_count(
  p_lat double precision, p_lng double precision, p_radius_miles double precision default 5
)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $fn$
  select coalesce(sum(g.n), 0)::bigint
  from public.clinic_geo_grid g
  where public.ST_DWithin(
    public.ST_SetSRID(public.ST_MakePoint(g.cell_lng, g.cell_lat), 4326)::public.geography,
    public.ST_SetSRID(public.ST_MakePoint(p_lng, p_lat), 4326)::public.geography,
    (greatest(0.001, least(coalesce(p_radius_miles, 5), 500)) + 1.25) * 1609.344
  );
$fn$;

-- Build the grid now so the count is correct immediately, not just after tonight's run.
select public.refresh_clinic_geo_grid();

-- Add the grid refresh to the existing nightly job (03:15 UTC) rather than a second schedule.
create or replace function public.refresh_all_clinic_city_summaries()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  st text;
  total integer := 0;
begin
  set local statement_timeout = 0;
  for st in select distinct state from public.clinic_city_summary order by state loop
    total := total + public.refresh_clinic_city_summary(st);
  end loop;
  perform public.refresh_clinic_geo_grid();
  return total;
end;
$fn$;
