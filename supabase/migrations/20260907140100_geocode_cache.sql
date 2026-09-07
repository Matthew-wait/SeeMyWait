-- Phase 0 (cost-reduction plan): server-side geocode cache.
--
-- The `directory-search` edge function (Phase 2) writes here so repeat address
-- lookups never re-hit Nominatim / the US Census geocoder. This keeps us inside
-- those services' usage policies (Nominatim: ~1 req/s, cache required) and makes
-- the add-a-doctor flow instant on the second lookup of the same address.
--
-- A row with NULL latitude/longitude is a *negative* cache entry: we looked the
-- query up and got nothing, so don't ask again for a while.

create table if not exists public.geocode_cache (
  query_hash text primary key,            -- sha256 hex of the normalized query
  query text not null,                    -- normalized query text, for debugging
  latitude double precision,              -- NULL = no result (negative cache)
  longitude double precision,
  provider text,                          -- 'nominatim' | 'census' | 'manual' | 'none'
  fetched_at timestamptz not null default now()
);

create index if not exists geocode_cache_fetched_at_idx
  on public.geocode_cache (fetched_at);

-- RLS on, no policies: anon and authenticated clients get nothing. The edge
-- function reaches this table with the service role, which bypasses RLS.
alter table public.geocode_cache enable row level security;

comment on table public.geocode_cache is
  'Edge-function-only geocode result cache (service role bypasses RLS; no anon access). NULL lat/lng = negative cache.';
