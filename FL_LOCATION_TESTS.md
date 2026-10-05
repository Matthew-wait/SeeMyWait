# Florida location test presets

Live app: https://www.seemywait.com/app

These are airport landmarks for repeatable nearby-office tests. Coordinates are approximate points within the airport areas, not exact street entrances or clinic locations. They replace the earlier city-center coordinates.

All ten presets use **locale `en-US`** and **timezone ID `America/New_York`**. The current live default is **5 miles**, with the nearest 1,000 entries initially and additional batches loaded only by clicking Load more. Historical tests below used 25 miles. Use an empty text search. Latitude and longitude drive nearby search; street addresses identify the landmarks.

| Preset | Full address | Latitude | Longitude | Locale | Timezone ID |
|---|---|---:|---:|---|---|
| Miami | 2100 NW 42nd Avenue, Miami, FL 33142, USA | 25.7959 | -80.2870 | en-US | America/New_York |
| Fort Lauderdale | 100 Terminal Drive, Fort Lauderdale, FL 33315, USA | 26.0742 | -80.1506 | en-US | America/New_York |
| West Palm Beach | 1000 James L. Turnage Boulevard, West Palm Beach, FL 33415, USA | 26.6832 | -80.0956 | en-US | America/New_York |
| Naples | 160 Aviation Drive North, Naples, FL 34104, USA | 26.1526 | -81.7753 | en-US | America/New_York |
| Fort Myers | 11000 Terminal Access Road, Fort Myers, FL 33913, USA | 26.5362 | -81.7552 | en-US | America/New_York |
| Sarasota | 6000 Airport Circle, Sarasota, FL 34243, USA | 27.3954 | -82.5544 | en-US | America/New_York |
| Tampa | 4100 George J. Bean Parkway, Tampa, FL 33607, USA | 27.9755 | -82.5332 | en-US | America/New_York |
| Orlando | 1 Jeff Fuqua Boulevard, Orlando, FL 32827, USA | 28.4312 | -81.3081 | en-US | America/New_York |
| Jacksonville | 2400 Yankee Clipper Drive, Jacksonville, FL 32218, USA | 30.4941 | -81.6879 | en-US | America/New_York |
| Tallahassee | 3300 Capital Circle SW, Tallahassee, FL 32310, USA | 30.3965 | -84.3503 | en-US | America/New_York |

## Reuse in Chrome

1. Open the live app and press F12.
2. Open DevTools Settings, then Locations. Add each preset with its latitude, longitude, timezone ID, and locale.
3. Press Ctrl+Shift+P, enter `Show Sensors`, and choose a saved preset under Location.
4. Keep DevTools open and allow the website to access location.
5. Refresh after changing presets. Clear text search and verify the radius is 5 miles.
6. Record the office count, map position, load time, and any error. `1,000+` means more results remain. Click Load more to request the next batch; a count without `+` is complete. Counts can change with live data.

Chrome documentation: https://developer.chrome.com/docs/devtools/settings/locations/

## Live test results

**Current update:** the app now uses a 5-mile radius and manual batches of 1,000, documented in [NEARBY_RESULTS_FIX.md](NEARBY_RESULTS_FIX.md). Live checks showed Miami `1,000+`, then `2,000+` after clicking Load more, with automatic loading stopped after each request. Central Florida showed 27 complete results, and Islamabad 17; no uncaught JavaScript errors were recorded. The historical 500-entry results below and the intermediate 25-mile full-download tests are retained as investigation evidence. The ten airport presets have not yet been rerun with the new default.

Verified on **October 5, 2026, 11:27-11:28 AM PKT (Asia/Karachi)** using an isolated Chromium browser against the live app. Each location used a fresh browser context with geolocation permission, `en-US`, and `America/New_York`. No application or database changes were made.

All ten passed the nearby-search checks: the browser reported the exact preset coordinates, locale, and timezone; the configured 25-mile request returned HTTP 200; the page displayed `Nearby Doctor Offices (500)` and a visible map; returned coordinates were valid and every returned distance was within 25 miles. No uncaught JavaScript errors were recorded. Screenshots were taken after the startup splash disappeared.

| Location | Result | Displayed entries | 25-mile API response | Farthest returned entry | Screenshot |
|---|---|---:|---:|---:|---|
| Miami | Pass | 500 | 0.538 s | 1.14 mi | [View](artifacts/fl-location-tests/miami.png) |
| Fort Lauderdale | Pass | 500 | 0.780 s | 1.84 mi | [View](artifacts/fl-location-tests/fort-lauderdale.png) |
| West Palm Beach | Pass | 500 | 0.933 s | 1.59 mi | [View](artifacts/fl-location-tests/west-palm-beach.png) |
| Naples | Pass | 500 | 0.547 s | 1.04 mi | [View](artifacts/fl-location-tests/naples.png) |
| Fort Myers | Pass | 500 | 0.550 s | 4.20 mi | [View](artifacts/fl-location-tests/fort-myers.png) |
| Sarasota | Pass | 500 | 1.365 s | 2.25 mi | [View](artifacts/fl-location-tests/sarasota.png) |
| Tampa | Pass | 500 | 0.546 s | 1.53 mi | [View](artifacts/fl-location-tests/tampa.png) |
| Orlando | Pass | 500 | 0.558 s | 3.29 mi | [View](artifacts/fl-location-tests/orlando.png) |
| Jacksonville | Pass | 500 | 1.024 s | 3.83 mi | [View](artifacts/fl-location-tests/jacksonville.png) |
| Tallahassee | Pass | 500 | 0.789 s | 4.47 mi | [View](artifacts/fl-location-tests/tallahassee.png) |

Response times measure the nearby-search network request, not total page load. The recorded page checks took approximately 3.4-6.2 seconds, including startup and screenshot readiness. These are individual measurements, not a sustained-load benchmark.

**500 is the request cap**, not a verified total of unique physical offices within 25 miles. The returned data includes individual practitioners and other provider categories such as interpreters and transport providers; Tampa also displayed repeated office names at the same address. These tests verify location lookup and rendering, not provider classification or deduplication.

The app also issued initial 5-mile and 100-mile requests while loading; all recorded nearby requests returned HTTP 200. The results above refer specifically to the configured 25-mile request.

Raw browser and response evidence: [results.json](artifacts/fl-location-tests/results.json). The read-only runner is [scripts/test-fl-locations.cjs](scripts/test-fl-locations.cjs); it reads the presets directly from this file. To rerun, provide `PLAYWRIGHT_MODULE` pointing to an installed Playwright module and `FL_TEST_CDP_URL` pointing to an isolated Chromium browser's CDP endpoint, then run `node scripts/test-fl-locations.cjs`. It requires no Supabase token and does not submit wait reports or other writes.

## Address sources

- Miami: https://www.miami-airport.com/directions-and-parking.asp
- Fort Lauderdale: https://www.broward.org/Airport/passengers/Services
- West Palm Beach: https://discover.pbc.gov/fdo/art/Pages/PBIA-Art-Gallery.aspx
- Naples: https://www.flynaples.com/department-listing/
- Fort Myers: https://www.flylcpa.com/contact-us/
- Sarasota: https://flysrq.com/form/contact
- Tampa: https://www.tampaairport.com/directions
- Orlando: https://orlandoairports.net/site/uploads/Hormac-H367-Add-01.pdf
- Jacksonville: https://flyjacksonville.com/content.aspx?id=1063
- Tallahassee: https://www.talgov.com/airport/airportabout
