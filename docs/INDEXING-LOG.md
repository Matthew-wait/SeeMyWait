# Database indexing log

MUST READ for any new agent before touching indexes or the clinics table.

## Indexes on public.clinics

| Index | Definition | Status | Built |
|---|---|---|---|
| clinics_pkey | (id) | original | — |
| clinics_npi_key | (npi) unique | original | — |
| clinics_unique_name_address_lower | (lower(trim(name)), lower(trim(address))) unique | original | — |
| clinics_name_trgm | gin (name gin_trgm_ops) | original | — |
| clinics_address_trgm | gin (address gin_trgm_ops) | original | — |
| clinics_state_city_idx | (state, city) | original | — |
| clinics_postal_code_idx | (postal_code) | original | — |
| clinics_geog_gist_idx | gist (geog) | added for nearby search | 2026-09-28 |
| clinics_fl_city_name_idx | (city, name) WHERE state = 'FL' | added for Florida listing | 2026-10-05 |

Dropped (duplicates): idx_clinics_location and clinics_lat_lng_idx, both (latitude, longitude). Backup DDL in supabase/dropped-indexes-backup.sql.

## Florida index: clinics_fl_city_name_idx

- Purpose: Doctors tab listing for a city (default Miami), sorted by name, and the A–Z filter.
- Build SQL (run once, outside a transaction):
  `create index concurrently if not exists clinics_fl_city_name_idx on public.clinics (city, name) where state = 'FL';`
- Why a partial index: Florida is the main test area now. It covers ~590K rows, so it builds in ~50 seconds and stays small.
- Result: Miami first page went from ~7.2 s to ~2.3 s (includes network). Plan confirmed: Index Scan on clinics_fl_city_name_idx.
- Not in a migration file: `supabase db push` runs migrations inside a transaction, and CREATE INDEX CONCURRENTLY cannot run there. Re-create manually if the database is rebuilt.

## Planned

- Other states: same pattern, one partial index per state, built when the NY import and Geo backfill are finished. Example for New York: `create index concurrently if not exists clinics_ny_city_name_idx on public.clinics (city, name) where state = 'NY';`
- Or a single full index on (state, city, name) after the import is done. This is the long-term option.
- Name search (trigram) and NPI (unique) are already indexed; no change needed.

## Rules

- Always use CONCURRENTLY on this live database.
- Check disk headroom (Supabase dashboard: Database → Disk) before a large build.
- After a big build, run `analyze public.clinics;` so the planner uses the index.
- Record every index here, with its build date and reason.
