# Ongoing tasks (handoff)

Required reading for new agents: docs/INDEXING-LOG.md (all indexes on the clinics table), docs/MAP-AND-LISTING-RULES.md (map, listing and admin rules), and docs/NPI-GAP-LOG.md (which states are missing offices and how to fill them).

Last updated 2026-10-05. Local dev server: http://127.0.0.1:8085 (admin at /admin).
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

## Waiting on the user
- Confirm the admin login header looks right.
- Confirm the imported-office view-only dialog and the Doctors/Map layout in a browser.

## Next (web)
1. Push local commits and deploy to Vercel with `npx vercel --prod --yes` (Git builds skip web changes).
2. Florida listing index built (see docs/INDEXING-LOG.md). Other states: index after the NY import and Geo backfill finish.
3. Admin-added city: rebuild the city summary when a new city is saved (decide: nightly job or on save).
4. Update the public site's map to match the admin behaviour where needed.

## Later (when time allows)

- Fill the NPI gaps for every state, starting with Florida (about 37,600 checkpointed-but-missing offices need a checkpoint fix and a retry). Full per-state list, causes and steps: docs/NPI-GAP-LOG.md. Regenerate it with scripts/npi-gap-report.mjs after each run.

- Data refresh and backup plan for the large database: the DB backup GitHub workflow (.github/workflows/db-backup.yml) is disabled. It timed out after 40 minutes at about 8.5 million rows. To do: rewrite it to run weekly or monthly, fix the timeout, then re-enable it with gh workflow enable "DB backup". Also review the nightly city count refresh (pg_cron, 03:15 UTC) once it has run.

## Next (mobile)
- Port to mobile: 50-per-batch nearby list, count, admin-set report radius and cooldown, map changes.
- Store status: iOS submitted, processing. Android submitted, in review.

## Data operations
- NY import still running. Geo backfill incomplete, so some offices may not show on the map or in search. Check with the geog state verification file.
- Duplicate-skip versus real-gap reconciliation: not finished. Retry pass for real gaps is planned.
- Gap to fill later: docs/NPI-GAP-LOG.md lists every state (staged vs live, checkpointed vs not run) and how to fill each gap. Regenerate with scripts/npi-gap-report.mjs after each import run. Florida: 63,292 gap, of which about 37,600 need a checkpoint fix and retry.

## Known limits
- Browsing order is by name within a city; search matches name, address, NPI, specialty.
- Specialty is stored as free text, so the dropdown matches the exact stored value.
- Route line uses OSRM's public server, which has usage limits.
- Radius filter only applies to rows already loaded.
