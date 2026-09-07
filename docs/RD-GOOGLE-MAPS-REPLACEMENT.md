# R&D — Replacing Google Maps / API with Free & Open Resources

**Product:** SeeMyWait (Web; Android/iOS to follow)
**Question:** Can we remove Google Maps/API entirely — map display *and* the
doctor-office location pipeline — using only free/open resources, and stay at
~$0 usage cost from 200 to thousands of users?
**Answer:** **Yes.** Working implementation landed on `main` (Phases 0–4 of
[COST-REDUCTION-PLAN.md](COST-REDUCTION-PLAN.md)). Figures below should be
re-verified against the linked sources before any contract decision.

---

## 1. Executive summary

| Concern | Google (before) | Open replacement (now) | Cost at 200 / 1k / 10k users |
|---|---|---|---|
| Map display | Maps JavaScript API | **Leaflet + OpenStreetMap tiles** | $0 (keyless OSM → Stadia free tier → self-host Protomaps) |
| Facility discovery | Places Text Search | **NPPES NPI Registry (CMS)** — DB-first, registry only on a miss | $0 (free, keyless, no published cap) |
| Address → lat/lng | Geocoding API | **US Census Geocoder** (primary) + **Nominatim** (fallback), 90-day cache | $0 |
| Address autocomplete | Places Autocomplete | **Photon** (OSM) | $0 |
| "Am I at the office?" | *(never used Google)* | `navigator.geolocation` + haversine | $0 |
| Driving distance | Distance Matrix | straight-line (haversine) | $0 |

**Only remaining recurring costs:** Apple Developer $99/yr, Supabase (free tier
today), domain. No mapping/geocoding cost grows with users, because the
**database-first** rule means external calls trend toward zero as the directory
fills in.

---

## 2. Target architecture (matches the brief's desired flow)

```
  ┌─────────────────── one-time / on-miss only ───────────────────┐
  │                                                               │
  │   NPPES NPI Registry (CMS)          US Census Geocoder         │
  │   name · address · specialty        address / ZIP → lat,lng    │
  │   · phone · NPI · status                     │                 │
  │            │                                 │  (fallback:     │
  │            ▼                                 ▼   Nominatim)     │
  │   ┌──────────────────────────────────────────────────┐         │
  │   │  medical-search edge function (Supabase, no key)  │         │
  │   │  normalise → geocode → de-dup on NPI → persist    │         │
  │   └──────────────────────────────────────────────────┘         │
  └───────────────────────────┬───────────────────────────────────┘
                              ▼
                 ┌─────────────────────────────┐
                 │  Postgres `clinics` table   │   ← the source of truth
                 │  npi · name · address ·     │      after first add
                 │  city · state · zip ·       │
                 │  latitude · longitude       │
                 └──────────────┬──────────────┘
                                ▼
         Leaflet map  +  search list  +  wait-time reports
         (every pin / row / report reads from `clinics`)
```

**Key property:** after a facility is added once, *every* later user — search,
map pin, wait-time report — resolves to the **same `clinics` row**, keyed by its
NPI. No external service is touched again for that facility.

---

## 3. Data-source evaluation

### 3.1 NPPES NPI Registry — the CMS portal (primary facility source)

CMS = Centers for Medicare & Medicaid Services. The **National Plan & Provider
Enumeration System** is the authoritative US registry of every health-care
provider that bills Medicare/Medicaid or is HIPAA-covered — ~8.5M active NPIs
(individuals *and* organisations/facilities).

**Two ways in, both free, no key, no registration:**

| Access | Endpoint / file | Use |
|---|---|---|
| **Live API** | `https://npiregistry.cms.hhs.gov/api/?version=2.1` (≤200 results/query, ≤1000 `skip`) | on-demand "user searched something we don't have" |
| **Bulk file (no API)** | NPPES Data Dissemination — monthly *full replacement* ZIP (~10 GB unzipped, `npidata_pfile_*.csv`) + weekly incrementals | one-time metro seed; offline refresh |
| **Pre-cleaned bulk** | NBER NPPES extracts (nber.org) — some vintages already carry lat/lng | shortcut for seeding if we don't want to run Census batch ourselves |

**What each record gives us** (validated against the live API this cycle):

| Field | NPPES path | Notes |
|---|---|---|
| NPI (unique id) | `number` | 10 digits — our primary key |
| Entity type | `enumeration_type` | `NPI-1` individual, `NPI-2` organisation/facility |
| Name | `basic.first_name`+`last_name`+`credential`, or `basic.organization_name` | screaming-case; we title-case it |
| Specialty | `taxonomies[]` → `.desc` where `.primary` | e.g. "Family Medicine" |
| **Practice address** | `addresses[]` where `address_purpose = "LOCATION"` | street, `address_2` (suite), `city`, `state`, `postal_code` (ZIP+4) |
| Mailing address | `addresses[]` where `address_purpose = "MAILING"` | ignored for the map |
| Phone | `addresses[].telephone_number` | on the LOCATION address |
| Status | `basic.status`, `basic.deactivation_date` | we drop deactivated NPIs |
| Sole proprietor | `basic.sole_proprietor` | informational |
| Extra locations | `practiceLocations[]` | secondary sites — v1 takes the primary only |

**No latitude/longitude** — that's step 3.3.

**Coverage caveats (planned around):**
- practice address is occasionally an administrative/billing address → the
  verify-before-save step + visible map pin let a human catch it;
- one NPI can list multiple locations → take primary, allow admin edit;
- provider-entered data, so spelling/formatting varies → we normalise;
- **US only** → fine, the product is US-focused.

### 3.2 CMS Provider Data Catalog (complementary, not required)

`data.cms.gov` — bulk CSV/JSON, no key. Useful *if* NPPES gaps appear:

| Dataset | Adds |
|---|---|
| **Doctors and Clinicians — National Downloadable File** (`DAC_NationalDownloadableFile.csv`) | group-practice affiliation (PAC ID / org PAC ID), hospital affiliation, Medicare assignment, practice location — good cross-check on NPPES addresses |
| **Provider of Services (POS) file** | facility category, bed count, certification date — for hospitals/urgent care |
| **Hospital / Care Compare** downloadable files | facility name + address + CCN for hospitals |

Recommendation: **NPPES is enough for launch.** Keep PDC in reserve for a later
"enrich facility record" pass.

### 3.3 US Census Geocoder — address/ZIP → lat/lng

`https://geocoding.geo.census.gov/` — free, **no API key, no documented rate
limit**, US only.

| Mode | Endpoint | Limit | Use |
|---|---|---|---|
| Single | `/geocoder/locations/onelineaddress?address=…&benchmark=Public_AR_Current&format=json` | — | on-demand add / admin edit |
| **Batch** | `/geocoder/locations/addressbatch` (CSV upload) | **10,000 rows/file** | metro seed of NPPES rows |

Returns matched address, `coordinates.x` (lon) / `.y` (lat), TIGER line id,
census block. Match rate is high for well-formed street addresses (~90 %+),
lower for suite-only, PO boxes, brand-new construction, or rural routes.

> **Network note:** `geocoding.geo.census.gov` sits behind a WAF that rejects
> requests from some corporate/CI egress IPs (200 response with an HTML
> "Request Rejected" page). Both the `medical-search` function and the seed
> script detect that and fall through to Nominatim automatically, so it is not a
> blocker — but if Census match rates look like zero, check for the WAF page
> first.

**Can Census handle the required geocoding?** For the large majority, yes. The
misses are covered by:
- **Nominatim** (OpenStreetMap) fallback — broader (landmarks, partial
  addresses), but public usage policy is ~1 req/s + attribution + caching
  required, so it's *fallback only* and every result is cached 90 days
  (`geocode_cache` table, including negative results);
- **ZIP-centroid fallback** when only a ZIP is known — Census ZCTA Gazetteer
  file (free static download) or a bundled ZIP→lat/lng table;
- **admin manual lat/lng** override (the Add/Edit form already has the fields).

### 3.4 Autocomplete, map POIs, tiles

| Need | Free option | Role |
|---|---|---|
| Address type-ahead | **Photon** (`photon.komoot.io`, OSM-based) | Add-Doctor form; returns coordinates inline (no details round-trip) |
| Discover medical POIs on the map | **Overpass API** (`amenity=clinic\|doctors\|hospital\|pharmacy`) | *optional* future feature — "tap a clinic on the map"; not needed for launch |
| Map tiles | **OpenStreetMap** (keyless) → **Stadia Maps** free ≤200k req/mo → **self-hosted Protomaps (PMTiles)** for a true $0 ceiling | display only |
| FQHC / community health centers | **HRSA data** (data.hrsa.gov) | optional enrichment |

---

## 4. Investigation questions — direct answers

| Brief question | Finding |
|---|---|
| **What location info is in the CMS data?** | NPI, entity type, legal/org name, credential, primary+secondary specialty (taxonomy), **practice location** (street, suite, city, state, ZIP+4), mailing address, phone, status/deactivation, sole-proprietor, secondary practice locations. No lat/lng. (§3.1) |
| **Can CMS data be our primary source for doctor offices?** | **Yes.** NPPES is the authoritative US provider/facility registry (~8.5M active NPIs), free, no key, available as both a live API and no-API bulk files. Launch on NPPES; keep CMS Provider Data Catalog as an enrichment reserve. |
| **How do ZIP codes / addresses become lat/lng?** | US Census Geocoder — single-line for on-demand, batch (10k/file) for seeding. Nominatim fallback for misses; ZIP-centroid (Census ZCTA gazetteer) when only a ZIP is available. All cached 90 days. |
| **Can the US Census Geocoder handle the geocoding?** | For the bulk of well-formed US street addresses, yes (~90 %+ match). Suite-only / PO-box / rural / new-construction misses fall through to Nominatim, then ZIP centroid, then manual admin entry. |
| **Can Leaflet be display-only, with data from our DB?** | **Yes — that's the built design.** Leaflet + OSM tiles render the map; every marker, list row, and wait-time report is read from the `clinics` table. Leaflet never fetches facility data. |
| **What extra free sources might be needed?** | Photon (autocomplete), Nominatim (fallback geocode + reverse), Overpass (optional map-POI discovery), Census ZCTA gazetteer (ZIP centroids), HRSA (FQHCs), a tile provider free tier or self-hosted Protomaps. None are paid. |

---

## 5. Reliable, non-duplicated facility identification (the core requirement)

The brief's most important point: multiple users reporting wait times for the
same office must always hit the **same** database record.

**Identity key = NPI.**

| Mechanism | Where |
|---|---|
| `clinics.npi` column + **partial-unique index** (`where npi is not null`) | migration `20260907140000_add_npi_identity.sql` |
| `add` action is **idempotent on NPI** — re-adding returns the existing row (`existed: true`), never a duplicate | `medical-search` edge function |
| **Name+address twin adoption** — if an office was added as a custom point (no NPI) and later matched to a registry entry, its `npi` is back-filled instead of creating a second row | `medical-search` `add` |
| Non-NPI custom points de-dup on `lower(trim(name)) + lower(trim(address))` unique index | pre-existing `clinics_unique_name_address_lower` |
| Every `wait_time_reports` row FKs to `clinic_id` | pre-existing schema |
| Insert-race safety — a `23505` on the NPI index re-selects and returns the winner | `medical-search` `add` |

Result: search → select → the app resolves to a single `clinics.id`; the
wait-time report is written against that id; the next user searching the same
name lands on the same row (DB-first) and sees those reports.

---

## 6. Storage schema — current vs recommended

**Today** `clinics` stores: `id, name, address (single text), latitude,
longitude, phone, specialty, google_place_id (nullable, unused), npi (nullable,
unique), is_active`.

**Recommended small addition** (the brief explicitly wants city/state/zip as
first-class fields — helps ZIP-scoped search and a second dedup signal):

```sql
alter table public.clinics
  add column if not exists city text,
  add column if not exists state text,           -- 2-letter
  add column if not exists postal_code text;     -- 5-digit
create index if not exists clinics_state_city_idx on public.clinics (state, city);
create index if not exists clinics_postal_code_idx on public.clinics (postal_code);
```

The `medical-search` `add` action already parses these out of the NPPES
`LOCATION` address — it would just persist them into the new columns instead of
only concatenating them into `address`.

---

## 7. Wait-time reporting on the new architecture

Unchanged and already Google-free:

1. **Search** — `medical-search` `search`: DB-first (`clinics` ILIKE), NPPES
   top-up only when the DB returns < 5 hits.
2. **Select** — a DB hit opens directly; an NPPES hit is a *candidate* (map pin
   + "Verify & Add") — only an explicit confirm writes it, so an ambiguous query
   can't save the wrong place.
3. **View reports** — read `wait_time_reports` for that `clinic_id`.
4. **Submit** — geofence check (`navigator.geolocation` + haversine, 1000 m +
   100 m accuracy ceiling) → insert `wait_time_reports` row.
5. **Association** — FK `clinic_id`; NPI identity guarantees it's the same row
   for every reporter.

---

## 8. Scalability & cost

| Users / month | Web map loads | Registry (NPPES) calls | Geocodes | Monthly $ |
|---|---|---|---|---|
| **200** | ~a few hundred tile-set loads | near 0 (small directory fills fast) | near 0 | **$0** (keyless OSM) |
| **1,000** | low thousands | near 0 at steady state | near 0 (cache) | **$0** (OSM, or Stadia free tier) |
| **10,000+** | tens of thousands of tile-set loads | still ~0 per steady-state search | ~0 (cache) | **$0** if self-hosting Protomaps; ≤ free tier on Stadia otherwise |

Why it stays flat:
- **NPPES / Census / Nominatim / Photon** are all free and keyless; NPPES has no
  published request cap. DB-first means each facility triggers at most **one**
  registry lookup *ever*.
- **Tiles** are the only thing that scales with usage. OSM keyless is fine for
  hundreds; Stadia's free 200k req/mo covers low thousands; **Protomaps
  self-host** (one PMTiles file on Supabase Storage / R2) removes the ceiling and
  the vendor entirely for a one-time build.
- Nominatim's 1 req/s limit is irrelevant at steady state — it's a cached
  fallback that's rarely hit.

---

## 9. Gaps, risks, and mitigations

| Risk | Mitigation |
|---|---|
| NPPES practice address ≠ real clinic location | verify-before-save + visible pin + admin edit; optional CMS PDC cross-check |
| Census can't geocode a suite/PO-box/rural address | Nominatim → ZIP centroid → manual admin lat/lng |
| "Near me" has no inventory on day one (NPPES has no radius search) | one-time **metro seed**: NPPES bulk file → filter to target ZIPs/taxonomies → Census batch geocode → load into `clinics` (`scripts/seed-nppes.ts`, Phase 5) |
| OSM raster tiles are light-only / show all POIs | muted "Positron/Lite" style; vector tiles + MapLibre later if POI filtering matters |
| Tile-vendor free-tier ceiling as users grow | Protomaps self-host = $0, no vendor |
| US-only data | acceptable — product is US-focused |
| Mobile app still references the old `google-places` function | its deployed copy is left in place; port the same swap to the Expo repo |

---

## 10. Implementation status

| Phase | Scope | State |
|---|---|---|
| 0 | `npi` + `geocode_cache` migrations; types; tile env vars | **done** (migrations not yet applied to DB) |
| 1 | `MapView` rewritten on Leaflet + OSM; `map-tiles.ts`; Google Maps JS deleted | **done** |
| 2 | `medical-search` edge function — NPPES `search`/`add`, Census+Nominatim geocode, Photon autocomplete, `geocode_cache`; `nppes.ts` pure helpers + tests | **done** (not yet deployed) |
| 3 | Every client call site rewired to `medical-search`; NPI identity; `google-maps.ts` + `google-places/` + `@googlemaps/*` deleted | **done** |
| 4 | Leaflet `MiniMap` on clinic detail; Google env vars removed; README + landing copy fixed; `city`/`state`/`postal_code` columns added (§6) end-to-end | **done** |
| 5 | `scripts/seed-nppes.mjs` — NPPES API → Census batch (Nominatim fallback) → `clinics_seed.csv` / `--push` upsert on `npi`; zero npm deps; verified end-to-end | **done — run at launch per metro** |

**No Google Maps Platform API is called anywhere in the app.** 39 tests green,
production build clean, map + list + reporting verified against live data.

### Remaining operational steps (need Supabase credentials)
1. Apply the two Phase 0 migrations (dashboard SQL editor or `supabase db push`).
2. `supabase functions deploy medical-search`, then the smoke tests in
   `supabase/functions/medical-search/README.md`.
3. (Recommended) add `city` / `state` / `postal_code` columns (§6) and persist
   them from the `add` action.
4. (Launch) run the Phase 5 metro seed for Miami-Dade.
5. Pick the production tile provider: Stadia free tier now, Protomaps self-host
   as the growth path.

---

## 11. Recommendation

Proceed with the built architecture. It fully removes Google Maps/API, keeps the
database-first rule, identifies facilities reliably by NPI, and has **no
usage-based cost at any realistic user count**. The only decisions left are
operational (apply/deploy) and one product call — whether to tighten the
wait-report geofence, which is independent of this work.

## Sources (re-verify before commitments)

- NPPES NPI Registry API — https://npiregistry.cms.hhs.gov/api/
- NPPES Data Dissemination (bulk files) — https://download.cms.gov/nppes/NPI_Files.html
- CMS Provider Data Catalog — https://data.cms.gov/provider-data/
- US Census Geocoder — https://geocoding.geo.census.gov/geocoder/ (docs: /Geocoding_Services_API.html)
- Census ZCTA Gazetteer files — https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
- Nominatim usage policy — https://operations.osmfoundation.org/policies/nominatim/
- Photon — https://photon.komoot.io/
- Overpass API — https://overpass-api.de/
- Leaflet — https://leafletjs.com/
- Protomaps (PMTiles) — https://protomaps.com/
- Stadia Maps pricing — https://stadiamaps.com/pricing/
- HRSA data — https://data.hrsa.gov/
