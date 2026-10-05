# Geo backfill plan

Project: ziisjgtvqmturpljnvfh. Inventory: October 4, 2026.

1. Keep the stopped global runner off. Use one runner and one state at a time.
2. Prioritize Florida first for client testing on October 5. Complete and verify FL before returning to the remaining jurisdictions in ascending inventory pending-row count.
3. Fill only missing geog with valid latitude/longitude, using committed batches of 500 and the existing state/city index. Preserve existing geog values.
4. Save progress after each committed batch. Verify no eligible missing rows remain before marking a state complete and moving to the next.
5. On a confirmed statement timeout, reduce batch size and allow more time, with at most three attempts. Stop on uncertain errors, preserving the checkpoint.
6. After all 56 jurisdictions, process the 46 eligible rows with no state separately. Recheck all states for rows added during the run.

The database global UUID cursor does not describe state completion and will remain unchanged. State progress is saved in geog-state-backfill-status.json; events are in geog-state-backfill-progress.jsonl. Completion describes rows present at verification time; future imports require another pass.

Progress as of 2026-10-05 11:27:13 PKT (UTC+05:00): 29/56 jurisdictions completed and independently reverified against the live database on October 5. All 29 have zero eligible rows without geog; missing coordinates and invalid coordinates were counted separately and both were zero in these states. Florida remains complete: all 589,657 tagged FL clinics have geog. Current state: AL (running), with 41500 committed rows in its current pass and 1320234 cumulative recorded committed rows. The sole existing state runner was safely resumed as PID 25808 at 2026-10-05 11:25:51 PKT after confirming old PID 8304 was absent and no database backfill session was active. The saved AL/Lincoln checkpoint row was confirmed to have geog, with no eligible missing rows before that city. Checkpoint values and resume position were preserved. Confirmed new commits since resume: 8000 rows across 16 batches, totaling 81.599 seconds of measured request time (individual 500-row batches: 3.319-12.945 seconds). Database activity confirmed one active AL batch with no blocking PIDs; worker stderr was empty. The worker continues the remaining 27 jurisdictions sequentially, followed by the no-state pass and final eligibility sweep. No overall completion is claimed. Before resume AL had exactly 29,278 eligible missing rows; current remaining work changes with commits. Per-state live counts and coordinate exceptions are recorded in geog-state-verification.json. Historical counters alone are not completion evidence.

Florida runner update: completed and verified after the checkpoint restarts. The runner has returned to the remaining state queue.

Performance update (October 4): non-null and null city candidates now use separate index scans, allowing the existing (state, city) index to seek from the saved city. Resumed with 500-row batches; the first two committed NY batches took 15.1 and 13.6 seconds, compared with approximately 100 seconds per 50 rows previously. These timings are observations, not a guarantee for every state.

Islamabad/Rawalpindi update (October 5): all 27 manually added clinics were independently verified by their exact UUIDs at 2026-10-05 11:26 PKT; all have geog, with zero eligible missing, missing coordinates, or invalid coordinates. Their city and state fields are null, so verification used IDs rather than city names. The user-approved private read-only spatial helper has been APPLIED to the live project; public.nearby_clinics remains SECURITY INVOKER and clinics RLS remains enabled. The helper restricts results to active clinics, uses a fixed empty search path, and has no PUBLIC execute grant. Public REST tests at 25 miles returned HTTP 200: Islamabad 27 offices (2.2s), Rawalpindi 27 (0.7s), Miami 500 (1.4s), Orlando 500 (1.3s). Database execution measured approximately 126ms in Islamabad and 240ms in Miami. Security Advisor was unavailable through the connector; direct privilege and policy checks passed. No frontend deployment or UI change was needed. Refresh https://www.seemywait.com/app in the testing Chrome profile and allow location access.

| Order | State | Pending rows at inventory | Status |
| --- | --- | --- | --- |
| 1 | FL | 417464 | Done (verified) |
| 2 | MP | 3 | Done (verified) |
| 3 | AS | 6 | Done (verified) |
| 4 | VI | 124 | Done (verified) |
| 5 | GU | 409 | Done (verified) |
| 6 | PA | 4930 | Done (verified) |
| 7 | MI | 13418 | Done (verified) |
| 8 | WY | 16684 | Done (verified) |
| 9 | TX | 17223 | Done (verified) |
| 10 | VT | 17327 | Done (verified) |
| 11 | NY | 18101 | Done (verified) |
| 12 | SD | 20375 | Done (verified) |
| 13 | PR | 20679 | Done (verified) |
| 14 | DE | 24451 | Done (verified) |
| 15 | ND | 24474 | Done (verified) |
| 16 | MT | 26232 | Done (verified) |
| 17 | RI | 29392 | Done (verified) |
| 18 | AK | 31124 | Done (verified) |
| 19 | NH | 34456 | Done (verified) |
| 20 | HI | 36806 | Done (verified) |
| 21 | ME | 38331 | Done (verified) |
| 22 | ID | 40065 | Done (verified) |
| 23 | MS | 48319 | Done (verified) |
| 24 | DC | 49275 | Done (verified) |
| 25 | NM | 59547 | Done (verified) |
| 26 | IA | 59637 | Done (verified) |
| 27 | KS | 67493 | Done (verified) |
| 28 | WV | 73327 | Done (verified) |
| 29 | AR | 76612 | Done (verified) |
| 30 | AL | 77778 | In progress |
| 31 | UT | 83091 | Pending |
| 32 | NE | 84487 | Pending |
| 33 | CT | 94928 | Pending |
| 34 | KY | 96080 | Pending |
| 35 | OK | 102348 | Pending |
| 36 | SC | 104003 | Pending |
| 37 | LA | 110292 | Pending |
| 38 | NV | 116637 | Pending |
| 39 | MO | 119243 | Pending |
| 40 | WI | 131356 | Pending |
| 41 | IN | 139182 | Pending |
| 42 | OR | 139583 | Pending |
| 43 | MN | 141187 | Pending |
| 44 | TN | 141643 | Pending |
| 45 | AZ | 159051 | Pending |
| 46 | VA | 175649 | Pending |
| 47 | CO | 178526 | Pending |
| 48 | MD | 192476 | Pending |
| 49 | GA | 198914 | Pending |
| 50 | NJ | 202734 | Pending |
| 51 | IL | 210934 | Pending |
| 52 | WA | 226576 | Pending |
| 53 | MA | 238639 | Pending |
| 54 | NC | 244214 | Pending |
| 55 | OH | 369692 | Pending |
| 56 | CA | 1086319 | Pending |





Location testing update (2026-10-05, PKT): the separate location-testing agent rechecked public REST responses at 5 and 25 miles. Islamabad returned 17/27 offices, Rawalpindi 4/27, Miami 500/500, and Orlando 500/500; all calls returned HTTP 200 with valid coordinates and distances within the requested radius (0.33-0.97 seconds). The live app returned HTTP 200. Browser geolocation verification remains blocked by the local browser automation startup ACL error.

