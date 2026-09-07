# SeeMyWait — Plan to Remove Google Maps Platform Cost

**Status:** Proposal — not implemented. Prepared 7 Sep 2026.
**Goal:** Take recurring map/geo API cost to ~$0 by removing Google from the
directory-data and map-tile pipeline, keeping only device GPS + our own stored
coordinates for the "patient is at the office" check.

This plan is scoped to the **web app** in this repo. The mobile (Expo) app is a
separate codebase and would need the equivalent changes; §11 lists what carries
over.

---

## 1. TL;DR recommendation

| Concern | Today (Google) | Proposed | Ongoing cost |
|---|---|---|---|
| Map tiles / widget | Maps JavaScript API ($7 / 1k loads) | **Leaflet + OpenStreetMap tiles** (Stadia Maps free tier now → self-hosted Protomaps later) | $0 |
| "Am I at the office?" GPS check | *(already Google-free)* | No change — `navigator.geolocation` + haversine | $0 |
| Doctor directory search | Places Text Search ($32 / 1k) + Place Details ($17 / 1k) | **NPPES NPI Registry** (CMS, free, no key) via our edge function | $0 |
| Geocoding (address → lat/lng) | Geocoding API ($5 / 1k) | **US Census Batch Geocoder** (bulk, free) + **Nominatim** (on-demand, free) | $0 |
| Address autocomplete (Add-Doctor form) | Places Autocomplete ($2.83 / 1k) | **Photon** / Nominatim search, or drop it (NPPES pick replaces most of it) | $0 |
| Route distance in the list | Distance Matrix → already OSRM fallback | **Straight-line (haversine)** for v1; OSRM optional | $0 |
| Clinic detail mini-map | `maps.google.com/…&output=embed` iframe (keyless, already free) | Swap to a small Leaflet map for consistency (low priority) | $0 |

**Net effect:** the `VITE_GOOGLE_MAPS_JS_API_KEY` and the server
`GOOGLE_MAPS_API_KEY` / `GOOGLE_GEOCODE_API_KEY` become optional/removable. Only
non-Google costs remain (Apple $99/yr, Supabase free tier, domain, Resend).

**Effort:** ~5–8 working days for the web app (§10). The map rewrite and the
NPPES search backend are the two large pieces.

---

## 2. Where Google is used today (audit)

| # | File | Call | Google SKU | Notes |
|---|---|---|---|---|
| 1 | `src/lib/google-maps.ts` | Maps JS loader (`@googlemaps/js-api-loader`), `places` + `geocoding` libs | Maps JS (Essentials) | Loaded once; every web map view is a billable **map load** |
| 2 | `src/components/map/MapView.tsx` | `google.maps.Map`, `Marker`, `Circle`, `InfoWindow`, POI `click` w/ `placeId`, `MEDICAL_ONLY_MAP_STYLE` | Maps JS | The whole map. Also the only place POI-tap-to-add works |
| 3 | `src/lib/google-places-client.ts` | `AutocompleteService`, `Geocoder` (client), `details` edge action | Places Autocomplete, Geocoding, Place Details (Pro) | Hybrid: server-first, client fallback |
| 4 | `supabase/functions/google-places/index.ts` | `textsearch`, `nearbysearch`, `details`, `geocode`, `autocomplete`, `distancematrix`, `import` | Text Search + Details (Pro), Geocoding, Autocomplete | Server proxy holding the server key. **Has a bug** in the `search` action (undefined `originsParam` / `destinationCoords`) |
| 5 | `src/lib/medical-search.ts` + `src/hooks/use-medical-search.ts` | `invoke("medical-search", …)` for `search` / `add` | Text Search + Details (Pro) | **The `medical-search` edge function is NOT in this repo** — search+add is either deployed out-of-band or currently broken. Treat this as a greenfield rebuild |
| 6 | `src/pages/Index.tsx` | `invoke("google-places", { action: "distance_matrix" })` (chunked) + client OSRM fallback | Distance Matrix (or $0 via OSRM) | Drives the "X mi away" sort in the list |
| 7 | `src/pages/AdminDashboard.tsx` | `autocomplete`, `details`, `geocode` (add/edit/CSV/approve flows), `distance_matrix`, POI tap | Autocomplete, Geocoding, Details | Admin add/import paths |
| 8 | `src/pages/SuggestClinic.tsx` | `autocompletePlaces`, `getPlaceDetails`, `resolveCoordinatesFromAddress` (geocode edge + Nominatim fallback) | Autocomplete, Details, Geocoding | Public "Add a Doctor" form; **requires a real Google `place_id`** to save unless exact coords typed |
| 9 | `src/pages/ClinicDetail.tsx` | `<iframe src="maps.google.com/maps?…&output=embed">` | **none** — keyless embed, not billed | Safe to keep; replace only for consistency/privacy |
| 10 | `src/index.css` | `fonts.googleapis.com` (webfonts) | none | Not Maps Platform; ignore (or self-host fonts separately) |

**Already Google-free and correct — no change needed:**
`src/lib/geolocation.ts` — `getCurrentPosition` / `getFreshPosition` use
`navigator.geolocation`; `getDistanceMeters` / `isWithinRadius` are haversine.
The client's point 2 ("GPS verify never needed Google") is **already how it
works**. `report-geofence.ts` (1000 m geofence, 100 m accuracy ceiling) is pure
math.

---

## 3. Target architecture

```
                       ┌─────────────────────────────────────────┐
Browser (Leaflet)      │  Supabase Edge Function: directory-search │
  map tiles  ──────────┼─► (rename of google-places)              │
   Stadia/OSM/Protomaps│    action: search   → NPPES NPI Registry  │
                       │    action: geocode  → Census / Nominatim  │
  search box  ─────────┼─► action: reverse  → Nominatim            │
   (DB-first, then      │    action: autocomplete → Photon         │
    NPPES candidates)   │    (no Google key required)              │
                       └─────────────────────────────────────────┘
  GPS check  ──────────►  navigator.geolocation + haversine (in-browser, unchanged)

  clinics / wait_time_reports  ──►  Supabase Postgres (unchanged schema + `npi` column)
```

Principles kept from the current design:
- **DB-first search.** Query our `clinics` table first; only reach out to NPPES
  when local results are thin. Every saved office reduces future external calls.
- **Verify-before-save.** An NPPES hit is a *candidate* (pin + `VerifyPlaceCard`);
  only an explicit "Verify & Add" writes it. Re-use the existing component.
- **Coordinates are mandatory** for every saved row; NPPES gives an address only,
  so geocoding runs at add-time (once) and the result is stored.

---

## 4. Component plan

### 4.1 Map tiles — Google Maps JS → Leaflet + OSM

**What changes:** `src/components/map/MapView.tsx` is rewritten on Leaflet.
`leaflet` + `@types/leaflet` are **already in `package.json`**, and a full
Leaflet `MapView` existed before commit `d0aaa38` (see `git show
114290f:src/components/map/MapView.tsx`) — use it as the skeleton, then re-add the
features the Google version introduced.

Feature parity checklist for the rewrite:

| Feature | Google impl | Leaflet impl |
|---|---|---|
| Tier-coloured teardrop pins | `pinIcon()` SVG data-URI `Icon` | `L.divIcon` with the same SVG (old code already had `createPinHtml`) |
| Rebuild markers only on set/colour change | `prevClinicKeyRef` diff | keep identical logic with an `L.layerGroup` |
| User dot + nearby-radius circle | `Marker` + `Circle` | `L.circleMarker` + `L.circle` |
| Candidate pin (verify) | blue `Marker`, `setCenter`+`setZoom` | `L.marker` + `map.setView` |
| Pending-point pin + coordinate tooltip | `Marker` + styled `InfoWindow` | `L.marker` + `L.tooltip`/`L.popup` (old code had `.search-count-tooltip` styling to reuse) |
| Imperative recenter (`centerOn`) | `setCenter`/`setZoom` | `map.setView` |
| Zoom controls | custom `MapZoomControls` (kept) | unchanged — call `map.zoomIn()/zoomOut()` |
| Tap empty point → "Add here" | `map.click` w/o `placeId` | `map.on("click")` |
| **Tap medical POI → auto-add** | `iconEvent.placeId` from Google POI | **Dropped.** Raster OSM tiles have no clickable POI objects. The "tap empty point → reverse-geocode → prefill" path covers the intent. (Vector tiles + MapLibre could restore clickable POIs later; out of scope.) |
| Medical-only POI styling | `MEDICAL_ONLY_MAP_STYLE` | **Dropped.** Raster tiles bake in all labels. Acceptable; a Positron/"lite" tile style keeps it clean. |
| Non-finite coord guards | `hasValidCoords` | unchanged (comment in `geolocation.ts` already says "safe for Leaflet") |
| Graceful "map unavailable" state | key-missing branch | tile-load-error branch |

**Delete:** `src/lib/google-maps.ts` (or reduce to a `tiles.ts` with the tile URL
+ attribution). Remove `@googlemaps/js-api-loader` and `@types/google.maps` from
`package.json`.

**Callers to touch:** `Index.tsx` and `AdminDashboard.tsx` pass
`onPoiClick`/`candidate`/`pendingPoint` — keep the props, drop `onPoiClick`
wiring (or leave it unused). `import "leaflet/dist/leaflet.css"` goes in `MapView`
or `main.tsx`.

### 4.2 Tile provider — pick one

| Option | Cost | Key? | Commercial ToS | Notes |
|---|---|---|---|---|
| **OSM standard** (`tile.openstreetmap.org`) | $0 | no | Discouraged for heavy/commercial apps; can be throttled | Fine as emergency fallback, not as primary at scale |
| **Stadia Maps** | Free ≤ 200k req/mo, then paid | domain allowlist (no CC) | Explicitly allows commercial use within limits | **Recommended for Phase 1.** Alto/Outdoors/Positron styles, raster + vector |
| **MapTiler** | Free tier (credits) | key | OK | Similar; slightly stingier free tier |
| **Carto basemaps** | Free for low volume | no key for raster | OK | "Positron"/"Dark Matter" look clean and medical-neutral |
| **Protomaps (self-host PMTiles)** | **$0 forever**, one-time build | no | Yours | **Recommended Phase 2.** Build a PMTiles extract for the coverage area (Florida first, or US), host the single file on Supabase Storage / Cloudflare R2 / Vercel Blob, render with `protomaps-leaflet` (Leaflet) or MapLibre GL. No per-request cost, no rate limit. Trade-off: heavier client lib, manual extract refresh (~quarterly) |

**Recommendation:** ship Phase 1 on **Stadia Maps** (fast, keyed to domain, no
credit card, generous). Move to **Protomaps self-host** if monthly tile requests
approach the free ceiling — that is the true $0 ceiling with no vendor.

New env: `VITE_MAP_TILE_URL`, `VITE_MAP_TILE_ATTRIBUTION`, optional
`VITE_MAP_TILE_KEY`.

### 4.3 GPS verification — no change

Nothing to do. Document in the code review that this path is already
Google-free. Optionally tighten: `report-geofence.ts` geofence is **1000 m**
while the landing page and `SuggestClinic` copy say "50–100 m" / "verify via
Google Maps". Align the copy (and, if the client wants, tighten the geofence).

### 4.4 Directory data — Google Places → NPPES NPI Registry

**New edge function** `supabase/functions/directory-search/index.ts` (rename +
rework of `google-places`; keep `verify_jwt = false`).

`action: "search"` — query params to NPPES `https://npiregistry.cms.hhs.gov/api/`
(`version=2.1`, `limit` ≤ 200):
- name search → `first_name` / `last_name` / `organization_name` (wildcard `*`)
- specialty → `taxonomy_description`
- locality → `city`, `state`, `postal_code`
- filter `enumeration_type` and drop entries with a de-activation date

Map each NPPES result → our candidate shape:
```
{ source: "npi", npi, name, address (practice location), phone, specialty (primary taxonomy), latitude: null, longitude: null }
```
Then geocode the practice address (§4.5) **inside the edge function** so the
candidate returned to the client already has coordinates (or is dropped if
un-geocodable — same guard as today's `no_coordinates`).

`action: "add"` — accept an `npi` (or a raw candidate), re-geocode if needed,
insert into `clinics` with `npi` set. Idempotent on `npi` (see §5). This replaces
`addMedicalPlace(placeId)`.

**Client changes:**
- `src/lib/medical-search.ts`: `GoogleSearchResult` → `NpiSearchResult`
  (`place_id` → `npi`); `searchMedicalPlaces` / `addMedicalPlace` call
  `directory-search`; `isGooglePlaceId` → `isNpi` (10-digit Luhn); drop
  `viewOnGoogleMapsUrl` "Powered by Google" (replace with an NPPES / OSM link or
  nothing).
- `src/hooks/use-medical-search.ts`: unchanged (consumes the same envelope).
- `src/components/map/VerifyPlaceCard.tsx`: swap the "View on Google Maps" button
  for "View on OpenStreetMap" (or a plain address line); remove the "Powered by
  Google" caption.
- `src/pages/Index.tsx` / `AdminDashboard.tsx`: `handlePoiClick` /
  `handleMapPoiClick` become no-ops or are removed (no POI taps on raster tiles);
  everything else (`handleSelectResult`, verify, prefill) stays.

### 4.5 Geocoding — Google Geocoding → Census + Nominatim

Two distinct needs:

| Need | Where | Replacement |
|---|---|---|
| **On-demand single** (add-doctor submit, "Add here" reverse-geocode, admin edit) | `SuggestClinic.tsx`, `AdminDashboard.tsx`, `google-places-client.ts` | **Nominatim** (`nominatim.openstreetmap.org`) via the edge function only (server sets `User-Agent`, caches results in a small `geocode_cache` table, respects 1 req/sec). US Census single-line geocoder as a second try |
| **Bulk** (seed the directory from an NPPES extract, admin CSV import) | one-off script + `CsvUploadDialog` | **US Census Bureau Batch Geocoder** — free, US-only, up to 10,000 addresses per file, returns lat/lng + census block. Perfect for NPPES rows |

`SuggestClinic.tsx` already has a Nominatim fallback inside
`resolveCoordinatesFromAddress` — promote it to primary and delete the Google
`geocode` branch. Remove the "must have a Google `place_id`" gate
(`PLACE_ID_REQUIRED`) — replace with "must have coordinates" (already enforced) +
optional `npi`.

### 4.6 Address autocomplete — Google Places Autocomplete → Photon / drop

`google-places-client.ts::autocompletePlaces` and the dropdowns in
`SuggestClinic.tsx` / `AdminDashboard.tsx`:
- **Preferred:** wire the "Add a Doctor" flow to **NPPES search first** (user
  picks a real provider → address + specialty + phone auto-fill, geocode on
  select). This removes most of the need for freeform address autocomplete.
- **Freeform fallback:** **Photon** (`photon.komoot.io`, free, OSM-based, built
  for type-ahead) or Nominatim `search`, proxied through the edge function with
  debounce + cache. Bias by the user's location (`lat`/`lon`/`zoom` params).
- Delete the client-side `AutocompleteService` path and the
  `serverAutocompleteAvailable` probe.

### 4.7 Route distance — Distance Matrix → straight-line

`use-clinics.ts` already computes `distance` (haversine miles) and sorts by it.
`Index.tsx` layers on `routeDistanceByClinicId` from the `distance_matrix` edge
action with an OSRM fallback.

**v1:** delete the `distance_matrix` fetch effect in `Index.tsx`; sort and label
purely on `distance` (straight-line). Remove `routeDistance` /
`routeDistanceSource` from `ClinicWithWaitTime`, `ClinicListPanel`,
`AdminDashboard`. Simplest, zero cost, no external dependency.

**Optional later:** keep an OSRM call (self-hosted or the public demo server,
which forbids heavy use) for a "driving distance" nicety. Not worth it for
launch.

### 4.8 Clinic detail mini-map

`ClinicDetail.tsx::GoogleMapEmbed` uses the **keyless** `maps.google.com/maps?
…&output=embed` iframe — this is **not billed** and needs no API key. It can stay
as-is. For consistency (and to drop the Google dependency entirely) replace it
with a small non-interactive Leaflet map centred on the clinic + an "Open in
Maps" link (can point at OSM or Google — a plain URL, not the API). Low priority.

---

## 5. Data-model changes

Migration `supabase/migrations/<ts>_add_npi_identity.sql`:

```sql
alter table public.clinics add column if not exists npi text;
create unique index if not exists clinics_npi_key
  on public.clinics (npi) where npi is not null;   -- partial: many rows have no NPI

-- keep google_place_id column for backward-compat; stop requiring it
alter table public.clinic_suggestions add column if not exists npi text;
```

- **Identity key for dedup** becomes `npi` when present, else the existing
  `lower(trim(name)) + lower(trim(address))` unique index (unchanged). Update
  `src/lib/clinic-dedup.ts` to prefer `npi`.
- `google_place_id` stays nullable and is simply no longer written. Existing rows
  are untouched. `viewOnGoogleMapsUrl` can still use it opportunistically if
  present, but nothing depends on it.
- `types.ts` (generated) regenerated after the migration.

---

## 6. Edge-function changes

1. **Rename** `google-places` → `directory-search` (update all
   `invoke("google-places" | "medical-search", …)` call sites; keep a thin
   `google-places` alias for one release if the mobile app still calls it).
2. **Create** the real `medical-search` behaviour inside it: `search` (NPPES),
   `add` (insert w/ `npi`), `geocode`, `reverse`, `autocomplete`.
3. **Fix** the existing bug: the `search` action references undefined
   `originsParam` / `destinationCoords` / `googleElements` (pasted from
   `distance_matrix`) — it throws today.
4. **Delete** `nearbysearch`, `distancematrix`, `import` (Google), and the
   `textsearch` Google path. Optionally keep a `GOOGLE_FALLBACK=true` env flag
   that re-enables Google geocode only, for emergencies.
5. Add a `geocode_cache` table (address hash → lat/lng, `fetched_at`) so repeat
   geocodes never re-hit Nominatim; enforce a server-side 1 req/sec limiter.
6. `config.toml`: keep `verify_jwt = false` for `directory-search`; the `add`
   action should still check the caller is rate-limited by `deviceId` as today.

---

## 7. NPPES — capabilities, limits, and the "near me" gap

**Endpoint:** `https://npiregistry.cms.hhs.gov/api/?version=2.1` — no key, no
registration. Updated weekly. ~8M providers + facilities, **US only** (fine — app
is US/Miami-focused).

**Returns:** legal name, credential, primary taxonomy (specialty), practice
address(es), phone, NPI number, sole-proprietor flag, deactivation status.
**Does NOT return latitude/longitude** → we geocode once at add-time.

**Query model:** by `first_name` / `last_name` / `organization_name` /
`taxonomy_description` / `city` / `state` / `postal_code` / `number`. There is
**no radius / "near lat,lng" search.**

Implications for the map's "Explore nearby" list:
- "Near me" browsing stays **served entirely by our `clinics` table** (already
  the case). NPPES is only for *finding a specific office by name/specialty* to
  add it.
- To give "near me" real inventory from day one, **bulk-seed** the `clinics`
  table for launch metros:
  1. Download the NPPES full replacement file (or the weekly incremental), or use
     the Data Dissemination API.
  2. Filter to individual physicians + relevant facility taxonomies in the target
     ZIP/state set (Miami-Dade first).
  3. Batch-geocode practice addresses via the **Census Batch Geocoder** (10k /
     file, free).
  4. Insert with `npi`, `is_active = true`. De-dup on `npi`.
  This is a one-off script (`scripts/seed-nppes.ts`), not app code.

**Rate limits:** no key, but NPPES asks callers not to hammer it; add caching +
a modest server-side throttle. Commercial wrappers exist if higher throughput is
ever needed (not now).

**Data-quality gotchas to handle:**
- practice address is sometimes an administrative/billing address, not a
  street-level clinic → the verify step + map pin let a human catch it.
- one NPI can have multiple locations → take the primary practice location;
  allow admin edit.
- deactivated NPIs → filter on the deactivation field.

---

## 8. Phased rollout

| Phase | Scope | Effort | Risk |
|---|---|---|---|
| **0 — prep** ✅ | `npi` migration + `geocode_cache` migration; `types.ts` updated; tile env vars scaffolded (default OSM) | done |
| **1 — map swap** ✅ | `MapView.tsx` rewritten on Leaflet + `map-tiles.ts`; POI-tap dropped (inert prop kept); "map unavailable" fallback. `@googlemaps/*` removal deferred to P3 (used by `google-places-client`) | done |
| **2 — directory backend** ✅ | `medical-search` edge fn (kept the name — client already calls it): NPPES `search`/`add` + Census/Nominatim `geocode`/`reverse` + Photon `autocomplete` + `geocode_cache`; `nppes.ts` pure helpers + 20 tests; old `google-places` `search`-action bug fixed pre-phase | done — **not yet deployed** |
| **3 — client search/add** ✅ | `medical-search.ts` → `NpiSearchResult` / `isNpi` / `addMedicalPlace(npi)`; `google-places-client.ts` → `medical-search` (no Google SDK); `clinic-dedup.ts` → `findClinicByNpi`; `Index`/`AdminDashboard`/`SuggestClinic` rewired, `distance_matrix` + `routeDistance*` removed, POI handlers deleted; `google-maps.ts` + `supabase/functions/google-places/` deleted; `@googlemaps/js-api-loader` + `@types/google.maps` removed; tests updated | done |
| **4 — detail + cleanup** ✅ | `MiniMap.tsx` (non-interactive Leaflet) replaces the `GoogleMapEmbed` iframe on `ClinicDetail`; all 3 Google env vars removed from `.env`/`.env.example`/`vite-env.d.ts`; README + landing/FAQ copy fixed (geofence now stated as ~1 km, matching code); `.leaflet-div-icon.smw-pin` rule moved to `index.css`. `google-places-client.ts` kept its filename (now Google-free; rename is cosmetic). `directionsUrl` still a keyless `google.com/maps/dir` deep link — no API, no billing, opens the native maps app. | done |
| **5 — launch seed** ✅ | `scripts/seed-nppes.mjs` — NPPES API → Census batch (Nominatim fallback) → CSV / `--push` upsert on `npi`; zero npm deps; verified end-to-end. Plus migration `20260907150000` adds `city`/`state`/`postal_code` to `clinics`, wired through `nppes.ts` → `medical-search` `add` → `types.ts`. | done — run per metro at launch |

**All code phases (0–5) are complete.** Remaining work is operational and needs
Supabase credentials: apply the three migrations
(`20260907140000`, `20260907140100`, `20260907150000`),
`supabase functions deploy medical-search`, run the smoke tests, then run
`scripts/seed-nppes.mjs --push` for the launch metros. No Google Maps Platform
API is called by the app any more; the `google-places` function is deleted from
the repo (the deployed copy is left in place for the separate mobile app).

**Total ~7–10 working days** including the seed script. Phases 1 and 2/3 are
independent and can run in parallel by two people.

---

## 9. Risks & trade-offs

| Risk | Mitigation |
|---|---|
| OSM raster tiles can't hide non-medical POIs (lost `MEDICAL_ONLY_MAP_STYLE`) | Use a muted "Positron/Lite" style; POIs are low-contrast. Vector tiles + MapLibre can restore filtering later |
| Losing Google POI **tap-to-add** on the map | Keep "tap empty point → reverse-geocode → prefill" and make NPPES search the primary add path. POI tap was a convenience, not core |
| OSM/Nominatim usage policies (1 req/s, attribution, no bulk) | All geo calls go through the edge function with cache + throttle; bulk geocoding uses Census, not Nominatim; show OSM attribution on the map |
| Nominatim geocode quality vs Google in dense addresses | Cache aggressively; Census geocoder as second try (very good for US street addresses); admin can hand-edit lat/lng (fields already exist) |
| NPPES has no "near me" search | "Near me" is DB-served (unchanged); seed the DB per metro at launch (§7) |
| NPPES address ≠ real clinic location sometimes | Verify-before-save + visible map pin + admin review already in the flow |
| Tile vendor free-tier ceiling as users grow | Protomaps self-host path (§4.2) removes the vendor entirely for a one-time build |
| Mobile app still calls `google-places` / `medical-search` | Keep a compatibility alias for one release; port the same changes to the Expo repo (§11) |
| Public OSRM demo server forbids production load | Don't depend on it — v1 uses straight-line distance |
| Regenerating `types.ts` / schema drift | Run `supabase gen types` after the migration; commit the diff |

---

## 10. Cost after (steady state)

| Item | Before | After |
|---|---|---|
| Maps JavaScript API | free tier, then $7/1k | **removed** |
| Places Text Search / Details | free tier, then $32 / $17 per 1k | **removed** (NPPES, free) |
| Geocoding API | free tier, then $5/1k | **removed** (Census bulk + Nominatim on-demand, free) |
| Places Autocomplete | free tier, then $2.83/1k | **removed** (Photon/NPPES, free) |
| Distance Matrix | $0 (OSRM) | **removed** (straight-line) |
| Map tiles | — | **$0** (Stadia free tier → Protomaps self-host) |
| **Google Maps Platform total** | $0 now, cost under load | **$0, no load-driven cost, key removable** |
| Apple Developer | $99 / yr | $99 / yr (unchanged) |
| Supabase | free tier | free tier (unchanged) |

---

## 11. Mobile (Expo) app — what carries over

Same three moves, different SDKs:
- **Map:** `react-native-maps` with `PROVIDER_DEFAULT` + an OSM/Stadia raster
  `UrlTile` layer, or `@rnmapbox/maps` / MapLibre RN with Protomaps. Removes the
  `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` / `…_IOS_API_KEY` map cost.
- **GPS check:** `expo-location` + the same haversine — likely already the case.
- **Directory/geocode:** call the **same `directory-search` edge function**. No
  client Google SDK. `EXPO_PUBLIC_GOOGLE_GEOCODE_API_KEY` becomes unused.
- Note: `react-native-maps` on iOS with `PROVIDER_DEFAULT` uses **Apple Maps**
  (free) — an even simpler option than tiles for the native app.

---

## 12. Open questions for the client

1. **Coverage:** US-only via NPPES is fine? (Confirms we can drop
   country-generic geocoding.)
2. **Launch metros:** which ZIP/county set to seed first (assume Miami-Dade)?
3. **Tile look:** neutral light ("Positron/Lite") vs a warmer OSM style — send 2
   screenshots for sign-off.
4. **Geofence copy:** the code uses 1000 m; marketing says 50–100 m. Align copy
   to 1000 m, or tighten the geofence to match the marketing?
5. **Route distance:** OK to show straight-line "X mi away" instead of driving
   distance for launch?
6. **Provider/self-host:** start on Stadia free tier (fastest) with Protomaps
   self-host as the growth path — acceptable?

---

## 13. File-change checklist (for implementation PRs)

**Remove / replace**
- `src/lib/google-maps.ts` → `src/lib/map-tiles.ts` (tile URL + attribution)
- `src/components/map/MapView.tsx` → Leaflet rewrite
- `package.json` → drop `@googlemaps/js-api-loader`, `@types/google.maps`; keep `leaflet`, `@types/leaflet`
- `supabase/functions/google-places/` → `supabase/functions/directory-search/` (NPPES + Nominatim; fix bug; delete Google actions)
- `.env` / `.env.example` → drop `VITE_GOOGLE_MAPS_JS_API_KEY`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_GEOCODE_API_KEY`; add `VITE_MAP_TILE_URL`, `VITE_MAP_TILE_ATTRIBUTION`, `VITE_MAP_TILE_KEY?`, `NOMINATIM_BASE`, `NPPES_API_BASE`

**Edit**
- `src/lib/medical-search.ts` — NPI types, `directory-search`, `isNpi`, drop Google links
- `src/lib/google-places-client.ts` — Nominatim reverse/autocomplete; delete client `AutocompleteService`/`Geocoder`
- `src/lib/clinic-dedup.ts` — prefer `npi`
- `src/components/map/VerifyPlaceCard.tsx` — copy + remove "Powered by Google"
- `src/pages/Index.tsx` — drop `distance_matrix` effect + `routeDistance*`; drop `onPoiClick` wiring
- `src/pages/AdminDashboard.tsx` — add/edit/CSV/approve → `directory-search`; drop `distance_matrix`; drop POI handler; Census for CSV
- `src/pages/SuggestClinic.tsx` — Nominatim geocode primary; drop `PLACE_ID_REQUIRED`; NPPES-first add flow
- `src/pages/ClinicDetail.tsx` — Leaflet mini-map (optional)
- `src/hooks/use-clinics.ts` / `src/components/map/ClinicListPanel.tsx` — remove `routeDistance*`
- `src/test/medical-search.test.ts` — update envelope/types
- `README.md`, `src/pages/LandingPage.tsx` (FAQ / "50–100 m" / "verify via Google Maps" copy)

**Add**
- `supabase/migrations/<ts>_add_npi_identity.sql` + regenerated `src/integrations/supabase/types.ts`
- `supabase/migrations/<ts>_geocode_cache.sql`
- `scripts/seed-nppes.ts` (offline launch seed)

**No change (confirm in review)**
- `src/lib/geolocation.ts`, `src/lib/report-geofence.ts` — already Google-free
- `src/components/map/ClinicBottomSheet.tsx` — GPS/geofence only; just re-check the "0.6 miles" wording
