# NPI gap log

Generated 2026-10-05 by `scripts/npi-gap-report.mjs`. Regenerate after every import run.

This records where the live database is missing offices that exist in the NPPES staged files,
so the gaps can be filled later. It is the source of truth for gaps; the rules for each state are in
[Known gap causes](#known-gap-causes).

## Totals

- Staged offices: 9,419,991
- Live offices: 8,519,216
- Gap (staged minus live, all states): 900,775
- Never run or failed geocoding (not checkpointed): 6,682,550

## By state

| State | Staged | Live | Done (checkpoint) | Gap | Not run | Status |
|---|---:|---:|---:|---:|---:|---|
| AA | 434 | 0 | 0 | 434 | 434 | not imported |
| AB | 24 | 0 | 0 | 24 | 24 | not imported |
| AE | 3,426 | 0 | 0 | 3,426 | 3,426 | not imported |
| AF | 1 | 0 | 0 | 1 | 1 | not imported |
| AK | 36,035 | 31,646 | 3 | 4,389 | 36,032 | gap |
| AL | 94,848 | 79,040 | 9 | 15,808 | 94,839 | gap |
| AP | 2,546 | 0 | 0 | 2,546 | 2,546 | not imported |
| AR | 86,462 | 77,926 | 11 | 8,536 | 86,451 | gap |
| AS | 229 | 6 | 6 | 223 | 223 | gap |
| AU | 1 | 0 | 0 | 1 | 1 | not imported |
| AZ | 176,321 | 161,728 | 163,006 | 14,593 | 13,315 | gap |
| BC | 206 | 0 | 0 | 206 | 206 | not imported |
| BE | 1 | 0 | 0 | 1 | 1 | not imported |
| BO | 1 | 0 | 0 | 1 | 1 | not imported |
| BW | 3 | 0 | 0 | 3 | 3 | not imported |
| CA | 1,185,337 | 1,104,101 | 14,297 | 81,236 | 1,171,040 | gap |
| CE | 64 | 0 | 0 | 64 | 64 | not imported |
| CN | 1 | 0 | 0 | 1 | 1 | not imported |
| CO | 197,262 | 181,393 | 184,676 | 15,869 | 12,586 | gap |
| CT | 105,474 | 96,528 | 30 | 8,946 | 105,444 | gap |
| DC | 52,754 | 50,112 | 1,215 | 2,642 | 51,539 | gap |
| DE | 27,926 | 24,836 | 10 | 3,090 | 27,916 | gap |
| EO | 1 | 0 | 0 | 1 | 1 | not imported |
| ES | 2 | 0 | 0 | 2 | 2 | not imported |
| EU | 2 | 0 | 0 | 2 | 2 | not imported |
| FI | 1 | 0 | 0 | 1 | 1 | not imported |
| FL | 652,949 | 589,657 | 632,497 | 63,292 | 20,452 | gap |
| FM | 12 | 0 | 0 | 12 | 12 | not imported |
| FP | 1 | 0 | 0 | 1 | 1 | not imported |
| GA | 230,573 | 202,119 | 203,732 | 28,454 | 26,841 | gap |
| GB | 4 | 0 | 0 | 4 | 4 | not imported |
| GE | 5 | 0 | 0 | 5 | 5 | not imported |
| GU | 1,183 | 411 | 0 | 772 | 1,183 | gap |
| HI | 40,898 | 37,446 | 8 | 3,452 | 40,890 | gap |
| IA | 65,997 | 60,633 | 7 | 5,364 | 65,990 | gap |
| ID | 46,268 | 40,743 | 1 | 5,525 | 46,267 | gap |
| IL | 318,439 | 292,084 | 9,393 | 26,355 | 309,046 | gap |
| IN | 155,930 | 141,394 | 142,580 | 14,536 | 13,350 | gap |
| JA | 2 | 0 | 0 | 2 | 2 | not imported |
| JJ | 1 | 0 | 0 | 1 | 1 | not imported |
| JP | 2 | 0 | 0 | 2 | 2 | not imported |
| KL | 1 | 0 | 0 | 1 | 1 | not imported |
| KR | 1 | 0 | 0 | 1 | 1 | not imported |
| KS | 72,678 | 68,566 | 5 | 4,112 | 72,673 | gap |
| KY | 113,389 | 97,638 | 22 | 15,751 | 113,367 | gap |
| LA | 125,728 | 112,087 | 39 | 13,641 | 125,689 | gap |
| LB | 1 | 0 | 0 | 1 | 1 | not imported |
| MA | 258,615 | 242,447 | 6,026 | 16,168 | 252,589 | gap |
| MB | 5 | 0 | 0 | 5 | 5 | not imported |
| MD | 216,052 | 195,646 | 200,979 | 20,406 | 15,073 | gap |
| ME | 43,271 | 38,978 | 3 | 4,293 | 43,268 | gap |
| MH | 3 | 0 | 0 | 3 | 3 | not imported |
| MI | 357,320 | 333,437 | 13,655 | 23,883 | 343,665 | gap |
| MN | 168,647 | 143,427 | 144,777 | 25,220 | 23,870 | gap |
| MO | 148,636 | 121,130 | 42 | 27,506 | 148,594 | gap |
| MP | 322 | 3 | 3 | 319 | 319 | gap |
| MS | 57,999 | 49,074 | 6 | 8,925 | 57,993 | gap |
| MT | 29,989 | 26,664 | 3 | 3,325 | 29,986 | gap |
| MX | 8 | 0 | 0 | 8 | 8 | not imported |
| NA | 8 | 0 | 0 | 8 | 8 | not imported |
| NB | 2 | 0 | 0 | 2 | 2 | not imported |
| NC | 277,213 | 248,206 | 5,614 | 29,007 | 271,599 | gap |
| ND | 27,630 | 24,892 | 2 | 2,738 | 27,628 | gap |
| NE | 92,793 | 85,867 | 5 | 6,926 | 92,788 | gap |
| NF | 1 | 0 | 0 | 1 | 1 | not imported |
| NH | 40,720 | 35,005 | 5 | 5,715 | 40,715 | gap |
| NJ | 234,001 | 206,133 | 43,976 | 27,868 | 190,025 | gap |
| NL | 5 | 0 | 0 | 5 | 5 | not imported |
| NM | 69,615 | 60,536 | 21 | 9,079 | 69,594 | gap |
| NO | 1 | 0 | 0 | 1 | 1 | not imported |
| NP | 1 | 0 | 0 | 1 | 1 | not imported |
| NS | 8 | 0 | 0 | 8 | 8 | not imported |
| NT | 1 | 0 | 0 | 1 | 1 | not imported |
| NV | 123,277 | 118,599 | 19 | 4,678 | 123,258 | gap |
| NY | 656,683 | 613,942 | 18,434 | 42,741 | 638,249 | gap |
| OH | 407,380 | 375,850 | 374,187 | 31,530 | 33,193 | gap |
| OK | 117,288 | 104,029 | 21 | 13,259 | 117,267 | gap |
| ON | 104 | 0 | 0 | 104 | 104 | not imported |
| OR | 150,181 | 141,871 | 19 | 8,310 | 150,162 | gap |
| PA | 335,762 | 301,390 | 5,001 | 34,372 | 330,761 | gap |
| PE | 1 | 0 | 0 | 1 | 1 | not imported |
| PH | 1 | 0 | 0 | 1 | 1 | not imported |
| PI | 2 | 0 | 0 | 2 | 2 | not imported |
| PN | 6 | 0 | 0 | 6 | 6 | not imported |
| PR | 57,988 | 21,025 | 2 | 36,963 | 57,986 | gap |
| QC | 24 | 0 | 0 | 24 | 24 | not imported |
| QR | 1 | 0 | 0 | 1 | 1 | not imported |
| RI | 32,157 | 29,888 | 11 | 2,269 | 32,146 | gap |
| RJ | 2 | 0 | 0 | 2 | 2 | not imported |
| RM | 5 | 0 | 0 | 5 | 5 | not imported |
| RN | 1 | 0 | 0 | 1 | 1 | not imported |
| RP | 4 | 0 | 0 | 4 | 4 | not imported |
| RS | 1 | 0 | 0 | 1 | 1 | not imported |
| SA | 4 | 0 | 0 | 4 | 4 | not imported |
| SC | 116,556 | 105,707 | 11 | 10,849 | 116,545 | gap |
| SD | 23,192 | 20,695 | 7 | 2,497 | 23,185 | gap |
| SE | 1 | 0 | 0 | 1 | 1 | not imported |
| SG | 1 | 0 | 0 | 1 | 1 | not imported |
| SK | 11 | 0 | 0 | 11 | 11 | not imported |
| SN | 5 | 0 | 0 | 5 | 5 | not imported |
| TE | 1 | 0 | 0 | 1 | 1 | not imported |
| TH | 1 | 0 | 0 | 1 | 1 | not imported |
| TI | 1 | 0 | 0 | 1 | 1 | not imported |
| TN | 160,443 | 143,958 | 145,068 | 16,485 | 15,375 | gap |
| TO | 1 | 0 | 0 | 1 | 1 | not imported |
| TX | 607,442 | 542,173 | 17,510 | 65,269 | 589,932 | gap |
| UK | 6 | 0 | 0 | 6 | 6 | not imported |
| UP | 1 | 0 | 0 | 1 | 1 | not imported |
| US | 6 | 0 | 0 | 6 | 6 | not imported |
| UT | 95,788 | 84,422 | 6 | 11,366 | 95,782 | gap |
| VA | 200,979 | 178,536 | 180,113 | 22,443 | 20,866 | gap |
| VI | 1,254 | 126 | 0 | 1,128 | 1,254 | gap |
| VT | 19,171 | 17,635 | 2 | 1,536 | 19,169 | gap |
| WA | 243,214 | 232,814 | 230,302 | 10,400 | 12,912 | gap |
| WI | 144,809 | 133,512 | 59 | 11,297 | 144,750 | gap |
| WV | 91,483 | 74,540 | 4 | 16,943 | 91,479 | gap |
| WY | 18,460 | 16,965 | 1 | 1,495 | 18,459 | gap |
| XX | 1 | 0 | 0 | 1 | 1 | not imported |
| ZA | 1 | 0 | 0 | 1 | 1 | not imported |
| ZH | 1 | 0 | 0 | 1 | 1 | not imported |

## Known gap causes

- **Failed geocoding, not checkpointed.** The Census batch geocoder (and the Nominatim fallback) returned no match for some addresses. These stay out of the checkpoint and are retried on the next run. Per-batch counts are in `NPI_Data/logs/<ST>.log` ("rows failed geocoding").
- **Checkpointed by old code.** Before commit `9c8a47d` (2026-09-26) the import marked geocoding failures as done. Those NPIs are in the checkpoint but never reached the database. Florida has about 37,600 of these. Fix: remove them from the checkpoint and re-run.
- **Duplicate skips.** An office with the same name and address already exists under another NPI. This is correct, and it is counted in the gap.
- **Whole batch geocoder outage.** A batch that geocodes 0 of 9,000 (seen in Florida) is retried in full on the next run.

## How to fill a gap later

1. Florida exact reconcile: `NPI_Data/reconcile-gaps-fl.mjs` (`ONLY_STATES=FL`), output `NPI_Data/reconcile-FL.json`.
2. Remove the checkpointed-but-missing NPIs for that state from `NPI_Data/staged/<ST>.checkpoint.json` (back the file up first).
3. Re-run the state with `scripts/seed-nppes-bulk.mjs --geocode --push --checkpoint NPI_Data/staged/<ST>.checkpoint.json`.
4. Re-run `node scripts/npi-gap-report.mjs` and update this file.

Florida exact reconcile, 2026-10-05 (NPI_Data/reconcile-FL.json): 63,299 staged NPIs missing from live. 5,247 are duplicate skips, about 37,600 are checkpointed but missing (old code), about 20,400 were never run. Live count now 589,657, so the gap total above is 63,292.
