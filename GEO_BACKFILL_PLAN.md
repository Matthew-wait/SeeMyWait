# Geo backfill plan

Project: ziisjgtvqmturpljnvfh. Inventory: October 4, 2026.

1. Keep the stopped global runner off. Use one runner and one state at a time.
2. Prioritize Florida first for client testing on October 5. Complete and verify FL before returning to the remaining jurisdictions in ascending inventory pending-row count.
3. Fill only missing geog with valid latitude/longitude, using committed batches of 500 and the existing state/city index. Preserve existing geog values.
4. Save progress after each committed batch. Verify no eligible missing rows remain before marking a state complete and moving to the next.
5. On a confirmed statement timeout, reduce batch size and allow more time, with at most three attempts. Stop on uncertain errors, preserving the checkpoint.
6. After all 56 jurisdictions, process eligible rows with no state separately (46 at inventory; 19 in the latest live count). Recheck all states for rows added during the run.

The database global UUID cursor does not describe state completion and will remain unchanged. State progress is saved in geog-state-backfill-status.json; events are in geog-state-backfill-progress.jsonl. Completion describes rows present at verification time; future imports require another pass.

Progress as of 2026-10-06 11:15:11 PKT (UTC+05:00): 45/56 jurisdictions completed and verified; 11 remain including current state VA, followed by the no-state pass and final eligibility sweep. Arizona independently verified complete on October 6 at 11:14:46 PKT: all 161,728 rows have geog, with zero eligible missing and zero missing or invalid coordinates. Sole worker PID 5176 is confirmed running after safe resume at 2026-10-06 11:14:29 PKT with preserved adaptive settings of 62 rows / 120 seconds. Current-state recorded commits: 171,994; cumulative recorded state-runner commits: 3,275,492. Since this resume, 496 rows were confirmed committed in 8 batches, totaling 41.963 seconds of measured request time. Counters may omit earlier unlogged commits and are distinct from total existing geog. VA live snapshot at 2026-10-06 11:14:46 PKT counted 174,633 rows with geog and 3,903 eligible missing, with zero coordinate exceptions; subsequent commits continue reducing this remainder. Worker stderr is empty. The global table remains the last full-database snapshot dated October 5 at 18:55:23 PKT; no fresh global count is claimed. No overall completion is claimed.


| Last full-database snapshot at 2026-10-05 18:55:23 PKT | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog already populated | 5,028,877 |
| Still left: valid eligible rows missing geog | 3,490,386 |
| Of remaining, rows with no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

These are live snapshot counts, distinct from the October 4 inventory estimates and the cumulative recorded runner counter. Existing geog includes values populated before this state runner. The bounded read-only count query took 81.948 seconds with a 120-second statement timeout. Remaining rows decrease with subsequent commits; no-state rows are included in the still-left total.
Florida runner history: completed and verified after the checkpoint restarts. It returned to the remaining state queue before the later authentication stop.

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
| 30 | AL | 77778 | Done (verified) |
| 31 | UT | 83091 | Done (verified) |
| 32 | NE | 84487 | Done (verified) |
| 33 | CT | 94928 | Done (verified) |
| 34 | KY | 96080 | Done (verified) |
| 35 | OK | 102348 | Done (verified) |
| 36 | SC | 104003 | Done (verified) |
| 37 | LA | 110292 | Done (verified) |
| 38 | NV | 116637 | Done (verified) |
| 39 | MO | 119243 | Done (verified) |
| 40 | WI | 131356 | Done (verified) |
| 41 | IN | 139182 | Done (verified) |
| 42 | OR | 139583 | Done (verified) |
| 43 | MN | 141187 | Done (verified) |
| 44 | TN | 141643 | Done (verified) |
| 45 | AZ | 159051 | Done (verified) |
| 46 | VA | 175649 | In progress |
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


Recovery (2026-10-05 13:42 PKT): PID 25808 stopped at 13:14:53 PKT because the progress log was briefly locked by another process. The SC batch of 250 was already committed and saved in the checkpoint (84,500 rows), although its batch event was absent from the log (last event 84,250). Live verification confirmed the saved SC/Pawleys Island UUID has geog and no eligible missing rows at or before the cursor; no local or database backfill worker remained. Preserved the checkpoint and resumed without replaying that batch. Write-Event now retries only Windows sharing/lock IOException codes 32/33, with at most five delays totaling 3.1 seconds; other errors still stop safely. A real isolated exclusive-read-lock test appended exactly one event after 1.617 seconds; PowerShell parsing passed. Confirmed fresh commits and only PID 30860 running; no worker stderr. Read active logs with FileShare.ReadWrite to avoid blocking appends.






Access retry at 2026-10-05 16:11:32 PKT (UTC+05:00): re-read SUPABASE_Token_URL from apps/web/.env and retried the authorized read-only live verification request. It still returned HTTP 401 Unauthorized. No local state-runner process was found, no worker was launched, and the IN/Fort Wayne checkpoint remains 38,000 state rows / 2,421,977 cumulative committed rows. A valid refreshed token is still required before live database activity/cursor validation and safe resume.


Authentication recovery (2026-10-05 16:25 PKT): replacement authorized access passed read-only live verification. The prior 401 stop is resolved; preserved IN cursor was validated before launching sole worker PID 23388. Existing sequential state runner continues remaining jurisdictions; no global runner was launched.


Checkpoint recovery (2026-10-05 17:10 PKT): previous worker PID 23388 was absent and no database backfill session remained. Status JSON consisted of 1,883 NUL bytes, and the event log had 205 trailing NUL bytes; cause is consistent with interrupted filesystem writes but is not established. Preserved both originals as geog-state-backfill-status.corrupt-20261005-120951.json and geog-state-backfill-progress.backup-20261005-120951.jsonl. Trimmed only the trailing NUL corruption and rebuilt the last intact OR/Canby cursor from committed events (15,000 logged state rows, 2,538,159 cumulative recorded rows). Live OR coverage was 1,000 rows ahead of logged commits relative to inventory, so counters are conservative; existing geog rows are skipped safely, and completion uses live eligibility checks. IN independently verified complete at 141,394 rows, all with geog. Resumed sole runner PID 8280 without resetting progress or replaying geog writes.




Gateway recovery (2026-10-05 21:02 PKT): old PID 8280 stopped at 20:21:58 PKT with HTTP 502 Bad Gateway. Authorized read-only access succeeded afterward; no local or database backfill batch remained active. Preserved AZ/Show Low cursor bf23fdd6-91a8-4cd0-bac8-84520f84fae9 was verified to have geog, with no eligible missing rows at or before it. The failed request may have committed rows without a response, so its outcome was not added to counters. Safe resume retains the geog-is-null guard and skips any already committed rows. No global worker or duplicate state worker was launched.


Overnight recovery (2026-10-06 11:14 PKT): saved PID 28312 was absent; running=true was stale from the last batch at October 5 22:48:51 PKT. No stopped event established the exit cause. Authorized live checks found no local or database backfill worker. Saved VA/Woodbridge cursor 24301a49-cfd3-4e00-ac3b-f797cb1c7b9d has geog, with zero eligible missing at or before it, while VA still had eligible missing rows. Preserved all checkpoint values and safely resumed sole existing runner PID 5176; no global worker was launched. Unknown unlogged commits were not added to recorded counters, and geog-is-null guard skips existing writes.

