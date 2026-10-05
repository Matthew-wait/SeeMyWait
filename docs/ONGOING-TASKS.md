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

## In progress
- Specialty dropdown in the top row of the Doctors tab. The summary table is built; the dropdown UI is not wired yet. Options come from clinic_specialty_summary for the selected state; default "All specialties".

## Next
1. Merge the Doctors and Map tabs into one screen: state and city dropdowns, search, specialty dropdown, then a split view with the list and the map.
   - Map markers come from the same city query, capped at 500, with a note if there are more.
   - Clicking a list row centres the map on that office.
2. Letter filter (A, B, C...) within the selected city (name range scan).
3. Admin add and edit forms use the same state and city dropdowns. A new city needs an explicit admin "add new city" option.
4. City name clean-up (for example "Miami Gradens" -> "Miami Gardens"), starting with the big cities. Review the rest with the user.
5. Index on (state, city, name), to be built when the NY import is finished (heavy build on the live database).

## Known limits
- Browsing order is by name within a city; search matches name, address, NPI, specialty.
- Specialty is stored as free text (some values are comma-separated), so the dropdown matches the exact stored value.
- OSRM public routing server is used for the route line; it has usage limits.
- Public Supabase reads on the summary tables are allowed by policy; no sensitive data there.
