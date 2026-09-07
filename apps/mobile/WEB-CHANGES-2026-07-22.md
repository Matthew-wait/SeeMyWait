# SeeMyWait — Web Changes to Port (2026-07-22)

A focused changelog of **what we changed on mobile today** that must be mirrored on the **website**. This is a delta document — for the full feature spec (edge-function API, verify-before-save, report-wait geofence, wait-status tiers) see **`MEDICAL-SEARCH-WEB-HANDOFF.md`**. This file covers **only today's changes**.

**Nature of the work:** all client-side UI/UX polish + one shared-DB data reset. **No backend/edge-function/Google-key changes** — nothing to redeploy. Because the DB is shared, the data change already applies to web automatically.

**Not for web (mobile-only, listed so you can ignore them):** Android `AD_ID` permission stripping, Play Console internal-testing setup, iOS export-compliance flag. These are native-store concerns with no web equivalent.

---

## Summary

| # | Change | Type | Web action |
|---|---|---|---|
| 1 | Default wait state = green **“On time”** | UI | Update tier logic + legend |
| 2 | “Not close enough” blocker text → **red** | UI | Restyle blocker text/icon |
| 3 | Nearby list: **“Distance X mi”**, hide when unknown | UI | Reword + conditional render |
| 4 | Search **clear (✕)** at far right + **click-outside to close** | UI | Add ✕ + outside-click handler |
| 5 | **Pinch/scroll zoom** works everywhere | Map | Don’t disable gestures (default) |
| 6 | **Hide non-medical POIs** on the map | Map | Apply `styles` array (verbatim below) |
| 7 | **Tap-to-add** (POI click + empty-point click) | Map + form | Add two click handlers + form prefill |
| 8 | **All active clinics get a pin** (not just nearby) | Map | Decouple markers from distance filter |
| 9 | **Add-Doctor: location-biased address suggestions + optional coordinate fields** | Form + edge fn | Bias autocomplete; add lat/lng inputs |
| — | **Directory data reset** (2 clinics only) | Shared DB | Nothing to code — just expect it |

---

## 1. Default wait state = green “On time”

Clinics with **no active report** show the green **“On time”** state (not a neutral/“No reports yet” state).

- **Tiers by latest reported minutes:** `null` (no report) → green **On time**; `0`/≤15 → green On time; ≤35 → amber; ≤70 → orange; else red.
- Apply consistently to **list cards, map pins, the legend, AND the clinic popup**. The legend has **4 tiers** (no grey “no reports” row).
- **⚠️ Popup consistency (fixed today):** the clinic-detail popup’s wait-status line must use the **same tier logic**. Previously it hardcoded **“No recent reports — be the first!”** for the no-report case, which contradicted the card showing green “On time.” Drive the popup banner from the same `waitTierVisual` source: no report → green **“On time”** (green text `#15803d` + green-tinted background); with a report → “Latest report: about X min wait” colored by tier.
- **Mobile ref:** `src/lib/wait-tier-style.ts` (`waitTierVisual(null)` → green, pin `#22c55e`, text `#15803d`, label “On time”), `src/components/map/MapLegend.tsx`, `src/components/map/ProximityPrompt.tsx` (popup banner).

## 2. Blocker text in red

The clinic popup’s **“You are not close enough to submit a wait report…”** line (and its icon) is shown in **destructive red**.

- Colors: background `#fef2f2`, text/icon `#dc2626`, font-weight 600.
- **Mobile ref:** `src/components/map/ProximityPrompt.tsx`.

## 3. Nearby list distance label

- Row reads **“Distance X mi”** (previously “Driving X mi”).
- If there is **no distance** for a row, render **no distance line at all** (never show “Distance n/a”).
- List stays **sorted nearest-first** by distance to the user.
- **Mobile ref:** `src/components/map/ClinicListPanel.tsx` — renders the line only when `routeDistance` is a finite number.

## 4. Search box: clear button + click-outside to close

- A **clear (✕)** button appears when the field has text; clicking it **clears the text and closes the results dropdown**.
- The ✕ sits at the **extreme right** of the search field. Put the text input on `flex:1` (or equivalent) so the layout is `🔍 icon → input → ✕` with the ✕ pinned to the right edge.
- **Clicking outside** the open dropdown **collapses it**. Render an outside-click handler / backdrop element **only while results are open**, so it doesn’t interfere with the map when the dropdown is closed.
- **Mobile ref:** `src/pages/Index.tsx`.

## 5. Pinch / scroll zoom on all platforms

- Ensure map zoom works via **trackpad pinch and touch**. On the Google Maps **JavaScript** API this is the default — just **don’t** set `gestureHandling: 'none'` (use `'greedy'` or `'auto'`). Pitch/rotate stay disabled.
- **Mobile ref:** `src/components/map/MapView.tsx`.

## 6. Hide non-medical POIs on the map

Apply this **exact** style array to the map so shops/restaurants/landmarks are hidden while **medical** POIs stay visible (they must stay visible **and clickable** for item 7):

```js
const MEDICAL_ONLY_MAP_STYLE = [
  { featureType: 'poi',          stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical',  stylers: [{ visibility: 'on'  }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];
```

Maps JS usage: `new google.maps.Map(el, { styles: MEDICAL_ONLY_MAP_STYLE, /* … */ })`.
**Mobile ref:** `src/components/map/MapView.tsx`.

## 7. Tap-to-add (two paths)

Lets users add a place by tapping the map. Two behaviors:

**(a) Click a medical POI** (only medical POIs fire after item 6). On Maps JS, listen for the POI click, call `e.stop()` to suppress the default info window, and read `e.placeId` + `e.latLng`:
- Call the **`add`** action with `{ placeId, deviceId }` (see `MEDICAL-SEARCH-WEB-HANDOFF.md` §4.2).
- `ok:true` → refresh clinics, center map, open the new clinic’s card. **This is auto-add** — the user tapped one specific verified place, so no Verify step is needed.
- `ok:false` (e.g. `not_medical`) → open the **Add-Doctor form prefilled** with `name` + `lat`/`lng`.

**(b) Click an empty map point.** On Maps JS use `map.addListener('click', e => …)`:
- **Ignore the event if `e.placeId` is set** — that’s a POI click handled by (a).
- Otherwise store the point and show an **“Add a doctor office here”** affordance → on confirm, **reverse-geocode** the point and open the **Add-Doctor form prefilled** with `address` + `lat`/`lng`.

**Add-Doctor prefill contract** — the form initializes from these optional params: `name`, `address`, `specialty`, `type` (`doctor|clinic|hospital|urgent_care`), `place_id`, `lat`, `lng`. On web, pass them via query string / router state and hydrate the form’s initial state.

**Verified end-to-end today:** the `add` action was tested against the live function with a real POI-format `place_id` → inserted correctly (`source:google, verified:true`), was idempotent on re-add, and rejected bad input gracefully. So path (a) is confirmed working server-side.

**Mobile ref:** `src/components/map/MapView.tsx` (handlers), `src/pages/Index.tsx` (add-here bar + navigation), `src/pages/SuggestClinic.tsx` (prefill).

## 8. All active clinics get a pin

Render a marker for **every active clinic with valid (finite) coordinates**, independent of the nearby-distance filter — so a pin shows wherever the map is panned (this fixed a far clinic, e.g. Miami, having no pin). Guard against non-finite lat/lng. The nearby **list** stays distance-filtered/sorted. Add marker clustering when the dataset grows.

- **Candidate vs saved pins:** saved-clinic pins are colored by wait tier (item 1); the verify **candidate** pin is a distinct blue `#2563eb` at high z-index.
- **Mobile ref:** `src/pages/Index.tsx`, `src/components/map/MapView.tsx`.

## 9. Add-Doctor: location-biased address suggestions + coordinate fields

**Problem:** the Add-Doctor address autocomplete returned wildly off-target suggestions (user in D-17 Islamabad got Bahria/Gulrez, Cambodia, Egypt…) because the old `google-places` `autocomplete` action **ignores location bias** — it never forwarded `location`/`radius` to Google, so results were effectively unbiased. And a manually-typed “custom” location had no reliable way to carry exact coordinates.

**Two-part fix:**

**(a) Location-biased autocomplete (⚠️ needs the `medical-search` redeploy).**
- Added a new **`autocomplete`** action to the **`medical-search`** edge function that forwards `location` + `radius` (soft bias, not strictbounds — other regions still resolve, so Pakistan **and** Miami both work). It’s the only holder of the Google key and is rate-limited like the other actions.
- Request: `{ "action": "autocomplete", "query": "...", "location": { "latitude": .., "longitude": .. }, "deviceId": "..." }` → Response (always HTTP 200): `{ "ok": true, "predictions": [ { "place_id": "...", "description": "..." } ], "limited": false, "degraded": false }`.
- The client passes the **user’s current location** (fetched best-effort on form mount, coarse) as the bias. If location is denied/unavailable, suggestions still work, just unbiased.
- **Web:** switch the Add-Doctor autocomplete call from `google-places` → `medical-search` (`autocomplete`), and pass the browser’s geolocation as `location`. (On Maps JS you may instead use `AutocompleteService` with `locationBias` client-side — but going through `medical-search` keeps the key server-side and rate-limited, consistent with the rest of the app.)
- Selecting a suggestion still calls `google-places` `details` (unchanged) to get coordinates.

**(b) Optional Latitude/Longitude fields (client-only).**
- Added two optional **Latitude / Longitude** inputs to the Add-Doctor form. They’re **auto-filled** when the user picks a suggestion, uses “current location”, or arrives via map-tap prefill — and can be **manually pasted from Google Maps** for a custom spot.
- Validation: both filled, latitude ∈ [-90, 90], longitude ∈ [-180, 180]; otherwise a warning shows and they’re treated as empty.
- On submit, **manual coordinates take precedence** over geocoding: `resolveCoordinates()` returns the parsed manual coords first, then the selected-place coords, then falls back to geocoding the address string. This guarantees a **custom location always carries exact coordinates**.
- Helper text: “Auto-filled when you pick a suggestion or use current location. For a custom spot, paste exact coordinates from Google Maps (long-press → tap the lat, long to copy).”
- **Mobile ref:** `src/pages/SuggestClinic.tsx` (bias location on mount, `fetchAutocomplete` → `medical-search`, `latInput`/`lngInput`, `parsedManualCoords`, `resolveCoordinates`), `supabase/functions/medical-search/index.ts` (`handleAutocomplete`).

> **Deploy:** part (a) requires `supabase functions deploy medical-search`. Part (b) is client-only. The `google-places` function is left untouched.

---

## Directory data reset (shared DB — no web code)

The shared `clinics` table was reset today to a minimal seed. It now contains **only two rows**:

| Name | Region |
|---|---|
| Holy Family Hospital Rawalpindi | Pakistan |
| Biscayne Dermatology | Miami, FL |

Implications for web:
- The directory/map will look **nearly empty until places are added — that’s expected**, not a bug.
- It **repopulates through the product**: search → Verify & Add, POI tap-to-add, and empty-point “Add here” (items 7 above).
- Because the DB is shared, anything the web app adds appears on mobile and vice-versa, **deduped by `google_place_id`**. No separate seeding needed on web.

---

## Acceptance checklist (today’s items only)

- [ ] Clinic with no report shows green **“On time”** on card + pin + legend.
- [ ] A far clinic’s popup shows the “not close enough” blocker text in **red**.
- [ ] Nearby rows read **“Distance X mi”**; rows without a distance show **no** distance line; list is nearest-first.
- [ ] Typing shows a **✕** at the far right → clears box + closes dropdown; clicking outside the dropdown closes it; map gestures unaffected when closed.
- [ ] **Pinch/scroll zoom** works (trackpad + touch).
- [ ] Restaurants/shops/landmarks are hidden on the map; hospital/clinic POIs remain visible.
- [ ] Clicking a medical POI adds it (verified) and opens its card; failure routes to Add-Doctor prefilled.
- [ ] Clicking an empty map point shows **“Add here”** → reverse-geocodes → opens Add-Doctor prefilled with `address`/`lat`/`lng`.
- [ ] A pin renders for every active clinic wherever the map is panned (e.g. pan to Miami → Biscayne shows).
- [ ] Add-Doctor address suggestions are **near the user** (bias applied), not random far-off places.
- [ ] Picking a suggestion / using current location **auto-fills** the Latitude/Longitude fields; pasted coordinates are accepted and used on submit; invalid coords are flagged.
- [ ] A custom (manually-typed) location submits with **exact coordinates** (manual coords win over geocoding).
- [ ] Directory shows the 2 seed clinics and grows via the add flows.
