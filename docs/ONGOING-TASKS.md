# Ongoing tasks (handoff)

Required reading for new agents: docs/INDEXING-LOG.md (all indexes on the clinics table), docs/MAP-AND-LISTING-RULES.md (map, listing and admin rules), and docs/NPI-GAP-LOG.md (which states are missing offices and how to fill them).

Last updated 2026-10-06. Local dev server: http://127.0.0.1:8085 (admin at /admin).
Git: work is committed locally. Nothing is pushed unless the user asks.

## Decided
- Admin city dropdown counts refresh nightly at 03:15 UTC (pg_cron job refresh-clinic-city-summary, migration 20261005140000). A city added today appears after the next run.
- No city name clean-up. City dropdown shows stored names as separate entries.

## Done (committed locally, not pushed)
- City and specialty summary tables, with public read policies.
- Admin Doctors: state and city dropdowns (searchable, required), specialty, radius (empty by default, from admin location), A–Z filter, name/address/NPI search, List/Map toggle, Load 50 more (keeps rows, spinner and tick), map follows the listed rows with its own Load 50 more, hover popup on pins, view-on-map card.
- Admin add/edit: state and city dropdowns, "add new city" option.
- NPI-imported offices: `npi_imported` column (true for imported, false for admin-created), view-only edit with tag.
- Admin layout: full-width header, 1440px content cap, tiles for total, state, city, pending, reports.
- Admin login: landing logo, simplified full-width header.
- Office sheet (public site): View on map (route), Get Directions.

### 2026-10-06 session
- **Map pin clustering** (public + Admin map): `supercluster`-based clustering in `apps/web/src/lib/clinic-pin-layer.ts`, canvas-rendered, so dense areas don't show hundreds of raw pins. Tapping a cluster zooms in.
- **Same-building picker**: pins within 10px of each other at the current zoom group into a "stack"; tapping opens `ClinicStackPicker` (portal-based popup, escapes Admin's `overflow-hidden` map container) listing each office to pick from. See docs/MAP-AND-LISTING-RULES.md.
- **Cooldown is now global per device**, not per office (previously a device could spam reports across different offices back-to-back). Index added in migration `20261006140000_global_device_cooldown_index.sql`.
- **Report expiry decoupled from cooldown, and made per-category**: 30/60/90-min reports each have their own admin-configurable expiry window (`report_expiry_30min_minutes` / `_60min_minutes` / `_90plus_minutes` in `app_settings`, migration `20261006150000_per_category_report_expiry.sql`). On Time stays a fixed 60-minute window. Ported to mobile too (`apps/mobile/src/lib/wait-time-report.ts`, `use-app-settings.ts`, `use-clinics.ts`).
- **Realtime push updates**: an already-open clinic view now updates within ~1s of another user's report via Supabase Realtime on `wait_time_reports` (migration `20261006160000_wait_time_reports_realtime.sql`, enables `REPLICA IDENTITY FULL` + adds the table to the `supabase_realtime` publication — user ran this migration directly, confirmed applied). 60s poll remains as a fallback.
- **Fixed a "resurrection" bug**: an old/superseded report could incorrectly reappear as the active one after the newer report's own expiry or flag status should have superseded it permanently. Standing rule now: only the single most recent report ever counts, full stop — never fall back to an older one, whether the newer one lost its status via expiry or via an admin flag. Fixed in `wait-time-utils.ts` (`getAverageWaitTime`) and `AdminDashboard.tsx` (`mostRecentReportByClinic` / `isReportActive`); confirmed already correct in mobile's `use-clinics.ts`. Callers must not pre-filter `is_flagged=false` in their queries, or the function never sees a flagged row to know to stop there.
- **Admin Reports flag/unflag**: restored after being removed (should not have been removed without re-confirming with the user first — noted as a standing lesson). Flagging a report now cascades to every other currently-"active" report on the same clinic, not just the one clicked.
- **Admin Doctors "Reset Filters" button**: returns state/city/specialty/radius/search/letter filters to the page's fresh-load defaults.
- **Admin Doctors "Hide/Show" (soft-hide)**: new reversible visibility toggle (eye icon) on `is_active`, separate from Delete. Hidden offices are excluded from all public queries but still show (dimmed, labelled "Hidden") in the Admin list. See the "Doctor office visibility" section in docs/MAP-AND-LISTING-RULES.md for the RLS fix this needed (migration `20261006170000_admin_view_inactive_clinics.sql`) — worth reading before touching other admin-only mutations on `clinics`.
- Settings save switched from looped `.update()` calls to a single `.upsert(..., { onConflict: "key" })`, fixing a silent no-op when an `app_settings` row didn't exist yet.

## Waiting on the user
- Confirm the admin login header looks right.
- Confirm the imported-office view-only dialog and the Doctors/Map layout in a browser.

## Next (web)
1. Push local commits and deploy to Vercel with `npx vercel --prod --yes` (Git builds skip web changes).
2. Florida listing index built (see docs/INDEXING-LOG.md). Other states: index after the NY import and Geo backfill finish.
3. Admin-added city: rebuild the city summary when a new city is saved (decide: nightly job or on save).
4. Update the public site's map to match the admin behaviour where needed.

## Next: iOS release (see docs/IOS-BUILD-AND-SUBMIT.md)

- Build 11 (5.6) submitted to TestFlight. Test on a phone.
- Fix duplicate React versions flagged by expo doctor.
- Renew the distribution certificate before 2027-06-30.
- Android build and Play Store upload: wait for go-ahead.

## Later (when time allows)

- Fill the NPI gaps for every state, starting with Florida (about 37,600 checkpointed-but-missing offices need a checkpoint fix and a retry). Full per-state list, causes and steps: docs/NPI-GAP-LOG.md. Regenerate it with scripts/npi-gap-report.mjs after each run.

- Data refresh and backup plan for the large database: the DB backup GitHub workflow (.github/workflows/db-backup.yml) is disabled. It timed out after 40 minutes at about 8.5 million rows. To do: rewrite it to run weekly or monthly, fix the timeout, then re-enable it with gh workflow enable "DB backup". Also review the nightly city count refresh (pg_cron, 03:15 UTC) once it has run.

## Next (mobile)
- Port to mobile: 50-per-batch nearby list, count, admin-set report radius and cooldown, map changes.
- Port the 2026-10-06 session's web changes to mobile where not already done: map pin clustering + same-building picker (mobile has neither yet), realtime push updates (mobile still polls only), the Hide/Show visibility toggle has no mobile-side effect needed since it's an admin-only, web-only action — but mobile's own clinic list query must already respect `is_active` (confirm it does). Per-category report expiry and global cooldown are already ported (see above).
- Store status: iOS submitted, processing. Android submitted, in review.

## Data operations
- NY import still running. Geo backfill incomplete, so some offices may not show on the map or in search. Check with the geog state verification file.
- **Unresolved (2026-10-06): a heavy `count(*) ... filter (where ...)` query (120s statement timeout, full-table I/O on the 8.5M-row `clinics` table) was seen running as two concurrent connections in `pg_stat_activity`, and appears to starve unrelated single-row UPDATEs (e.g. the Hide/Show toggle times out with `"canceling statement due to statement timeout"` behind it — confirmed unrelated to RLS, reproduces identically with the service-role key). Exact source not yet identified — not in `AdminDashboard.tsx` (its own total count uses the cheap `count: "estimated"`), not in `resume-geog-backfill.ps1` or `resume-geog-states.ps1` as searched. Likely a verification/progress-check query run manually or periodically against the geo backfill — check for another open SQL Editor tab or terminal before debugging further.
- Duplicate-skip versus real-gap reconciliation: not finished. Retry pass for real gaps is planned.
- Gap to fill later: docs/NPI-GAP-LOG.md lists every state (staged vs live, checkpointed vs not run) and how to fill each gap. Regenerate with scripts/npi-gap-report.mjs after each import run. Florida: 63,292 gap, of which about 37,600 need a checkpoint fix and retry.

## Known limits
- Browsing order is by name within a city; search matches name, address, NPI, specialty.
- Specialty is stored as free text, so the dropdown matches the exact stored value.
- Route line uses OSRM's public server, which has usage limits.
- Radius filter only applies to rows already loaded.

## Admin "Delete" on wait reports = expire (note)

- Admin Delete on a report no longer removes the row. It sets `is_flagged = true`, the same as Flag.
- Effect: the report moves to the Expired tab, the office reads On Time, and older reports for that office do not come back as active.
- Mobile applies the same rule: a flagged newest report reads On Time, and flagged reports are hidden from the recent-activity history.
- Open point: deleted and flagged reports look the same in the database. If the admin ever needs to tell them apart, add a separate column.
