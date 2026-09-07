# Medical Place Search — Web Implementation Handoff

This document specifies the **medical place search** feature so it can be re-implemented in the **web codebase**. The web app and the mobile app **share the same Supabase project (database + edge functions)**. Therefore:

- ✅ **The backend already exists and must NOT be rebuilt** — same DB schema, same `medical-search` edge function, same Google server key.
- 🛠️ **Only the web client needs to be built** — the search UI, the verify-before-save flow, the map integration, and the report-wait flow — all calling the existing edge function.

Implement to this spec exactly. The "Pitfalls" section at the end lists real problems the mobile app hit — avoid them.

---

## 1. Architecture (how it fits together)

```
Web client ──POST──► Supabase Edge Function `medical-search` ──► Google Places (server key)
     │                         │
     │                         └──► DB: clinics (read/write), rate_limits, RPCs
     └──anon key──► Supabase REST/RPC (read clinics, submit wait reports)
```

- The **Google server key lives only in the edge function** (Supabase secret `GOOGLE_MAPS_API_KEY`). **The web client never calls Google Places directly and never sees this key.**
- The web client authenticates to the edge function with the **anon (publishable) key**, same as mobile.
- The web client needs its **own** Google Maps **JavaScript** API key **only for rendering the map** (see §7) — that is separate from the server key.

---

## 2. What already exists on Supabase (do NOT recreate)

**Edge function:** `medical-search` (actions: `search`, `add`) — §4.

**Tables (relevant):**
- `clinics` — the live directory (what the map/list shows). Columns:
  `id (uuid)`, `name (text, NOT NULL)`, `address (text, NOT NULL)`, `latitude (float8, NOT NULL)`, `longitude (float8, NOT NULL)`, `phone (text)`, `google_place_id (text, partial-unique)`, `specialty (text)`, `is_active (bool, NOT NULL)`, `source (text: 'admin'|'google'|'user')`, `verified (bool)`, `place_types (text[])`, `added_by (text)`, `created_at`, `updated_at`.
  **Note:** there is **no `doctor_name`** column — use `name`.
- `wait_time_reports` — `id`, `clinic_id`, `wait_time (enum: 'on_time'|'30_min'|'1_hour'|'1.5_hours_plus')`, `device_fingerprint`, `reported_at`, `expiry_time`, `is_flagged`.
- `app_settings` — `nearby_radius_miles`, `report_cooldown_minutes` (defaults 100 and 60).
- `rate_limits` — internal to the edge function (service role only).

**RPCs:**
- `search_clinics(p_q text, p_lim int)` — case-insensitive, typo/word-order tolerant DB search (already used by the edge function; web usually doesn't call it directly).
- `rl_check(...)` — internal rate limiter (service role only).

**RLS:** `clinics` has a public SELECT policy for `is_active = true` — the web client can read active clinics with the anon key. Inserts to `clinics` happen **only** through the edge function (service role).

---

## 3. Feature overview (what the web must do)

1. **Search box** → debounced call to `medical-search` (`search`). DB is searched first; Google is only queried when local matches are thin. Results come back as a single unified list.
2. **Results dropdown** → each row shows **name · address · distance**. Two kinds of results: `source:'db'` (already saved) and `source:'google'` (candidate, not saved yet).
3. **Tap/click a result:**
   - `db` → open its clinic card directly.
   - `google` → **do NOT save yet.** Drop a **distinct pin on the web map**, center on it, and show a **Verify card** with a **“Verify & Add”** button.
4. **Verify & Add** → call `medical-search` (`add`) → saves the place to `clinics` (idempotent) → open the clinic card.
5. **Clinic card** → shows wait status, **Report Wait Time** buttons (if within geofence), **Get Directions** (external maps), and an optional **View on Google Maps** link.
6. **No results** → show a “Suggest a Doctor Office” action.

---

## 4. Edge function API contract (the important part)

**Endpoint:** `POST {SUPABASE_URL}/functions/v1/medical-search`
**Headers:** `apikey: <ANON_KEY>`, `Authorization: Bearer <ANON_KEY>`, `Content-Type: application/json`
The function **always returns HTTP 200** with a typed JSON envelope and never throws — handle everything from the body.

### 4.1 Search
Request:
```json
{ "action": "search", "query": "holy family", "deviceId": "<stable-device-id>",
  "location": { "latitude": 33.6, "longitude": 73.0 } }
```
`location` may be `null`. `query` under 2 chars returns empty results.

Response:
```json
{ "ok": true,
  "results": [
    { "source": "db",     "id": "uuid...",       "name": "...", "address": "...", "latitude": 33.6, "longitude": 73.0 },
    { "source": "google", "place_id": "ChIJ...", "name": "...", "address": "...", "latitude": 33.6, "longitude": 73.0 }
  ],
  "limited": false,   // true = rate limit hit, Google skipped (DB results still returned)
  "degraded": false } // true = Google was attempted but unavailable
```
- `db` results carry `id` (already a clinic). `google` results carry `place_id` (candidate).
- **Search never saves anything.** Saving happens only via `add`.

### 4.2 Add (called by “Verify & Add”)
Request:
```json
{ "action": "add", "placeId": "ChIJ...", "deviceId": "<stable-device-id>" }
```
Success:
```json
{ "ok": true, "existed": false, "clinic": {
  "id": "uuid...", "name": "...", "address": "...", "latitude": 33.6, "longitude": 73.0,
  "phone": null, "google_place_id": "ChIJ...", "specialty": null, "source": "google",
  "verified": true, "is_active": true } }
```
- `existed: true` means it was already saved (idempotent — returns the existing row; **never creates a duplicate**).

Failure (still HTTP 200):
```json
{ "ok": false, "error": "not_medical" }   // or "permanently_closed" | "no_coordinates" | "lookup_failed" | "insert_failed"
{ "ok": false, "limited": true, "error": "rate_limited" }
```
Map each to a friendly message; on `rate_limited` tell the user to try again shortly.

---

## 5. Exact UX flows

### 5.1 Search (DB-first)
- Debounce input **300 ms**; only call when trimmed query length ≥ **2**.
- **Cancel stale responses:** keep a request counter; ignore a response if a newer request has started (prevents an old slow response overwriting new results).
- Render results in one list; show a spinner while loading.
- If `limited` → note “Search limit reached — showing saved offices only.” If `degraded` → “Google search unavailable — showing saved offices.”
- Empty results → show the message + a **“Suggest a Doctor Office”** button.

### 5.2 Verify-before-save (multiple-results safe)
- Clicking a **`google`** result **must not save it.** Instead: center the web map on `{latitude, longitude}`, drop a **visually distinct candidate pin** (e.g. blue — different from saved-clinic pins), and open the **Verify card**.
- Verify card shows: name, address, distance, **“Verify & Add”** (primary), **“View on Google Maps”** (secondary/optional), and a close/cancel.
- **Verify & Add** → call `add` → on success clear the candidate, refresh clinics, open the clinic card. On failure show the message and keep the card so they can retry.
- Cancel/close → discard; **nothing is saved.**
- Clicking a **`db`** result → open its clinic card directly (it’s already saved).
- **Why:** when a query returns several similar places, only the one the user explicitly verifies is saved. This is the key correctness rule.

### 5.3 Report a wait time
- Only allowed when the user is physically near the clinic. On submit, get a **fresh** browser geolocation fix and enforce:
  - Straight-line distance to clinic ≤ **1000 m** (`REPORT_WAIT_GEOFENCE_METERS`).
  - GPS accuracy ≤ **100 m** (`min(100, max(20, floor(geofence/2)))`).
- Categories → buttons: **On Time** (`on_time`), **30 Min** (`30_min`), **1 Hour** (`1_hour`), **1.5+ Hrs** (`1.5_hours_plus`).
- **Duplicate guard:** before insert, check `wait_time_reports` for the same `clinic_id` + `device_fingerprint` within the cooldown window (`app_settings.report_cooldown_minutes`, default 60 min). If found → “You already reported recently.”
- Insert `{ clinic_id, wait_time: <category>, device_fingerprint, expiry_time }` into `wait_time_reports` (anon key; RLS permitting, same as mobile).

### 5.4 Wait status display (default “On time”)
- A clinic with **no active report** shows the **default green “On time”** state.
- Tiers by latest reported minutes: `null` (no report) → green “On time”; `0`/≤15 → green “On time”; ≤35 → amber; ≤70 → orange; else red.
- **The clinic popup must use the SAME tier logic as the list card** — do not hardcode a separate “no reports” line. No active report → green **“On time”** banner (green text + green tint); with a report → “Latest report: about X min wait” colored by tier. (A mismatch here was a real bug: the card said “On time” while the popup said “No recent reports — be the first!”.)
- In the clinic popup, the **“You are not close enough to submit a wait report…”** blocker text is shown in **destructive red**.

---

## 6. Constants (match these exactly)

| Constant | Value |
|---|---|
| Min query length | 2 |
| Search debounce | 300 ms |
| Report geofence (straight-line) | 1000 m |
| Report GPS accuracy ceiling | 100 m |
| Report categories | on_time=0, 30_min=30, 1_hour=60, 1.5_hours_plus=90 |
| Report cooldown | `app_settings.report_cooldown_minutes` (default 60) |
| Directions link | `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving` |
| View-on-Google-Maps link | `https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=<place_id>` |

Rate limits are enforced **server-side** (search: 20/10 min per device + 3000/day global; add: 8/hour per device). The client only needs to handle `limited`.

---

## 7. Web-specific setup

- **Map rendering:** use the **Google Maps JavaScript API**. Create a **new** browser key restricted to **HTTP referrers** (your web domain[s]) in the **same billing-enabled Google Cloud project**. This is separate from the server key.
- **`deviceId` (device fingerprint):** the edge function uses it for rate limiting and per-device report dedup. On web, generate a **stable, persistent** id (e.g. a UUID stored in `localStorage`) and send it as `deviceId` on every call. Keep it stable across sessions.
- **Geolocation:** use the browser `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true` and a generous timeout; read `coords.accuracy` for the accuracy check.
- **Attribution:** show “Powered by Google” wherever Google data is displayed (TOS requirement).

---

## 8. Pitfalls to avoid (real issues the mobile app hit)

1. **Google server key must be in the billing-enabled project.** The server key needs the **legacy “Places API” enabled**, **billing active**, and **Application restriction = None** (server calls have no bundle/referer). A key from a non-billing duplicate project fails with `REQUEST_DENIED: enable Billing`; a **referrer-restricted** key fails with `API keys with referer restrictions cannot be used with this API`. (This is already configured for the shared function — only relevant if a new key is ever set.)
2. **Never auto-save every Google result.** Early on, search auto-saved all results — that pollutes the directory and mis-saves the wrong place when a query has multiple matches. **Save only on explicit Verify.** (Fixed by verify-before-save; §5.2.)
3. **No duplicates.** Dedup is guaranteed by the partial-unique index on `google_place_id` + the idempotent `add`. Don’t try to insert clinics from the web client directly — always go through the `add` action.
4. **Don’t run two search systems at once.** The mobile app had an old geocode-based search running in parallel with the new one; the two overlapped visually and fired redundant geocode calls. Build **one** search path (this spec) — don’t layer it on top of an existing search.
5. **DB-first, then Google.** Don’t hit Google on every keystroke for places you already have. The edge function already does DB-first; just debounce and respect it.
6. **Case-insensitive / fuzzy search is handled server-side** (`search_clinics` uses ILIKE + trigram). Don’t reimplement matching on the client.
7. **Directions = hand off to Google/Apple Maps.** Do **not** rebuild in-app turn-by-turn navigation. Open the external maps URL (§6).
8. **Verification happens on your own map** (drop the candidate pin), with “View on Google Maps” as an optional secondary — not the primary path.
9. **Default wait state is green “On time”** for clinics with no active report (§5.4).
10. **The function always returns HTTP 200** with `{ ok: ... }`. Branch on the body, not on HTTP status. Handle `limited`/`degraded` gracefully (still show DB results).
11. **Keep the server key out of the browser.** All Google Places calls go through the edge function; the browser only holds the anon key + the Maps-JS referrer key.

---

## 9. Acceptance checklist

- [ ] Search shows DB matches first; Google candidates appear only when needed.
- [ ] Results show name · address · distance.
- [ ] Clicking a Google result drops a candidate pin on the map and opens the Verify card — **nothing saved yet**.
- [ ] **Verify & Add** saves the place (idempotent — re-verifying the same place makes no duplicate) and opens the clinic card.
- [ ] Cancelling the Verify card saves nothing.
- [ ] Clicking a DB result opens its clinic card directly.
- [ ] Report buttons appear only within 1000 m + accuracy ≤ 100 m; duplicate reports within cooldown are blocked.
- [ ] Clinics with no reports show green **“On time”**.
- [ ] Get Directions / View on Google Maps open external maps.
- [ ] `limited` / `degraded` responses degrade gracefully (DB results still shown).
- [ ] Map renders with a referrer-restricted Maps-JS key; the server key is never in the browser.

---

## 10. Batch-2 map/UX behaviors (port these too)

Implemented on mobile; port to web with the Google Maps **JavaScript** API equivalents:

1. **Default “On time”** — clinics with no report show green **On time** on cards, pins, and legend (not “No reports yet”).
2. **Blocker text in red** — the popup’s “not close enough to report” line is destructive red.
3. **Distance label** — nearby-list rows read **“Distance X mi”** (not “Driving”); if there’s no distance, render **no** distance line at all. List is sorted **nearest-first** by distance to the user.
4. **Search box** — a **clear (✕)** button appears when there’s text (clears box + closes dropdown); it must sit at the **extreme right** of the search field (put the text input on `flex:1` so the ✕ is pinned to the right edge; order = `🔍 icon → input → ✕`). **Clicking outside** the dropdown collapses it (web: an outside-click handler / backdrop element rendered only while results are open).
5. **Pinch/scroll zoom** — ensure map zoom works on trackpad + touch (Maps JS has this by default; just don’t disable `gestureHandling`).
6. **Hide non-medical POIs** — apply a Maps JS `styles` array hiding `poi`/`poi.business` and keeping `poi.medical` visible (same style JSON used on mobile). Keep medical POIs visible so they stay clickable for item 7.
7. **Tap-to-add** (two paths):
   - **Click a medical POI on the map** (`map` POI click → `placeId`): call the **`add`** action → on success it’s saved (verified) → open its clinic card. On failure (`not_medical`) → go to the Add-Doctor form prefilled with `name`/`lat`/`lng`.
   - **Click an empty map point** (`map.click` → `latLng`): show an **“Add a doctor office here”** affordance → on click, **reverse-geocode** the point and open the Add-Doctor form prefilled with `address`/`lat`/`lng`. The Add-Doctor form must accept prefill params (`name`, `address`, `lat`, `lng`, `type`, `specialty`, `place_id`).
8. **All clinics get a pin** — render a marker for **every active clinic with valid coordinates** (guard non-finite lat/lng), independent of the nearby-distance filter, so a pin shows wherever the map is panned. The nearby **list** stays distance-filtered/sorted. (Add marker clustering when the dataset grows.)

---

## 11. Mobile implementation reference (how it was actually built)

This maps each behavior to the mobile source so the web port mirrors the exact logic. File paths are mobile (`src/…`); the **approach** is what to replicate, not the RN APIs.

| # | Behavior | Mobile file(s) | How it was done |
|---|---|---|---|
| 1 | Default “On time” | `src/lib/wait-tier-style.ts`, `src/components/map/MapLegend.tsx` | `waitTierVisual(null)` returns the green On-time visual (pin `#22c55e`, text `#15803d`, label “On time”). Legend has 4 tiers (no grey “No reports” row). |
| 2 | Red blocker text | `src/components/map/ProximityPrompt.tsx` | The “not close enough” banner uses a destructive style: bg `#fef2f2`, text/icon `#dc2626`, weight 600. |
| 3 | Distance label | `src/components/map/ClinicListPanel.tsx` | Row renders `Distance {miles} mi` **only when** `routeDistance` is a finite number; otherwise the distance line is omitted entirely. |
| 4 | Search clear + collapse | `src/pages/Index.tsx` | Input on `flex:1`; ✕ is the last child of the input row (pinned right), shown when `search.length > 0`; onPress → clear text + close results. A full-screen backdrop element is rendered **only while results are open** and closes them on outside press without blocking map gestures otherwise. |
| 5 | Pinch/scroll zoom | `src/components/map/MapView.tsx` | Zoom/scroll explicitly enabled; pitch/rotate disabled. On web (Maps JS) this is default — just don’t set `gestureHandling:'none'`. |
| 6 | Hide non-medical POIs | `src/components/map/MapView.tsx` | A `customMapStyle` array (below) hides `poi`/`poi.business` and re-enables `poi.medical`. **Use the identical array** as the Maps JS `styles` option. |
| 7 | Tap-to-add | `src/components/map/MapView.tsx`, `src/pages/Index.tsx`, `src/pages/SuggestClinic.tsx` | Two handlers — POI click and empty-point click (below). Add-Doctor form reads prefill params. |
| 8 | All clinics get a pin | `src/pages/Index.tsx`, `src/components/map/MapView.tsx` | Map receives clinics filtered **only** on finite lat/lng (not the nearby-distance filter). The list keeps the distance filter/sort. |

### 11.1 Map style JSON (items 6 + 7) — use verbatim
```js
const MEDICAL_ONLY_MAP_STYLE = [
  { featureType: 'poi',          stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical',  stylers: [{ visibility: 'on'  }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];
```
On Maps JS: `new google.maps.Map(el, { styles: MEDICAL_ONLY_MAP_STYLE, ... })`. Keeping `poi.medical` visible is **required** so medical POIs stay clickable for item 7.

### 11.2 Tap-to-add event logic (item 7)
- **POI click** (only medical POIs fire this after item 6). Maps JS: listen for the POI click, `e.stop()` to suppress the default info window, read `e.placeId` + `e.latLng`.
  - Call the **`add`** action with `{ placeId }`.
  - `ok:true` → refresh clinics, center map, open the new clinic’s card (this is auto-add — the user tapped one specific verified place, so no Verify step).
  - `ok:false` (e.g. `not_medical`) → open the Add-Doctor form prefilled with `name` + `lat`/`lng`.
- **Empty-point click** — Maps JS `map.addListener('click', e => …)`; **ignore it if `e.placeId` is set** (that’s a POI click, handled above). Otherwise store the point and show an **“Add a doctor office here”** affordance → on confirm, **reverse-geocode** the point and open the Add-Doctor form prefilled with `address` + `lat`/`lng`.

### 11.3 Add-Doctor prefill contract
The Add-Doctor form initializes its fields from these params (all optional): `name`, `address`, `specialty`, `type` (`doctor|clinic|hospital|urgent_care`), `place_id`, `lat`, `lng`. On web, pass them as query string / router state and hydrate the form’s initial state from them.

### 11.4 Candidate vs saved pins
- Saved-clinic pins are colored by wait tier (`waitTierVisual(latestWaitMinutes)`).
- The **verify candidate** pin (§5.2) is a distinct blue (`#2563eb`) at high z-index, so users can tell an unsaved candidate from saved clinics.

---

## 12. Current directory data state (read this before testing)

The shared `clinics` table was **reset** to a minimal seed — it now contains **only two rows**:

| Name | `google_place_id` | Region |
|---|---|---|
| Holy Family Hospital Rawalpindi | (present) | Pakistan |
| Biscayne Dermatology | (present) | Miami, FL |

This is intentional (clearing old test data). Implications for the web team:
- The directory/map will look nearly empty until places are added — **that’s expected**, not a bug.
- The directory **repopulates through the product itself**: search → Verify & Add (§5.2), POI tap-to-add, and empty-point “Add here” (§11.2). Test those flows to grow the dataset.
- Because the DB is shared, **any place the web app adds appears in the mobile app and vice-versa**, deduped by `google_place_id`. No separate seeding is needed on web.
- Note: this cleanup was a **DB-only** change — there is no corresponding web code change for it.

> **Scope note:** items §1–§9 are the core search feature; §10–§11 are the Batch-2 UX polish; §12 is data state. Everything here is **client + shared-DB only** — the edge function and Google keys are unchanged, so there is **no backend work** for the web team.

---

## 13. How the “Nearby Doctor Offices” list is calculated

The nearby list is a **client-side** pipeline built on **driving distance** (with straight-line as a pre-filter and fallback). Replicate this exactly so web and mobile agree on which clinics are “nearby.”

### 13.1 The radius (the only membership knob)
- Read `nearby_radius_miles` from `app_settings` (default **100 mi**; also `report_cooldown_minutes` default 60). Convert to meters: `radiusMeters = miles × 1609.34`.
- This admin-controlled value — **not** any hardcoded distance — decides list membership.

### 13.2 Stage 1 — coarse pre-filter (straight-line)
- Start from **all active clinics**.
- If the user’s location is known and no city filter is active: keep clinics whose **haversine (straight-line)** distance to the user ≤ `radiusMeters`.
- Then apply any city/address filter.
- Purpose: a cheap first cut so you don’t request driving distances for obviously-far clinics.

### 13.3 Stage 2 — driving distances (with fallback chain)
For up to the **first 50** pre-filtered clinics, in **chunks of 25**, fetch real road distance:
1. **Primary:** call the **`google-places`** edge function (⚠️ a *different* function from `medical-search`, already deployed) with:
   ```json
   { "action": "distance_matrix",
     "origin": { "latitude": 33.6, "longitude": 73.0 },
     "destinations": [ { "id": "<clinicId>", "latitude": 33.6, "longitude": 73.0 }, … ] }
   ```
   Response: `{ "distances": [ { "id": "<clinicId>", "meters": 1234 | null }, … ] }`.
2. **Fallback (per clinic)** if that call errors: **OSRM** public router —
   `https://router.project-osrm.org/route/v1/driving/{originLng},{originLat};{destLng},{destLat}?overview=false` → read `routes[0].distance` (meters).
3. **If both fail:** distance is `null` (unavailable) for that clinic.

Store results as a `{ clinicId → meters | null }` map.

### 13.4 Stage 3 — sort, then final filter
- **Sort (nearest-first):** by driving distance when both are known; a clinic **with** a known driving distance ranks ahead of one without; remaining ties fall back to straight-line haversine.
- **Final filter (list membership):** keep a clinic if its **driving distance ≤ radiusMeters** when known, **else** its **straight-line distance ≤ radiusMeters** while the route is still pending/unavailable.
- The surviving, sorted list is the “Nearby Doctor Offices” panel. Each row’s **“Distance X mi”** = that clinic’s driving distance (meters → miles), **hidden** when unknown (§10 item 3).

### 13.5 Edge cases (match these)
- **No user location** → skip distance filter/sort; show all displayed clinics.
- **City filter active** → membership uses the city/address match, not the radius.
- **The map is separate** — it shows **all** active clinics with valid coords (§10 item 8), independent of this nearby filter. Only the **list** is distance-filtered.
- **Don’t confuse with the report geofence** — whether a user can *report* a wait uses a **fixed 1000 m** straight-line geofence (§5.3), which is unrelated to `nearby_radius_miles`.

### 13.6 Web notes
- The **`google-places` `distance_matrix`** action is shared and already live — call it the same way (anon key headers, HTTP-200 envelope). Do **not** call Google’s Distance Matrix from the browser directly.
- OSRM’s public server has no SLA; treat it as best-effort fallback and tolerate `null`.
- Cap the batch (mobile uses first 50, chunks of 25) so you don’t issue an unbounded matrix request as the directory grows.
- **Mobile ref:** `src/pages/Index.tsx` (`displayedClinics`, `nearbyClinics`, `clinicsWithinDrivingRadius`, `fetchOsrmDistanceMeters`), `src/hooks/use-app-settings.ts`.
