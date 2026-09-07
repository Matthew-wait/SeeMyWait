# scripts

## `seed-nppes.mjs` — metro seed for the `clinics` table

Populates `clinics` from the free **NPPES NPI Registry** + a free geocoder, so a
launch metro has real inventory before any user searches. No npm dependencies
(Node 18+ globals only).

```
NPPES NPI Registry  →  geocode (Census batch, Nominatim fallback)  →  clinics_seed.csv  →  DB
```

### Examples

```bash
# 1. Dry run — see what NPPES returns, write nothing
node scripts/seed-nppes.mjs --state FL --city Miami --taxonomy "Family Medicine" --limit 20 --dry-run

# 2. Fetch + geocode → CSV (import later via the admin CSV tool)
node scripts/seed-nppes.mjs --state FL --city Miami --city "Coral Gables" --limit 800 --geocode

# 3. Fetch + geocode + upsert straight into clinics (idempotent on npi)
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/seed-nppes.mjs --state FL --zip 33136,33101,33125 --geocode --push

# Networks where the Census WAF blocks batch requests:
node scripts/seed-nppes.mjs --state FL --city Miami --geocode --geocoder nominatim
```

### Flags

| Flag | Meaning |
|---|---|
| `--state FL` | **required**, 2-letter USPS |
| `--city "Miami"` | repeatable; **at least one `--city` or `--zip`** is required (NPPES needs it alongside `--state`) |
| `--zip 33136,33101` | repeatable / comma list |
| `--taxonomy "Family Medicine"` | repeatable; narrows the NPPES query |
| `--limit 500` | max unique NPIs to keep (default 500) |
| `--geocode` | resolve lat/lng |
| `--geocoder census\|nominatim` | default `census` (batch, ≤10k/file); `nominatim` is a throttled ~1 req/s fallback. Unmatched Census rows retry on Nominatim automatically. |
| `--push` | upsert into `clinics` on `npi` (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`); implies `--geocode` |
| `--out PATH` | CSV output (default `scripts/out/clinics_seed.csv`) |
| `--dry-run` | fetch + map only |

### Notes

- **Review before `--push`.** NPPES is provider-entered — expect resident
  "Student…" taxonomies at teaching hospitals, occasional billing addresses, and
  many providers sharing one facility address. Narrow with `--taxonomy`, eyeball
  the CSV.
- Idempotent: `--push` upserts on the `npi` unique index, so re-running never
  duplicates.
- `clinics.city` / `state` / `postal_code` (migration `20260907150000`) must
  exist before `--push`.
