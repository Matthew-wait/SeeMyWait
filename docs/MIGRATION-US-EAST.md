# Supabase region migration — us-west-1 → us-east-1

Moving from the original project **`sgbstsgomdxafzszohwg`** (West US / N. California)
to **`ziisjgtvqmturpljnvfh`** / *SeeMyWaitDB623* (East US / N. Virginia) — ~1/3
the distance from Miami, ~half the DB round-trip latency.

## Done

| | Status |
|---|---|
| New project created (`us-east-1`, same org) | ✅ (by client) |
| All migrations applied to new project (web + mobile + reconcile) | ✅ — `schema_migrations` has all 12 |
| Seed data present (12 sample Miami clinics, `app_settings`) | ✅ from migration `20260219111026` |
| Edge functions deployed to new project | ✅ `medical-search`, `send-email`, `push-notifications` (all ACTIVE) |
| `medical-search` end-to-end (search / add / geocode / reverse / autocomplete) | ✅ verified; `add` writes `source='npi'`, `verified=true`, city/state/zip |
| Admin user recreated | ✅ `seeyourwait@gmail.com` (temp pw `SmwAdmin!us-east-1#2026` — change it) |
| Local `.env` — web (`apps/web/.env`) + mobile (`apps/mobile/.env`) | ✅ point at new project |
| Old project data backed up | ✅ `scripts/out/backup/*.json` (120 rows) + `backups/data.sql` |

## Remaining cutover — in this order

1. **Edge Function Secrets on the new project** (dashboard → Edge Functions →
   Secrets). Only these are needed (the rest are auto-injected; the Google keys
   are obsolete):
   ```
   RESEND_API_KEY   = <from the old project / Resend dashboard>
   RESEND_FROM      = <same as old>
   ADMIN_EMAIL      = <same as old>
   ```
   `push-notifications` needs nothing extra (uses auto-injected `SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY`).

2. **Vercel** (web) — Project Settings → Environment Variables:
   ```
   VITE_SUPABASE_URL            = https://ziisjgtvqmturpljnvfh.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY = sb_publishable_HL6GKFxIpROv2vhm4ewijA_JwasS1Af
   ```
   Also set the Vercel project **Root Directory = `apps/web`** (the app moved in
   the monorepo restructure). Redeploy → verify seemywait.com (map, search,
   admin login).

3. **Mobile** — the published App Store / Play Store build still has the **old**
   project URL compiled in. Deleting the old project breaks the app for existing
   users until a new build ships. So:
   - Set the three vars from `apps/mobile/.env` as **EAS secrets** (or an EAS
     env-var group): `EXPO_PUBLIC_SUPABASE_URL`,
     `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_PROJECT_ID`.
   - `cd apps/mobile && eas build --profile production --platform all`
   - Submit to both stores, wait for review + rollout.

4. **`.github/workflows/db-backup.yml`** — update the repo secret
   `DB_CONNECTION_STRING` to the new project's **Session pooler** string.

5. **Delete the old project** — only after (2) is live *and* (3) has rolled out
   far enough that old-project traffic is acceptable to cut. It is irreversible;
   the backup files above are the fallback. Old project ref:
   `sgbstsgomdxafzszohwg`.

## Notes

- The old `medical-search` function on the old project is the pre-repo
  Google-Places version; the new project's is the NPPES rewrite. They are not
  compatible — do not point a new client at the old function or vice-versa.
- `send-email` uses `ADMIN_ALERT_EMAIL` hard-coded to a testing inbox in
  `apps/web/src/pages/SuggestClinic.tsx` — switch to the production inbox before
  launch (unrelated to this migration, but same file).
