# Ongoing tasks (handoff)

Status as of 2026-10-05. Local testing at http://127.0.0.1:8086 (admin at /admin).
Git: local commits only, not pushed, unless the user says otherwise.

## Done
- City summary table (56 jurisdictions, 34,529 cities) + public read policy.
- State and city dropdowns on the admin Doctors tab (default Florida / Miami), with office count.
- Doctors list: 50 per page, "Load more", search by name, address, NPI, specialty text filter.
- Specialty summary table (per state) + refresh function + public read policy (migration 20261005120000, local commit 6a6e845).
- Office sheet (user site): "View on map" draws the driving route; "Get Directions" opens Google Maps from current location (local commit 91ceee1).
- Admin layout: full width, capped at 1440px, 40px side padding (local commits 677f80c, d89af5b).

## Done (latest)
- Specialty dropdown (top row) and A-Z letter filter on the Doctors tab (local commit 7bff780).
- Admin add and edit forms: state and city dropdowns, with "+ Add new city" (local commit aad39e6).
- Doctors and Map merged into one screen; map markers from the city, capped at 500; row click centres the map (local commits d5b39b6, e394107).
- City clean-up proposal written for review, no data changed (docs/CITY-CLEANUP-PROPOSED.md, local commit ea00f8d).

## In progress
- Nothing in progress.

## Waiting on the user
1. Approve the city clean-up rule and the typo mappings (docs/CITY-CLEANUP-PROPOSED.md), then apply and rebuild the city summary.
2. Index on (state, city, name): build when the NY import is finished (heavy build on the live database).

## Notes
- Newly added cities appear in the dropdown only after the city summary is rebuilt.

## Known limits
- Browsing order is by name within a city; search matches name, address, NPI, specialty.
- Specialty is stored as free text (some values are comma-separated), so the dropdown matches the exact stored value.
- OSRM public routing server is used for the route line; it has usage limits.
- Public Supabase reads on the summary tables are allowed by policy; no sensitive data there.
