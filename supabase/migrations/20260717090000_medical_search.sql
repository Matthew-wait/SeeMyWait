-- ============================================================================
-- Medical Place Search (Phase 1) — schema, search indexes, rate limiter
-- ============================================================================
-- Adds provenance columns to clinics, fast fuzzy search (pg_trgm), a unique
-- guard on google_place_id (dedup), and an atomic fixed-window rate limiter
-- used by the medical-search edge function to cap Google Places usage.
-- Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists pg_trgm;

-- --- clinics provenance columns -------------------------------------------------
alter table public.clinics add column if not exists source     text    not null default 'admin';
alter table public.clinics add column if not exists place_types text[];
alter table public.clinics add column if not exists verified   boolean not null default false;
alter table public.clinics add column if not exists added_by   text;

-- Constrain source to known values (drop/recreate to stay idempotent).
alter table public.clinics drop constraint if exists clinics_source_check;
alter table public.clinics
  add constraint clinics_source_check check (source in ('admin', 'google', 'user'));

-- --- dedup guarantee: one clinic per Google place --------------------------------
-- Partial unique so multiple NULLs (manual clinics) are still allowed.
create unique index if not exists clinics_google_place_id_key
  on public.clinics (google_place_id)
  where google_place_id is not null;

-- --- fast DB-first fuzzy search --------------------------------------------------
create index if not exists clinics_name_trgm    on public.clinics using gin (name gin_trgm_ops);
create index if not exists clinics_address_trgm on public.clinics using gin (address gin_trgm_ops);

-- Parameterized fuzzy search (injection-safe: p_q is a bound parameter, never
-- concatenated into SQL structure). Ranks prefix matches, then trigram similarity.
create or replace function public.search_clinics(p_q text, p_lim integer default 8)
returns setof public.clinics
language sql
stable
as $$
  select *
  from public.clinics
  where is_active
    and (
      name ilike '%' || p_q || '%'
      or address ilike '%' || p_q || '%'
      or similarity(name, p_q) > 0.25
    )
  order by
    (lower(name) like lower(p_q) || '%') desc,   -- prefix match first
    similarity(name, p_q) desc,
    name asc
  limit greatest(1, least(coalesce(p_lim, 8), 25));
$$;

-- ============================================================================
-- Rate limiter — fixed-window, atomic. Only the edge function (service role)
-- touches this; anon/authenticated are denied.
-- ============================================================================
create table if not exists public.rate_limits (
  bucket_key   text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket_key, window_start)
);

alter table public.rate_limits enable row level security;
-- (no policies => anon/authenticated get nothing; service_role bypasses RLS)

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

-- Atomically increment the current window bucket and report whether we are still
-- within p_limit. Returns true = allowed, false = over limit.
create or replace function public.rl_check(p_key text, p_limit integer, p_window_secs integer)
returns boolean
language plpgsql
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  if p_key is null or p_limit is null or p_window_secs is null or p_window_secs <= 0 then
    return true; -- fail-open on bad params; never block the app on a limiter bug
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_secs) * p_window_secs);

  insert into public.rate_limits (bucket_key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (bucket_key, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Keep the limiter internal to trusted (service-role) callers only.
revoke all on function public.rl_check(text, integer, integer) from public, anon, authenticated;
revoke all on table public.rate_limits from anon, authenticated;
