# `medical-search` edge function

Directory backend after the Google Places → NPPES swap (cost-reduction plan,
Phase 2). No Google API key. Free upstreams:

| Upstream | Used for | Cost |
|---|---|---|
| [NPPES NPI Registry](https://npiregistry.cms.hhs.gov/api/) | provider/facility directory search | free, no key |
| [US Census one-line geocoder](https://geocoding.geo.census.gov/) | US street address → lat/lng | free, no key, no rate limit |
| [Nominatim](https://nominatim.openstreetmap.org/) | non-address geocode + reverse geocode; **fallback when Census is blocked/misses** | free, ~1 req/s — results are cached |
| [Photon](https://photon.komoot.io/) | address autocomplete (coords inline) | free |

Geocode results (including "no match") are cached in `public.geocode_cache` for
90 days, so repeat lookups never hit an upstream.

## Actions (all POST, JSON body)

| `action` | body | returns |
|---|---|---|
| `search` | `{ query, location?: {latitude,longitude}, deviceId? }` | `{ ok, results: (DbResult\|NpiResult)[], limited, degraded }` — DB-first, tops up from NPPES when DB has < 5 hits |
| `add` | `{ npi }` | `{ ok, existed?, clinic?, error? }` — idempotent insert into `clinics` keyed on `npi` |
| `geocode` | `{ query }` | `{ results:[{ formatted_address, geometry:{location:{lat,lng}}, place_id:null }], provider }` |
| `reverse` | `{ lat, lng }` | `{ address, placeId:null }` |
| `autocomplete` | `{ query, location? }` | `{ ok, predictions:[{ description, place_id:"geo:lat,lng", latitude, longitude }] }` |

`NpiResult` = `{ source:"npi", npi, name, address, latitude, longitude, specialty, phone }`.
`add` error codes: `lookup_failed`, `not_medical`, `permanently_closed`,
`no_coordinates`, `insert_failed` (same vocabulary the client already maps in
`src/lib/medical-search.ts`).

## Deploy

Requires the Phase 0 migrations applied first (`npi` column + `geocode_cache`).

```bash
npx supabase functions deploy medical-search
```

Env: the function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (both
auto-injected on hosted Supabase). Optional overrides:
`NPPES_API_BASE`, `NOMINATIM_BASE`, `PHOTON_BASE`, `GEOCODE_USER_AGENT`.

## Smoke test

```bash
BASE="https://<project-ref>.supabase.co/functions/v1/medical-search"
ANON="<VITE_SUPABASE_PUBLISHABLE_KEY>"

# geocode
curl -s "$BASE" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"action":"geocode","query":"1500 NW 12th Ave, Miami, FL 33136"}' | jq

# search (DB-first + NPPES top-up)
curl -s "$BASE" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"action":"search","query":"Blair","location":{"latitude":25.76,"longitude":-80.19}}' | jq

# add by NPI (idempotent — run twice, second returns existed:true)
curl -s "$BASE" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"action":"add","npi":"1295213833"}' | jq

# reverse
curl -s "$BASE" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"action":"reverse","lat":25.7617,"lng":-80.1918}' | jq

# autocomplete
curl -s "$BASE" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"action":"autocomplete","query":"1500 NW 12th Ave Miami"}' | jq
```

## Local run

```bash
npx supabase start                      # local DB + injected env
npx supabase functions serve medical-search --no-verify-jwt
```

## Notes / follow-ups

- `nppes.ts` holds the pure mapping logic and is unit-tested from
  `src/test/nppes.test.ts` (runs in vitest, no Deno needed).
- No per-device rate limiting yet (`limited` is always `false`). NPPES is free
  and keyless, so this is low priority; add a `deviceId` counter table if abuse
  shows up.
- `search` geocodes up to 6 NPPES candidates per cold query (parallel, Census
  first). Once a metro is seeded (`scripts/seed-nppes.ts`, Phase 5) the DB path
  usually satisfies the ≥ 5 threshold and NPPES is never called.
