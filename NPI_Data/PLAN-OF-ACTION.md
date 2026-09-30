# Machine 2 — plan of action (2026-09-30)

## 1. Assigned rollout: done

All 10 of Machine 2's states finished importing and are backed up. Numbers
below are real database counts, verified 2026-09-30 ~11:00 AM.

| # | State | Staged | In DB | % | Backup |
|---|---|---|---|---|---|
| 1 | WA | 243,214 | 230,302 | 94.7% | `backups/WA_2026-09-26T10-35-32-606Z.json` |
| 2 | IN | 155,930 | 141,394 | 90.7% | `backups/IN_2026-09-26T13-16-34-107Z.json` |
| 3 | TN | 160,443 | 143,958 | 89.7% | `backups/TN_2026-09-26T16-55-41-081Z.json` |
| 4 | MN | 168,647 | 143,427 | 85.0% | `backups/MN_2026-09-26T19-46-47-768Z.json` |
| 5 | AZ | 176,321 | 161,728 | 91.7% | `backups/AZ_2026-09-26T22-24-12-190Z.json` |
| 6 | CO | 197,262 | 181,393 | 92.0% | `backups/CO_2026-09-27T05-24-08-514Z.json` |
| 7 | VA | 200,979 | 178,536 | 88.8% | `backups/VA_2026-09-27T08-43-34-981Z.json` |
| 8 | MD | 216,052 | 195,646 | 90.6% | `backups/MD_2026-09-27T15-02-50-685Z.json` |
| 9 | GA | 230,573 | 202,119 | 87.7% | `backups/GA_2026-09-27T18-29-42-899Z.json` |
| 10 | NJ | 234,001 | 206,133 | 88.1% | `backups/NJ_2026-09-30T05-58-58-257Z.json` |

**Total: 1,784,996 rows across Machine 2's 10 states.** NJ finished and was
verified/backed up this morning (2026-09-30) — it had kept running past the
point it was last checked and was never marked done or backed up until now.

No state reaches 100% by design: the Census batch geocoder can't place
every address (rural routes, suite/unit-only addresses, hospital campus
names), and a smaller share are genuine duplicate clinics already in the
database under a different NPI. Both are expected, not data loss — see
`UNRESOLVED-TODO.md` for the per-state breakdown and the leftover-row
CSVs (`<STATE>_unresolved.csv`).

## 2. National picture (for context, verified 2026-09-30)

Every mainland state + DC is at the same 80-96% "done" ceiling as Machine
2's states — the rollout is effectively complete nationwide except:

| State | Staged | In DB | % | Note |
|---|---|---|---|---|
| PR | 57,988 | 21,025 | 36.3% | Census geocoder has poor PR coverage |
| GU | 1,183 | 411 | 34.7% | not US-state geocoder territory |
| VI | 1,254 | 126 | 10.0% | not US-state geocoder territory |
| AS | 229 | 6 | 2.6% | not US-state geocoder territory |
| MP | 322 | 3 | 0.9% | not US-state geocoder territory |

These were Machine 3's assignment; flagging here for visibility, not
claiming them — Machine 2 will only pick these up if asked.

## 3. Next: alternative-geocoder pass on Machine 2's own unresolved rows

Each Machine 2 state has a `<STATE>_unresolved.csv` — rows the Census batch
geocoder couldn't place. The pipeline already has a second, working
geocoder (`--geocoder nominatim`, OpenStreetMap's free API) that resolves
addresses one at a time instead of in a batch, so it succeeds on some rows
Census fails on (it doesn't need the address broken into fields the same
strict way). It's much slower — about 1 address/second, so each unresolved
list takes a few hours — but it needs no API key and runs safely at
concurrency 1 alongside the rest of the national effort.

**Revised pace (observed 2026-09-30):** running at ~1.8 sec/row, not the
assumed ~1/sec — roughly double the time estimates below.

Command shape (repeat per state):
```bash
node scripts/seed-nppes-bulk.mjs process \
  --state-csv NPI_Data/staged/<STATE>_unresolved.csv \
  --geocode --geocoder nominatim --push \
  --checkpoint NPI_Data/staged/<STATE>_unresolved.checkpoint.json \
  >> NPI_Data/logs/<STATE>_unresolved.log 2>&1
```

### Order (smallest unresolved list first, fastest wins first)

| # | State | Unresolved rows | Est. time (~1 row/sec) | Status |
|---|---|---|---|---|
| 1 | WA | 12,912 | ~3.6 hr | 🔵 running (started 2026-09-30 11:23 AM) |
| 2 | IN | 14,537 | ~4.0 hr | queued |
| 3 | AZ | 14,594 | ~4.1 hr | queued |
| 4 | CO | 15,869 | ~4.4 hr | queued |
| 5 | TN | 16,485 | ~4.6 hr | queued |
| 6 | MD | 20,412 | ~5.7 hr | queued |
| 7 | VA | 22,445 | ~6.2 hr | queued |
| 8 | MN | 25,220 | ~7.0 hr | queued |
| 9 | NJ | 27,878 | ~7.7 hr | queued |
| 10 | GA | 28,454 | ~7.9 hr | queued |

Total estimate: roughly 2.5 days running back-to-back, one state at a time.
A real chunk of each list will still fail (addresses with no resolvable
location anywhere, or genuine duplicates skipped again) — expect maybe
30-60% of each list to actually land, not the full remainder.

### After each state finishes
1. `node scripts/backup-state.mjs <STATE>` — refresh its backup with the newly added rows.
2. Recompute `<STATE>_unresolved.csv` against the new backup (drops rows that resolved, keeps genuine failures).
3. Update `UNRESOLVED-TODO.md` and the national-rollout artifact.
4. Start the next state in the list.
