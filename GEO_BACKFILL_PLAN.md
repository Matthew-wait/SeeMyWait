# Geo backfill plan

Project: ziisjgtvqmturpljnvfh. Inventory: October 4, 2026.

1. Keep the stopped global runner off. Use one runner and one state at a time.
2. Prioritize Florida first for client testing on October 5. Complete and verify FL before returning to the remaining jurisdictions in ascending inventory pending-row count.
3. Fill only missing geog with valid latitude/longitude, using committed batches of 500 and the existing state/city index. Preserve existing geog values.
4. Save progress after each committed batch. Verify no eligible missing rows remain before marking a state complete and moving to the next.
5. On a confirmed statement timeout, reduce batch size and allow more time, with at most three attempts. Stop on uncertain errors, preserving the checkpoint.
6. After all 56 jurisdictions, process eligible rows with no state separately (46 at inventory; 19 in the latest live count). Recheck all states for rows added during the run.

The database global UUID cursor does not describe state completion and will remain unchanged. State progress is saved in geog-state-backfill-status.json; events are in geog-state-backfill-progress.jsonl. Completion describes rows present at verification time; future imports require another pass.

Stopped by explicit user request at 2026-10-06 11:22:41 PKT (UTC+05:00). Confirmed local SeeMyWait runner PID 5176 was stopped; no replacement or global runner was launched. 46/56 jurisdictions are completed and verified; 10 remain, with current checkpoint in CO. Saved CO/Aurora cursor b1a27b88-0c60-412f-9c4b-183fbfb3504b was live-verified to have geog. Preserved checkpoint values: 17,000 recorded CO commits and 3,296,085 cumulative recorded commits. Recorded counters may omit earlier unlogged commits and the final in-flight request; no additional commits are claimed without a confirmed response. Global table below remains the last full-database snapshot at October 6 11:16:42 PKT. No background continuation or overall completion is claimed.


| Live database totals at 2026-10-06 11:16:42 PKT | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog already populated | 5,368,797 |
| Still left: valid eligible rows missing geog | 3,150,466 |
| Of remaining, rows with no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

These are live snapshot counts, distinct from the October 4 inventory estimates and cumulative recorded runner commits. Existing geog includes values populated before this state runner. The bounded read-only count query took 20.275 seconds with a 120-second statement timeout. Remaining rows decrease with subsequent commits; no-state rows are included in the still-left total.
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
| 46 | VA | 175649 | Done (verified) |
| 47 | CO | 178526 | Stopped (checkpoint preserved) |
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


Stop verification at 2026-10-06 11:22:56 PKT (UTC+05:00): no local SeeMyWait state/global runner remained, and the authorized pg_stat_activity check returned no active or leftover backfill batch. The final database request finished after the local runner stop; its commit outcome was not added to counters. No postgres or Supabase internal session was terminated. Work is stopped until explicit new instructions.


## Progress update: 2026-10-06 11:22 PKT (UTC+05:00)

Worker status: sole state runner PID 5176 has exited; no runner process remains. The status file still reads `running: true`, which is stale. Its saved cursor (CO/Aurora, `last_id` b1a27b88-0c60-412f-9c4b-183fbfb3504b, `state_rows_updated` 17000) matches the last committed event in the progress log (06:21:56Z). No duplicate or global worker is running, and no leftover backfill session was seen in pg_stat_activity. The cause of the exit is not recorded in the log; it was stopped by the operator.

Completed and verified: 46/56 jurisdictions. VA was completed by the runner and re-verified live at 06:21Z (zero eligible missing with valid coordinates).

Remaining jurisdictions (10): CO (in progress, cursor saved), MD, GA, NJ, IL, WA, MA, NC, OH, CA. After these: the no-state pass (19 rows), then a final sweep for newly added or missed rows.

Throughput: last 40 committed batches of 500 rows took 240 s of batch time (about 70 rows/s; 16,931 rows over a 250 s wall span, about 66 rows/s). Batch size 500 in the status file; timeout_seconds 30. The 62-row / 120-second adaptive settings in the earlier handoff are not in the current status file.

Live database totals at 2026-10-06 06:21Z (11:21 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 5,387,720 |
| Still left: valid eligible rows missing geog, with state | 3,131,524 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Recorded runner counters are conservative: cumulative recorded state-runner commits are 3,295,585 and may omit unlogged commits. Live counts, not counters, determine completion. Completion is not claimed; the backfill is not finished.

To resume: run `scripts/resume-geog-states.ps1` as the sole worker, after confirming no other runner or database backfill session is active. The script keeps the geog-is-null guard and reads its saved cursor. The global `public.backfill_clinics_geog_batch` must not run alongside it.

## Progress update: 2026-10-06 12:50 PKT (UTC+05:00)

Worker: sole adaptive state runner PID 30456, started 11:27 PKT by the restart from the saved cursor (the earlier PID 7644 was stopped; no other runner or database backfill session was active when checked). Adaptive levels are 300, 500, 1000, and 1500 rows per batch, stepping up after batches under 5 s and down after batches over 12 s. A statement timeout halves the batch with a floor of 300.

Completed: 48/56 jurisdictions. Runner-recorded completion includes VA, CO, and MD, each finished after the runner's own post-state check. Live check of CO and MD has not been run separately.
Remaining: GA (in progress, 191,650 state rows so far), NJ, IL, WA, MA, NC, OH, CA; then the 19-row no-state pass; then a final sweep.

Throughput since the 11:27 PKT restart: 297 committed batches, 283,976 rows, about 114 rows/s average. Recent 1000-row batches took about 4.8 to 7.3 s. One timeout_retry at 12:29 PKT (batch 750, 60 s timeout) was handled by the runner.

Live database totals at 2026-10-06 07:50Z (12:50 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 5,937,872 |
| Still left: valid eligible rows missing geog, with state | 2,581,372 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Completion is not claimed. Counts are a live snapshot and change as the runner commits.

## Status update: 2026-10-06 12:56 PKT (UTC+05:00)

Runner: adaptive state runner PID 30456, running. Current state: NJ (state 49 of 56 complete; GA finished at 07:50:51Z). Batch sizes 300 to 1500 adaptively; status file shows 1500 with a 30-second timeout.

States complete: 49 of 56. Remaining: NJ (in progress), IL, WA, MA, NC, OH, CA (7 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 30 minutes (since 12:26 PKT): 222,364 committed rows across 220 batches, in 1,795 seconds of batch-timestamp span. Averages: 123.9 rows/s, about 7,431 rows/min.
Average since the 12:27 PKT restart: 570,166 rows over 5,307 s, about 107.4 rows/s, about 6,444 rows/min.

Live database totals at 2026-10-06 07:55Z (12:55 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 5,976,136 |
| Still left: valid eligible rows missing geog, with state | 2,543,108 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion estimate: 2,543,127 rows left. At the 30-minute rate (123.9 rows/s), about 5.7 hours (around 18:40 PKT). At the since-restart average (107.4 rows/s), about 6.6 hours (around 19:30 PKT). These are estimates; the state sizes vary, and the no-state and final sweep add time.

Completion is not claimed.

## Status update: 2026-10-06 13:28 PKT (UTC+05:00)

Runner: adaptive state runner PID 30456, running at 08:27Z. Current state: IL (46,700 state rows so far in this state). Status file: batch size 500, timeout 60 seconds.

States done in the last 30 minutes: 1 (NJ, finished 08:18:04Z).
Overall states done: 50 of 56. Remaining: IL (in progress), WA, MA, NC, OH, CA (6 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 30 minutes: 201,684 committed rows across 213 batches, in 1,796 seconds of batch-timestamp span. Average 112.3 rows/s, about 6,736 rows/min.
Average since the 12:27 PKT restart: 782,350 rows over 7,191 s, 108.8 rows/s, about 6,528 rows/min.

Live database totals at 2026-10-06 08:27Z (13:27 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,189,570 |
| Still left: valid eligible rows missing geog, with state | 2,329,674 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 2,329,693 rows left. At the 30-minute rate (112.3 rows/s), about 5.8 hours (around 19:15 PKT). At the since-restart average (108.8 rows/s), about 5.95 hours (around 19:25 PKT). These are estimates; the no-state pass and final sweep are not included.

Completion is not claimed.

## Status update: 2026-10-06 13:59 PKT (UTC+05:00)

Runner: adaptive state runner PID 30456, running at 08:59Z. Current state: WA (8,000 state rows so far). Status file: batch size 1000, timeout 30 seconds.

States done in the last 30 minutes: 1 (IL, finished 08:57:52Z).
Overall states done: 51 of 56. Remaining: WA (in progress), MA, NC, OH, CA (5 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 30 minutes: 164,234 committed rows across 189 batches, in 1,781 seconds of batch-timestamp span. Average 92.2 rows/s, about 5,533 rows/min.
Average since the 12:27 PKT restart: 955,084 rows over 9,093 s, 105.0 rows/s, about 6,302 rows/min.

Live database totals at 2026-10-06 08:59Z (13:59 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,361,804 |
| Still left: valid eligible rows missing geog, with state | 2,157,440 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 2,157,459 rows left. At the 30-minute rate (92.2 rows/s), about 6.5 hours (around 21:30 PKT). At the since-restart average (105.0 rows/s), about 5.7 hours (around 20:40 PKT). Estimates only; the no-state pass and final sweep are not included.

Completion is not claimed.

## Status update: 2026-10-06 14:30 PKT (UTC+05:00)

Runner: adaptive state runner PID 30456, running at 09:29Z. Current state: WA (217,100 state rows so far). Status file: batch size 500, timeout 60 seconds.

States done in the last 30 minutes: 0. No state completed in this window; WA is still in progress.
Overall states done: 51 of 56. Remaining: WA (in progress), MA, NC, OH, CA (5 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 30 minutes: 205,600 committed rows across 222 batches, in 1,787 seconds of batch-timestamp span. Average 115.0 rows/s, about 6,902 rows/min.
Average since the 12:27 PKT restart: 1,164,184 rows over 10,942 s, 106.4 rows/s, about 6,384 rows/min.

Live database totals at 2026-10-06 09:29Z (14:29 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,570,904 |
| Still left: valid eligible rows missing geog, with state | 1,948,340 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,948,359 rows left. At the 30-minute rate (115.0 rows/s), about 4.7 hours (around 19:10 PKT). At the since-restart average (106.4 rows/s), about 5.1 hours (around 19:35 PKT). Estimates only; the no-state pass and final sweep are not included.

Completion is not claimed.

## Status update: 2026-10-06 15:02 PKT (UTC+05:00)

Runner: adaptive state runner PID 30456, running at 10:02Z. Current state: MA (105,650 state rows so far). Status file: batch size 300, timeout 120 seconds.

Timeouts: four timeout_retry events since 09:37Z (MA, batch sizes 750, 500, 300, 300). The runner stepped down to 300-row batches with a 120-second timeout after the last two. This is the cause of the lower recent rate.

States done in the last 30 minutes: 0 by the 14:32 to 15:02 PKT window. WA completed at 09:31:56Z (14:31:56 PKT), four seconds before the window opened.
Overall states done: 52 of 56. Remaining: MA (in progress), NC, OH, CA (4 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 30 minutes: 104,650 committed rows across 133 batches, in 1,563 seconds of batch-timestamp span. Average 67.0 rows/s, about 4,018 rows/min.
Average since the 12:27 PKT restart: 1,279,310 rows over 12,642 s, 101.2 rows/s, about 6,072 rows/min.

Live database totals at 2026-10-06 10:02Z (15:02 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,686,030 |
| Still left: valid eligible rows missing geog, with state | 1,833,214 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,833,233 rows left. At the 30-minute rate (67.0 rows/s), about 7.6 hours (around 22:40 PKT). At the since-restart average (101.2 rows/s), about 5.0 hours (around 20:05 PKT). The 30-minute rate depends on the current timeouts, so the restart average is the more likely guide if the database recovers. Estimates only; the no-state pass and final sweep are not included.

Completion is not claimed.

## Status update: 2026-10-06 15:34 PKT (UTC+05:00): runner stopped

Runner: adaptive state runner PID 30456 is NOT running. No runner process found at 10:34Z. Status file: running=false, state MA, state rows 105,650, batch size 500, timeout 120 seconds, error "The remote server returned an error: (400) Bad Request."

Stop event: 10:04:18Z (15:04 PKT), state MA, error "The remote server returned an error: (400) Bad Request." The runner stopped without a confirmed statement timeout (57014), so it did not retry. This is the safe-stop path. The HTTP 400 is not explained by the log, and it is not known whether the request that received the 400 committed any rows. The last committed batch is 09:58:11Z (300 rows, cursor 5d8edfad-1564-4d93-bc29-586779c0692f). Two timeout_retry events preceded the stop (10:00:13Z and 10:02:16Z, both at batch 300, next timeout 120 seconds).

Cause: not established. The 400 response is an unexpected error from the Supabase management API, not a confirmed statement timeout. No backfill session was checked during this update; a live check is needed before resuming.

Live verification at 10:34Z (15:34 PKT) shows no commits since 10:02Z: done 6,686,030 (unchanged from the 15:02 PKT update). No batches were committed in the last 30 minutes.

States done in the last 30 minutes: 0. Overall states done: 52 of 56. Remaining: MA (in progress, 105,650 state rows), NC, OH, CA (4 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 30 minutes: 0.
Overall rows done: 6,686,030. Remaining: 1,833,214 valid with state, 19 with no state. Missing coordinates: 0. Invalid coordinates: 0.

Average since the 12:27 PKT restart: 1,279,310 committed rows over 12,642 s, 101.2 rows/s, about 6,072 rows/min. This average excludes the stopped period.

Time to completion: not computable while stopped. At the restart average (101.2 rows/s), 1,833,233 remaining rows would take about 5.0 hours of running time after a resume.

Resume requires explicit approval. The runner's geog-is-null guard and saved cursor make a resume from the saved MA cursor safe.

Completion is not claimed.

## Status update: 2026-10-06 16:02 PKT (UTC+05:00): runner resumed

Runner: adaptive state runner PID 38060 started at 11:01:26Z (16:01 PKT) from the saved MA cursor, with batch size 500 and no settings reset. It is running and committing at 11:02:41Z. Five batches committed so far (3,300 rows), with state MA at 108,950 state rows.

Before the start, one geog-related session was seen in pg_stat_activity. It was not identified and was not cancelled; it had finished by the next check, and no session matched at 11:02Z. The earlier runner stop (HTTP 400 at 10:04:18Z, PID 30456) remains unexplained.

States done: 52 of 56. Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.
Live totals at the 10:34Z check, carried forward until the next live count: done 6,686,030; remaining 1,833,214 with a state and 19 with no state; missing coordinates 0; invalid coordinates 0.

Completion is not claimed.

## Status update: 2026-10-06 16:05 PKT (UTC+05:00)

Runner: adaptive state runner PID 38060, running at 11:05Z. Current state: MA (122,450 state rows so far). Status file: batch size 1000, timeout 120 seconds, error empty.

Timeouts and stops: no timeout_retry events and no stopped events in the last 30 minutes. The earlier runner (PID 30456) stopped at 10:04:18Z with HTTP 400 and was not restarted until 11:01:26Z (16:01 PKT) under approval; PID 38060 is the only runner since then.

States done in the last 30 minutes: 0 (no state completed since WA at 09:31:56Z).
Overall states done: 52 of 56. Remaining: MA (in progress), NC, OH, CA (4 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 30 minutes: 16,800 committed rows across 20 batches, all by PID 38060 from 11:01:51Z.
Average since the restart: 94.2 rows/s, about 5,654 rows/min (16,800 rows over 178 s; the runner has run for about 3 minutes, so this average is short-term).

Live database totals at 2026-10-06 11:05Z (16:05 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,702,830 |
| Still left: valid eligible rows missing geog, with state | 1,816,414 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,816,433 rows left. At 94.2 rows/s, about 5.4 hours (around 21:30 PKT). This estimate depends on a three-minute average and may shift as the runner settles.

Completion is not claimed.

## Status update: 2026-10-06 16:44 PKT (UTC+05:00): runner stopped

Runner: adaptive state runner PID 38060 is NOT running at 11:44Z (16:44 PKT). The status file still reads running=true, which is stale. The runner exited silently after its last event, a timeout_retry at 11:25:18Z (batch 300, next timeout 120 seconds). No stopped event or error was logged, so the cause is not established. The timeouts preceding the exit were at 11:17:35Z, 11:19:37Z, 11:23:16Z, and 11:25:18Z, all at batch size 300. This is consistent with a database that was slow or busy, but that is not confirmed.

No restart was attempted. Restarting requires approval.

States done in the last 30 minutes: 0. No state has completed since WA at 09:31:56Z.
Overall states done: 52 of 56. Current state: MA (162,850 state rows at the last commit). Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.

Rows done in the last 30 minutes: 7,200 committed rows across 18 batches, all by PID 38060 before its exit (last commit 11:21:13Z).
Average since the 16:01 PKT restart: 57,200 rows over 1,162 s, 49.2 rows/s, about 2,954 rows/min. The rate fell during the timeout period.

Live database totals at 2026-10-06 11:44Z (16:44 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,743,230 |
| Still left: valid eligible rows missing geog, with state | 1,776,014 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: not computable while stopped. At the restart average (49.2 rows/s), 1,776,033 rows would take about 10 hours of running time. At the earlier 101.2 rows/s average, it would take about 4.9 hours.

Resume from the saved MA cursor requires approval. The geog-is-null guard keeps a resume safe.

Completion is not claimed.

## Status update: 2026-10-06 17:36 PKT (UTC+05:00): runner still stopped

Runner: PID 38060 is NOT running at 12:36Z (17:36 PKT). No resume process is running. Last progress event: timeout_retry at 11:25:18Z. No commits since then, which is about 71 minutes. Restart requires approval.

States done in the last 30 minutes: 0. Overall states done: 52 of 56. Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.
Rows done in the last 30 minutes: 0.

Live database totals at 2026-10-06 12:36Z (17:36 PKT), unchanged from 11:44Z:

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,743,230 |
| Still left: valid eligible rows missing geog, with state | 1,776,014 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: not computable while stopped. Completion is not claimed.

## Status update: 2026-10-06 17:38 PKT (UTC+05:00): runner resumed

Runner: adaptive state runner PID 21240 started at 12:37Z (17:37 PKT) from the saved MA cursor with batch size 500, under approval. Committing at 12:38:34Z: 1000-row batches, MA at 167,150 state rows.

Leftover session check before start: the query returned no backfill session. The one-row result was an empty response, not a session.

States done: 52 of 56. Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.
Rows and live totals: to be refreshed at the next live count. The last verified totals were at 12:36Z: done 6,743,230; remaining 1,776,014 with a state, plus 19 with no state; missing coordinates 0; invalid coordinates 0.

Completion is not claimed.

## Status update: 2026-10-06 18:40 PKT (UTC+05:00): runner stopped again (HTTP 502)

Runner: PID 21240 stopped at 12:51:58Z (17:52 PKT) with "The remote server returned an error: (502) Bad Gateway", state MA. Its last event before the stop was a timeout_retry at 12:50:31Z (batch 500, next timeout 120 seconds). Not running at 13:40Z. Restart requires approval.

Committed by PID 21240 before the stop: 57 batches, 44,500 rows, last commit 12:48:28Z, MA at 207,350 state rows.

A 502 can commit without returning a response. Lingering check at 13:40Z: no active clinics sessions in pg_stat_activity, so no in-flight batch remains. Completion of the 502 request is still unknown, but the live counts and the geog IS NULL guard make a resume safe.

States done in the last 30 minutes: 0. Overall states done: 52 of 56. Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.
Rows done in the last 30 minutes: 44,500 (through 12:48:28Z).

Live database totals at 2026-10-06 13:40Z (18:40 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,787,730 |
| Still left: valid eligible rows missing geog, with state | 1,731,514 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: not computable while stopped. Completion is not claimed.

## Status update: 2026-10-06 18:51 PKT (UTC+05:00): runner resumed after 502 stop

Runner: adaptive state runner PID 21424 started at about 13:50Z (18:50 PKT) from the saved MA cursor, under approval, with batch size 500. Committing at 13:51:24Z (18:51 PKT): 500-row batches, MA at 209,350 state rows.

Leftover check before start: no active clinics sessions in pg_stat_activity.

States done: 52 of 56. Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.
Live totals: last verified at 13:40Z (18:40 PKT): done 6,787,730; remaining 1,731,514 with a state, plus 19 with no state; missing coordinates 0; invalid coordinates 0. These will be refreshed at the next live count.

Completion is not claimed.

## Status update: 2026-10-06 21:00 PKT (UTC+05:00): runner stopped (HTTP 400)

Runner: PID 21424 stopped at 14:03:12Z (19:03 PKT) with "The remote server returned an error: (400) Bad Request.", state MA. Preceding events: timeout_retry at 13:59:06Z and 14:01:09Z (batch 300, next timeout 120 seconds). Last committed batch: 13:57:04Z (18:57 PKT). Not running at 16:00Z (21:00 PKT). Restart requires approval.

Pattern across stops: each stop came shortly after timeout retries (10:00 and 10:02Z before a 400; 12:50Z before a 502; 13:59 and 14:01Z before this 400). This points to database or gateway load during MA, but that is not confirmed.

Rows done in the last 30 minutes: 0 (no commits after 13:57:04Z).
Since the 13:50Z restart: 18,400 rows over about 384 s, about 48 rows/s, about 2,880 rows/min. This covers a short window.

States done: 52 of 56. Current state: MA (225,750 state rows at the last status write). Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.
States done in the last 30 minutes: 0.

Live database totals at 2026-10-06 16:00Z (21:00 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,806,130 |
| Still left: valid eligible rows missing geog, with state | 1,713,114 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: not computable while stopped. At about 48 rows/s, about 10 hours of running time. At the earlier 101 rows/s average, about 4.7 hours.

Completion is not claimed.

## Status update: 2026-10-06 21:23 PKT (UTC+05:00): runner resumed at lower batch size

Change: the runner script's batch cap is lowered to 500 and its starting size to 300 rows (levels 300 and 500 only; minimum 300). Timeout reset to 30 seconds on start, with the existing doubling on timeouts up to 120 seconds.

Runner: PID 24716 started at about 16:22Z (21:22 PKT) from the saved MA cursor, under approval. Committing at 16:22:50Z (21:22 PKT): 300-row batches, MA at 226,950 state rows.

Leftover check before start: no active clinics sessions in pg_stat_activity.

States done: 52 of 56. Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.
Live totals: last verified at 16:00Z (21:00 PKT): done 6,806,130; remaining 1,713,114 with a state, plus 19 with no state; missing coordinates 0; invalid coordinates 0. These will be refreshed at the next live count.

Completion is not claimed.

## Status update: 2026-10-06 22:37 PKT (UTC+05:00): runner stopped (HTTP 544)

Runner: PID 24716 stopped at 16:24:51Z (21:24 PKT) with "The remote server returned an error: (544) <none>", state MA. It committed 20 batches (8,200 rows) before the stop; last commit 16:24:38Z (21:24 PKT), MA at 233,950 state rows. Not running at 17:37Z (22:37 PKT). No timeout_retry events preceded this stop. Restart requires approval.

Batch sizes: the runner stepped up to 500 rows after fast commits, so the lowered cap did not hold the batch at 300 for this run. Limits are 300 to 500 rows per batch.

Lingering check at 17:37Z: no active clinics sessions. The 544 response is not covered by the earlier 502/400 pattern; cause not established.

Rows done in the last 30 minutes: 0 (no commits after 16:24:38Z). Since the 16:22Z restart: 8,200 rows, about 64.6 rows/s (about 3,874 rows/min), over a very short window.
States done in the last 30 minutes: 0. Overall states done: 52 of 56. Current state: MA (233,950 state rows at last commit). Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.

Live database totals at 2026-10-06 17:37Z (22:37 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,814,330 |
| Still left: valid eligible rows missing geog, with state | 1,704,914 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: not computable while stopped. Completion is not claimed.

## Status update: 2026-10-06 22:41 PKT (UTC+05:00): runner resumed

Runner: PID 13228 restarted at about 17:40Z (22:40 PKT) from the saved MA cursor, at 300-row batch start, under standing approval for restarts on update requests. Committing at 17:41:25Z (22:41 PKT): MA at 235,250 state rows. A 21-second batch appeared at 17:41:16Z before settling.

Leftover check before start: no active clinics sessions.

States done: 52 of 56. Remaining: MA (in progress), NC, OH, CA, then the 19 no-state rows, then the final sweep.
Live totals: last verified at 17:37Z (22:37 PKT): done 6,814,330; remaining 1,704,914 with a state, plus 19 with no state; missing coordinates 0; invalid coordinates 0. These will be refreshed at the next live count.

Completion is not claimed.

## Status update: 2026-10-06 22:47 PKT (UTC+05:00)

Runner: PID 13228 running at 17:47Z (22:47 PKT), now on NC. Restarted at 22:40 PKT under standing approval; no timeout retries or stops since.

States done in the last 15 minutes: 1 (MA, finished 17:42:54Z = 22:42 PKT).
Overall states done: 53 of 56. Remaining: NC (in progress), OH, CA (3 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 24,789 across 54 batches, all since the 22:40 PKT restart.
Average since restart: about 70 rows/s, about 4,200 rows/min (short window, since restart only).

Live database totals at 2026-10-06 17:47Z (22:47 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,839,619 |
| Still left: valid eligible rows missing geog, with state | 1,679,625 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,679,644 rows left. At about 70 rows/s, roughly 6.7 hours (around 05:30 PKT on October 7). Estimate only; the no-state pass and the final sweep are not included.

Completion is not claimed.

## Status update: 2026-10-06 23:03 PKT (UTC+05:00)

Runner: PID 13228 running at 18:03Z (23:03 PKT), on NC (105,300 state rows at last status write). Status file: batch size 500, timeout 30 seconds. Runner was not restarted; no leftover check needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 0. Overall states done: 53 of 56. Remaining: NC (in progress), OH, CA (3 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 78,900 committed rows across 167 batches (about 88 rows/s over that window).
Average since the 22:40 PKT restart: 108,489 rows over 1,330 s, 81.5 rows/s, about 4,893 rows/min.

Live database totals at 2026-10-06 18:03Z (23:03 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,923,319 |
| Still left: valid eligible rows missing geog, with state | 1,595,925 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,595,944 rows left. At 81.5 rows/s, about 5.4 hours (around 04:30 PKT on October 7). Estimate only; excludes the no-state rows and the final sweep.

Completion is not claimed.

## Status update: 2026-10-07 09:48 PKT (UTC+05:00): runner restarted after silent stop

Stop: runner PID 13228 stopped silently after its last commit at 18:05:10Z (23:05 PKT, October 6). No stopped event or error was logged, so the cause is not established. It stayed down for about 4.7 hours; the scheduled updates from 23:19 PKT onward did not run.

Restart: PID 5136 started at about 04:47Z (09:47 PKT, October 7) from the saved NC cursor, at 300-row batch start under standing approval. Leftover check before start: no active clinics sessions. Committing at 04:47:59Z (09:48 PKT): NC at 115,200 state rows.

States done in the last 15 minutes: 0 (no state completed since MA at 22:42 PKT, October 6).
Overall states done: 53 of 56. Remaining: NC (in progress), OH, CA (3 states), then the 19 no-state rows, then the final sweep.

Rows done since restart: 2,500 across 5 batches, about 76 rows/s (very short window).

Live database totals at 2026-10-07 04:48Z (09:48 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 6,935,219 |
| Still left: valid eligible rows missing geog, with state | 1,584,025 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,584,044 rows left. At about 76 rows/s, roughly 5.8 hours (around 15:40 PKT). Estimate only; excludes the no-state rows and the final sweep.

Completion is not claimed.

## Status update: 2026-10-07 10:04 PKT (UTC+05:00)

Runner: PID 5136 running at 05:04Z (10:04 PKT), on NC (207,700 state rows at last status write). Status file: batch size 500, timeout 60 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 0 (NC still in progress).
Overall states done: 53 of 56. Remaining: NC (in progress), OH, CA (3 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 88,200 committed rows across 182 batches, about 98 rows/s over that window.
Average since the 09:47 PKT restart: 95,000 rows over 1,006 s, 94.5 rows/s, about 5,669 rows/min.

Live database totals at 2026-10-07 05:04Z (10:04 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,027,719 |
| Still left: valid eligible rows missing geog, with state | 1,491,525 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,491,544 rows left. At 94.5 rows/s, about 4.4 hours (around 14:25 PKT). Estimate only; excludes the no-state rows and the final sweep.

Completion is not claimed.

## Status update: 2026-10-07 10:20 PKT (UTC+05:00)

Runner: PID 5136 running at 05:20Z (10:20 PKT), on OH (46,300 state rows at last status write). Status file: batch size 500, timeout 30 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 1 (NC, finished 10:10:59 PKT).
Overall states done: 54 of 56. Remaining: OH (in progress), CA (2 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 76,414 committed rows across 163 batches, about 85 rows/s over that window.
Average since the 09:47 PKT restart: 176,814 rows over 1,980 s, 89.3 rows/s, about 5,359 rows/min.

Live database totals at 2026-10-07 05:20Z (10:20 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,110,033 |
| Still left: valid eligible rows missing geog, with state | 1,409,211 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,409,230 rows left. At 84.9 rows/s, about 4.6 hours (around 15:00 PKT). Estimate only; excludes the no-state rows and the final sweep.

Completion is not claimed.

## Status update: 2026-10-07 10:37 PKT (UTC+05:00)

Runner: PID 5136 running at 05:37Z (10:37 PKT), on OH (128,100 state rows at last status write). Status file: batch size 300, timeout 30 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 0 (OH still in progress).
Overall states done: 54 of 56. Remaining: OH (in progress), CA (2 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 72,700 committed rows across 155 batches, about 81 rows/s over that window.
Average since the 09:47 PKT restart: 258,614 rows over 2,988 s, 86.5 rows/s, about 5,193 rows/min.

Live database totals at 2026-10-07 05:37Z (10:37 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,191,333 |
| Still left: valid eligible rows missing geog, with state | 1,327,911 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,327,930 rows left. At 80.8 rows/s, about 4.6 hours (around 15:15 PKT). Estimate only; excludes the no-state rows and the final sweep.

Completion is not claimed.

## Status update: 2026-10-07 10:54 PKT (UTC+05:00)

Runner: PID 5136 running at 05:54Z (10:54 PKT), on OH (208,300 state rows at last status write). Status file: batch size 500, timeout 30 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 0 (OH still in progress).
Overall states done: 54 of 56. Remaining: OH (in progress), CA (2 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 70,300 committed rows across 151 batches, about 78 rows/s over that window.
Average since the 09:47 PKT restart: 338,814 rows over 4,018 s, 84.3 rows/s, about 5,060 rows/min.

Live database totals at 2026-10-07 05:54Z (10:54 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,272,033 |
| Still left: valid eligible rows missing geog, with state | 1,247,211 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,247,230 rows left. At 78.1 rows/s, about 4.4 hours (around 15:20 PKT). Estimate only; excludes the no-state rows and the final sweep.

Completion is not claimed.

## Status update: 2026-10-07 11:11 PKT (UTC+05:00)

Runner: PID 5136 running at 06:11Z (11:11 PKT), on OH (287,400 state rows at last status write). Status file: batch size 500, timeout 30 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 0 (OH still in progress).
Overall states done: 54 of 56. Remaining: OH (in progress), CA (2 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 71,500 committed rows across 151 batches, about 79 rows/s over that window.
Average since the 09:47 PKT restart: 417,914 rows over 5,005 s, 83.5 rows/s, about 5,010 rows/min.

Live database totals at 2026-10-07 06:11Z (11:11 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,350,633 |
| Still left: valid eligible rows missing geog, with state | 1,168,611 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,168,630 rows left. At 79.4 rows/s, about 4.1 hours (around 15:15 PKT). Estimate only; excludes the no-state rows and the final sweep.

Completion is not claimed.

## Status update: 2026-10-07 11:28 PKT (UTC+05:00)

Runner: PID 5136 running at 06:28Z (11:28 PKT), on OH (364,700 state rows at last status write). Status file: batch size 500, timeout 60 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 0 (OH still in progress).
Overall states done: 54 of 56. Remaining: OH (in progress), CA (2 states), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 66,600 committed rows across 142 batches, about 74 rows/s over that window.
Average since the 09:47 PKT restart: 495,214 rows over 6,060 s, 81.7 rows/s, about 4,903 rows/min.

Live database totals at 2026-10-07 06:28Z (11:28 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,428,433 |
| Still left: valid eligible rows missing geog, with state | 1,090,811 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,090,830 rows left. At 74 rows/s, about 4.1 hours (around 15:35 PKT). Estimate only; excludes the no-state rows and the final sweep.

Completion is not claimed.

## Status update: 2026-10-07 11:45 PKT (UTC+05:00)

Runner: PID 5136 running at 06:45Z (11:45 PKT), on CA, the last queued state (57,200 state rows at last status write). Status file: batch size 500, timeout 60 seconds. No restart was needed. One timeout_retry at 11:37:16 PKT on CA; no stopped events.

States done in the last 15 minutes: 1 (OH, finished 11:29:48 PKT).
Overall states done: 55 of 56. Remaining: CA (in progress, the last queued state), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 55,100 committed rows across 119 batches, about 61 rows/s over that window (slower than earlier, consistent with the one timeout).
Average since the 09:47 PKT restart: 557,406 rows over 7,085 s, 78.7 rows/s, about 4,721 rows/min.

Live database totals at 2026-10-07 06:45Z (11:45 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,490,125 |
| Still left: valid eligible rows missing geog, with state | 1,029,119 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 1,029,138 rows left. At the 15-minute rate (61.2 rows/s), about 4.7 hours (around 16:25 PKT). At the since-restart average (78.7 rows/s), about 3.6 hours (around 15:20 PKT). Estimates only; excludes the no-state rows and the final sweep, which follow CA.

Completion is not claimed.

## Status update: 2026-10-07 12:02 PKT (UTC+05:00)

Runner: PID 5136 running at 07:02Z (12:02 PKT), on CA (130,200 state rows at last status write). Status file: batch size 500, timeout 60 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 0 (CA still in progress, the last queued state).
Overall states done: 55 of 56. Remaining: CA (in progress), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 66,100 committed rows across 141 batches, about 73 rows/s over that window.
Average since the 09:47 PKT restart: 630,406 rows over 8,101 s, 77.8 rows/s, about 4,669 rows/min.

Live database totals at 2026-10-07 07:02Z (12:02 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,563,625 |
| Still left: valid eligible rows missing geog, with state | 955,619 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 955,638 rows left. At 73.4 rows/s, about 3.6 hours (around 15:40 PKT). Estimate only; excludes the no-state rows and the final sweep, which follow CA.

Completion is not claimed.

## Status update: 2026-10-07 12:19 PKT (UTC+05:00)

Runner: PID 5136 running at 07:19Z (12:19 PKT), on CA (205,400 state rows at last status write). Status file: batch size 500, timeout 60 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 0 (CA still in progress, the last queued state).
Overall states done: 55 of 56. Remaining: CA (in progress), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 65,600 committed rows across 140 batches, about 73 rows/s over that window.
Average since the 09:47 PKT restart: 705,106 rows over 9,119 s, 77.3 rows/s, about 4,639 rows/min.

Live database totals at 2026-10-07 07:19Z (12:19 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,638,325 |
| Still left: valid eligible rows missing geog, with state | 880,919 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 880,938 rows left. At 72.9 rows/s, about 3.4 hours (around 15:40 PKT). Estimate only; excludes the no-state rows and the final sweep, which follow CA.

Completion is not claimed.

## Status update: 2026-10-07 12:33 PKT (UTC+05:00)

Runner: PID 5136 running at 07:33Z (12:33 PKT), on CA (268,700 state rows at last status write). Status file: batch size 500, timeout 60 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done: 55 of 56. Remaining: CA (in progress), then the 19 no-state rows, then the final sweep.

Rows done since the last check (about 14 minutes): 65,100 committed rows across 139 batches, about 72 rows/s over that window.
Average since the 09:47 PKT restart: 768,906 rows over 9,982 s, 77.0 rows/s, about 4,622 rows/min.

Live database totals at 2026-10-07 07:33Z (12:33 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,702,125 |
| Still left: valid eligible rows missing geog, with state | 817,119 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 817,138 rows left. At 72.3 rows/s, about 3.1 hours (around 15:40 PKT). Estimate only; excludes the no-state rows and the final sweep, which follow CA.

Completion is not claimed.

## Status update: 2026-10-07 12:36 PKT (UTC+05:00)

Runner: PID 5136 running at 07:36Z (12:36 PKT), on CA (279,100 state rows at last status write). Status file: batch size 500, timeout 60 seconds. No restart was needed. No timeout_retry or stopped events in the last 15 minutes.

States done in the last 15 minutes: 0 (CA still in progress, the last queued state).
Overall states done: 55 of 56. Remaining: CA (in progress), then the 19 no-state rows, then the final sweep.

Rows done in the last 15 minutes: 66,100 committed rows across 141 batches, about 73 rows/s over that window.
Average since the 09:47 PKT restart: 779,306 rows over 10,137 s, 76.9 rows/s, about 4,613 rows/min.

Live database totals at 2026-10-07 07:36Z (12:36 PKT):

| Live database totals | Rows |
| --- | ---: |
| All clinic rows | 8,519,263 |
| Done: rows with geog populated | 7,712,025 |
| Still left: valid eligible rows missing geog, with state | 807,219 |
| Still left: valid rows missing geog, no state | 19 |
| Missing latitude or longitude (reported separately) | 0 |
| Invalid non-null coordinates (reported separately) | 0 |

Time to completion: 807,238 rows left. At 73.4 rows/s, about 3.1 hours (around 15:40 PKT). Estimate only; excludes the no-state rows and the final sweep, which follow CA.

Completion is not claimed.
