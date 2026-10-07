# Map, listing, and reporting rules

This describes how the doctor-office map, the nearby list, and wait-time reporting behave, and which admin settings change them. Settings live in the `app_settings` table and are edited in the Admin dashboard → App Settings card.

## Admin settings

| Setting (key) | Default | What it controls |
|---|---|---|
| `nearby_radius_miles` (Nearby Radius, miles) | 5 | The search radius around the user. Drives the map markers, the header count, and the list. Server-capped at 500 miles. |
| `report_geofence_meters` (Report Radius, meters) | 1000 | How close a user must be to an office to submit a wait report. GPS accuracy must be within the same distance. |
| `report_cooldown_minutes` (Report Cooldown) | 60 | The anti-spam timer between reports from the same device. As of 2026-10-06 this is **global per device**, not per office — a device that just reported anywhere must wait out the cooldown before reporting again at any office. Index: migration `20261006140000_global_device_cooldown_index.sql`. |
| `report_expiry_30min_minutes`, `report_expiry_60min_minutes`, `report_expiry_90plus_minutes` (Report Expiry by Wait Time) | 30 / 60 / 90 | How long a report of that category stays "active" before the office reverts to On Time. Decoupled from the cooldown above (migration `20261006150000_per_category_report_expiry.sql`). On Time reports always use a fixed 60-minute window (not admin-configurable, since an On Time report expiring has no visible effect). |

Changes apply to users within about 5 minutes (the settings cache). Existing reports are not deleted.

### Latest-report-wins (no resurrection)

A clinic's wait status is always determined by its single most recent report, checked only against that report's own expiry/flag status. If the most recent report is expired or flagged, the office shows On Time — it never falls back to an older report underneath, even if that older report's own (possibly longer) window is still open. This applies identically to expiry-triggered and flag-triggered reverts, on both the public site and Admin. Implemented in `apps/web/src/lib/wait-time-utils.ts` (`getAverageWaitTime`) and mirrored in `AdminDashboard.tsx` (`mostRecentReportByClinic` / `isReportActive`) and the mobile app (`apps/mobile/src/hooks/use-clinics.ts`). Any query feeding these functions must NOT pre-filter `is_flagged=false` — the function needs to see a flagged row to know to stop there instead of silently revealing the one underneath.

## Map

- The map draws **every active office within the nearby radius**. The app loads the radius in batches of 1,000 in the background and stops at 30 batches (30,000 offices) as a safety cap.
- A blue dot marks the user's location, with a circle at the nearby radius. The dot and circle sit above the office pins.
- On first load the map centres on the user at zoom 14. If the location arrives later, it re-centres once.
- Pins are coloured by the latest wait category. Tapping a pin opens the office sheet.
- **Clustering (added 2026-10-06):** pins are grouped with `supercluster` (`apps/web/src/lib/clinic-pin-layer.ts`) once there are too many to show individually, so hundreds of offices in one area don't overwhelm the map. Tapping a cluster zooms in. This is on both the public map and the Admin map.
- **Same-building picker:** offices whose pins land within `STACK_PIXEL_BUCKET` (10px) of each other at the current zoom — e.g. several practices in one building — are grouped into a "stack." Tapping a stack opens `ClinicStackPicker` (a portal-based popup, so it isn't clipped by Admin's `overflow-hidden` container) listing each office so the user can pick one.
- Zoomed-out, city-wide, or whole-US views are **not** implemented yet; clustering handles density within the radius, but there's still no separate "city" or "US" zoom tier.
- **Live updates (added 2026-10-06):** an open clinic view (map pin, list card, or office detail) updates within ~1 second of another user's report via Supabase Realtime (`wait_time_reports` table, `REPLICA IDENTITY FULL` + added to the `supabase_realtime` publication — migration `20261006160000_wait_time_reports_realtime.sql`). A 60-second poll remains as a fallback for missed events or reconnects.

## Header count

- "Nearby Doctor Offices (N)" shows a **close estimate** of the offices inside the nearby radius, from a single server call. No rows are downloaded for it. Changed 2026-10-07: an exact count was timing out in dense metros even at the default radius (NYC: 57014 at 5 miles), so the count now sums a precomputed grid of office counts (`clinic_geo_grid`, refreshed nightly). It can run a bit high near the radius edge — about 30% in testing — but it never times out. The list itself is still exact; only this header number is an estimate.
- The count will rise as the geog backfill (which records each office's map position) completes.

## Listing

- The list shows the **nearest 50** offices by default, sorted by distance from the user.
- **Load more** adds the next 50 from the rows already loaded (no extra request). Each press adds 50 more.
- A list of offices longer than what's shown is cut off at the button; the header still shows the full count.
- Searching by name or address replaces the nearby list with results from the database. Search results are not limited to the nearby radius.

## Wait-time reporting

- A user can report only for an office within the **report radius** (default 1000 m).
- The device's GPS accuracy must be within the same distance. Desktop and Wi-Fi locations are often hundreds of metres accurate, so a tighter limit would block them.
- The error message always shows the current admin value, not a fixed number.
- Each device can report once per **cooldown** window, globally — not once per office (changed 2026-10-06; previously the cooldown was per-office, which allowed spamming reports across different offices back-to-back).
- How long the report then stays visible before reverting to On Time is a separate, per-category **expiry** window (see the settings table above) — not the same thing as the cooldown.

## Admin changes and their effect

- **Nearby radius:** changes the map circle and pins, the header count, and the list, for all users within about 5 minutes.
- **Report radius:** changes the distance check and the messages on the office sheet, the office page, and the location error overlay.
- **Cooldown:** changes the global per-device anti-spam timer (see above — no longer tied to report expiry).
- **Report expiry (30/60/90):** changes how long a report of that category stays active before reverting to On Time.
- The Admin map preview uses the nearby radius setting, so the admin can see what users see.

## Doctor office visibility (hide/show)

- Each office has an `is_active` column. Public queries (map, list, search) filter to `is_active = true` only; the Admin Doctors list shows every office regardless, with hidden ones dimmed and labelled "Hidden."
- Admin can toggle this per office (eye icon in the Doctors tab Actions column) — a reversible soft-hide, distinct from Delete. Added 2026-10-06.
- This is separate from `npi_imported`: that flag blocks *editing* an office's data (since it's sourced from the NPPES registry and shouldn't be hand-edited), and is purely a client-side UI restriction with no database-level enforcement. Visibility (`is_active`) is unrelated and works the same for imported and admin-added offices alike.
- **RLS gotcha (fixed 2026-10-06, migration `20261006170000_admin_view_inactive_clinics.sql`):** `clinics` originally had only one SELECT policy, `is_active = true`, with no admin-scoped SELECT policy. Since a Postgres `UPDATE` implicitly needs its resulting row to satisfy a SELECT policy (for the `RETURNING` PostgREST always requests internally, even with `Prefer: return=minimal`), hiding an office failed with `"new row violates row-level security policy for table clinics"` even for a correctly-authenticated admin — the UPDATE policy's own check passed, but the new (inactive) row failed to satisfy the public SELECT policy needed to return it. The fix was an additional permissive SELECT policy, `USING (public.has_role(auth.uid(), 'admin'::app_role))`, so admins can see/return inactive rows too. Any future admin-only mutation that flips a row out of what a public SELECT policy allows should be checked for this same trap.

## Limits to know about

- The map and count depend on each office having a stored position. Offices without one are not shown until the backfill fills it in.
- Very large radii (hundreds of miles) load many offices and are slower. Keep the nearby radius small, unless you plan to add zoomed-out views.
