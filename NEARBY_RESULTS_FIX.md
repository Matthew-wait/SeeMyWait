# Nearby results: remove the 500-entry cap

## Current behavior: 5-mile radius and manual 1,000-entry batches

### Navigation overlap fix

The map page now reserves actual layout space for its bottom navigation, uses the dynamic viewport height, and limits the list to the remaining space. Explore More / Show Less and Load more remain outside the scroll area, directly above navigation. Other pages retain their existing fixed navigation. No search or radius behavior changed.

Production deployment: `dpl_37BpTKU62cv44vDDkQLneS55Qw2S`. Browser checks at 1092×943, 390×844, and 390×640 verified the button is visible and clickable, the scrollbar ends above the action rows, navigation remains at the viewport bottom, and one click loads the next batch. Checks covered initial, expanded, end-of-scroll, and post-load states. Build and scoped lint passed. Evidence: [layout checks](artifacts/nearby-nav-layout-results.json) and [live layout checks](artifacts/nearby-nav-layout-live-results.json).

Updated October 5, 2026 and deployed to https://www.seemywait.com/app, production deployment `dpl_3RQMATt2EnU3nbzo7ABzD5qpZy66`. The admin nearby-radius setting and fallback are now 5 miles. The initial request loads at most the nearest 1,000 offices. A `1,000+` count means additional results remain; each **Load more (up to 1,000)** click adds the next nearest batch. The count becomes `2,000+`, etc., while more remain and becomes exact after the final batch. The map receives only the loaded offices. Automatic full-radius loading is disabled.

The additive `nearby_clinics_batch` RPC uses a stable exact-distance/ID cursor and one extra candidate to determine whether more exist, without counting or downloading the entire radius. Indexed nearest-neighbor selection bounds the area that requires exact spheroid distance sorting. Cursor JSON preserves floating-point precision to prevent duplicate boundary rows. The existing private-helper permissions and active-clinic authorization contract are retained; RLS stays enabled.

Live verification used fresh geolocation contexts and the real API:

| Location | First displayed count | After Load more | Initial page readiness | Verification |
|---|---:|---:|---:|---|
| Miami-Dade | 1,000+ | 2,000+ | 5.2 s | One request initially; one additional request after click; stopped after each batch |
| Central Florida | 27 | No button; complete | 3.6 s | Exact count and one request |
| Islamabad | 17 | No button; complete | 3.5 s | Exact count and one request |

All three recorded zero uncaught JavaScript errors. Miami's anonymous API requests took approximately 1.7 seconds per 1,000-entry batch, with zero duplicate IDs across two batches and exact nearest-first order; all entries were within 5 miles. Page readiness timings include app startup. The build, lint, and 48 web tests pass. Strict TypeScript checking still reports only the pre-existing router prop error described below.

Evidence: [live manual-loading checks](artifacts/nearby-manual-live-results.json) and [API batch checks](artifacts/nearby-manual-batch-api-results.json). SQL: [nearby-manual-batches.sql](supabase/nearby-manual-batches.sql), with its matching generated migration. The previous 25-mile full-download rollout below is retained as historical investigation evidence and no longer describes current automatic loading.

## Previous 25-mile full-download rollout

Verified October 5, 2026. Database changes are applied to Supabase project `ziisjgtvqmturpljnvfh`. **The frontend fix is deployed to https://www.seemywait.com/app.** Vercel login restored access to the `seemywait` team; production deployment `dpl_EBijrJfPmDGg57kuz1vaQU2F36Zx` is READY and assigned to the live domain.

## Cause and resulting behavior

The nearby hook sent one `nearby_clinics` request with `p_limit: 500`. The database also bounded that legacy RPC. Both the list and map received the same 500 nearest rows, so increasing the radius never exposed the remaining clinics. The blue map circle represents the configured radius.

The updated hook keeps a fast nearest-first preview and automatically continues through every geographic page in the configured radius. Each accumulated result set is deduplicated by clinic ID and sorted by exact `distance_miles`, nearest first, with UUID as a stable tie-breaker. A zero-mile clinic is included. The loading indicator stays visible until the final cursor, and a failed page displays a retry action instead of silently looking complete.

The new `nearby_clinics_page` RPC reads small spatial sections with an ID cursor. It uses indexed spatial selection followed by primary-key hydration, and skips empty sections within a bounded request. Transport pages contain up to 1,000 entries, with a 250-entry fallback on statement timeout; **there is no total-result cap**. The page size is independent of the number of offices ultimately available in the radius. The legacy RPC remains compatible and supplies only the initial preview.

All loaded clinics are available to the map. The existing pin artwork and colors are drawn on a canvas to avoid creating 154,000 marker DOM nodes. Exact screen overlaps naturally obscure one another, and pins outside the viewport appear when the user pans or zooms. The expanded list renders a window of cards while its full scroll range includes every loaded row; card styling and the existing Explore More control are retained. Wait reports refresh separately so periodic updates do not download the whole directory again.

## Verification

| Location | Coordinates | Eligible within 25 miles | Farthest returned | Verification |
|---|---|---:|---:|---|
| Miami-Dade County | 25.8965, -80.157 | 154,273 | 24.99994 mi | Complete anonymous API pagination; frontend count and list endpoints verified |
| Central Florida | 27.7567667, -81.4639835 | 4,846 | 24.99447 mi | Complete anonymous API pagination; frontend count and list endpoints verified |

The complete Miami anonymous API run returned all 154,273 IDs with zero duplicates and no out-of-radius entries. Its measured full download took about 5.5 minutes. The updated frontend's live-data run took about 5.8 minutes for the entire Miami dataset; nearest results appear first while the remaining entries load. These measurements include downloading the entire large dataset and are not estimates for every location.

Both locations reached the final list entries at approximately 25 miles. The clean production bundle was also tested with complete live database snapshots replayed through the page-response contract, isolating rendering from network latency. Both production rendering checks recorded zero uncaught JavaScript errors, showed the correct full counts, rendered the full-radius map sources, and opened office details. Only 11 list cards needed to exist in the DOM at the far end of each scroll range.

Office details were also opened by clicking canvas map pins at both locations, confirming that marker interactions survived the rendering change.

- [Miami production screenshot](artifacts/nearby-production-miami-dade.png)
- [Central Florida production screenshot](artifacts/nearby-production-central-florida.png)
- [Complete anonymous Miami API evidence](artifacts/nearby-pagination-api-results.json)
- [Frontend runs against live API data](artifacts/nearby-pagination-browser-results.json)
- [Clean production rendering evidence](artifacts/nearby-pagination-production-results.json)

A development hot-reload run captured a Leaflet lifecycle error. Deferred map resizing now checks that its map instance is still current; clean production rendering passed afterward. Snapshot replay timing measures rendering only and must not be presented as live download time.

The production build passes. All 45 web tests passed, including five new pagination regressions; focused tests and lint passed after the final changes. Strict TypeScript checking still reports the pre-existing `BrowserRouter future` prop error in `apps/web/src/App.tsx:39`, outside this task's scope.

RLS remains enabled on `clinics`. The new public RPC is SECURITY INVOKER; its helper is in `clinic_search_internal`, uses an empty search path, and enforces the same active-clinic policy as the previously approved helper. PUBLIC execute is revoked on both new functions, anonymous callers cannot create objects in the helper schema, and anonymous nearby requests were tested successfully. Supabase's advisor connector denied access; direct privilege/configuration checks were performed instead.

The counts represent active, geocoded database entries, including individual practitioners and other provider categories. They are not deduplicated counts of physical offices. Rows without valid geocoded locations cannot be included in a geographic radius until their data is filled.

## Files and rollout

- `supabase/nearby-clinics-pagination.sql`: applied SQL for the additive read-only endpoint.
- `supabase/migrations/20261005064040_nearby_clinics_pagination.sql`: matching migration created through the Supabase CLI.
- `packages/core/src/database.types.ts`: typed page RPC.
- `apps/web/src/lib/nearby-clinics.ts`: page fetching, timeout fallback, ID deduplication, exact distance ordering.
- `apps/web/src/hooks/use-clinics.ts`: automatic progressive loading and separate report refresh.
- `apps/web/src/hooks/use-windowed-list.ts`: complete scroll range with measured card heights.
- `apps/web/src/lib/clinic-pin-layer.ts`: existing pin artwork rendered on canvas with click hit testing.
- `apps/web/src/components/map/MapView.tsx`, `ClinicListPanel.tsx`, and `apps/web/src/pages/Index.tsx`: connect the complete data set to the existing map/list flow.
- `apps/web/src/test/nearby-clinics.test.ts`: pagination and sorting regression tests.

Rollout completed using a production Vercel build and prebuilt deployment. Only the 1.5 MB application output was uploaded. The live app was rechecked with fresh geolocation contexts and the real anonymous API: Central Florida completed all 4,846 entries in approximately 37 seconds, with nearest-first list entries from 1.6 miles through 25 miles. Miami displayed 5,397 entries in approximately 15 seconds and was still loading; this smoke check stopped after proving it exceeded 500, rather than repeating the earlier complete 154,273-entry run. Both live checks recorded zero uncaught JavaScript errors and the canvas source contained the displayed result count. Timing varies with network and database load.

Live deployment evidence: [nearby-live-deployment-results.json](artifacts/nearby-live-deployment-results.json), [Central Florida screenshot](artifacts/nearby-live-central-florida.png), and [Miami screenshot](artifacts/nearby-live-miami-dade.png). The earlier complete dataset verification remains documented above. Database backfill scripts and checkpoints were not modified by this fix.
