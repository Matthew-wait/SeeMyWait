# Unresolved NPI rows — finish later with an alternative geocoder

Saved Sep 26, 2026 (Machine 2). These rows are in the staged NPPES file but
not in the `clinics` table. Most failed Census batch geocoding (no match for
the address); a smaller share are name+address duplicates of a clinic that
already exists under another NPI (those are correct to skip).

Plan: find an alternative geocoding service for the no-match addresses and
re-run just these rows.

| State | Staged | In DB | Unresolved | List |
|---|---|---|---|---|
| WA | 243,214 | 230,302 | 12,912 | `WA_unresolved.csv` |
| IN | 155,930 | 141,393 | 14,537 | `IN_unresolved.csv` (~13.35k no geocode match, ~1.1k name+address dups) |
| TN | 160,443 | 143,958 | 16,485 | `TN_unresolved.csv` (15,375 no geocode match, 1,110 dups; many suite/#, rural routes, hospital campus names) |
| MN | 168,647 | 143,427 | 25,220 | `MN_unresolved.csv` — heavier gap than usual; DB-count is authoritative (log-based "pushed" tally overcounted during the shared-DB slowdown, see below) |
| AZ | 176,321 | 161,727 | 14,594 | `AZ_unresolved.csv` |
| CO | 197,262 | 181,393 | 15,869 | `CO_unresolved.csv` |
| VA | 200,979 | 178,534 | 22,445 | `VA_unresolved.csv` |
| MD | 216,052 | 195,640 | 20,412 | `MD_unresolved.csv` |
| GA | 230,573 | 202,119 | 28,454 | `GA_unresolved.csv` |
| NJ | 234,001 | 206,123 | 27,878 | `NJ_unresolved.csv` — NJ finished unnoticed after being resumed post-stop on 9/27; verified and backed up 9/30 |

Territories (AS, MP, GU, VI; Machine 3) are expected to be mostly unresolved:
the Census geocoder covers the 50 states + DC, not the territories.

To regenerate a state's list: compare the staged CSV's NPIs against a fresh
backup (`node scripts/backup-state.mjs XX`), keeping staged rows whose NPI is
not in the backup.
