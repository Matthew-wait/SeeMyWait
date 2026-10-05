# Map, listing, and reporting rules

This describes how the doctor-office map, the nearby list, and wait-time reporting behave, and which admin settings change them. Settings live in the `app_settings` table and are edited in the Admin dashboard → App Settings card.

## Admin settings

| Setting (key) | Default | What it controls |
|---|---|---|
| `nearby_radius_miles` (Nearby Radius, miles) | 5 | The search radius around the user. Drives the map markers, the header count, and the list. Server-capped at 500 miles. |
| `report_geofence_meters` (Report Radius, meters) | 1000 | How close a user must be to an office to submit a wait report. GPS accuracy must be within the same distance. |
| `report_cooldown_minutes` (Report Expiry & Cooldown) | 60 | How long a wait report stays active, and the per-office cooldown between reports. |

Changes apply to users within about 5 minutes (the settings cache). Existing reports are not deleted.

## Map

- The map draws **every active office within the nearby radius**. The app loads the radius in batches of 1,000 in the background and stops at 30 batches (30,000 offices) as a safety cap.
- A blue dot marks the user's location, with a circle at the nearby radius. The dot and circle sit above the office pins.
- On first load the map centres on the user at zoom 14. If the location arrives later, it re-centres once.
- Pins are coloured by the latest wait category. Tapping a pin opens the office sheet.
- Zoomed-out, city-wide, or whole-US views are **not** implemented yet. The map only shows the nearby radius.

## Header count

- "Nearby Doctor Offices (N)" shows the **exact number of offices** inside the nearby radius, from a single server count. No rows are downloaded for it.
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
- Each device can report once per office per cooldown window.

## Admin changes and their effect

- **Nearby radius:** changes the map circle and pins, the header count, and the list, for all users within about 5 minutes.
- **Report radius:** changes the distance check and the messages on the office sheet, the office page, and the location error overlay.
- **Cooldown:** changes report expiry and the per-office cooldown.
- The Admin map preview uses the nearby radius setting, so the admin can see what users see.

## Limits to know about

- The map and count depend on each office having a stored position. Offices without one are not shown until the backfill fills it in.
- Very large radii (hundreds of miles) load many offices and are slower. Keep the nearby radius small, unless you plan to add zoomed-out views.
