# SeeMyWait — Real-Time Doctor Wait Times

Patients see real-time, location-verified wait times at doctor's offices before
they leave home.

## Monorepo layout

```
apps/
  web/        React + Vite + Tailwind + shadcn/ui   (@seemywait/web)
  mobile/     Expo (React Native, expo-router)       (@seemywait/mobile)
packages/
  core/       shared TypeScript — NPPES directory client, geo math,
              dedup, generated DB types             (@seemywait/core)
supabase/     migrations + edge functions (medical-search, send-email,
              push-notifications) — shared by both apps
scripts/      seed-nppes.mjs (metro seed) + tooling
docs/         plans, R&D, migration runbooks
```

npm workspaces. `npm install` at the repo root installs everything.

## Stack

- **Frontend**: React + Vite + TypeScript (web); Expo / React Native (mobile)
- **Database & Auth**: [Supabase](https://supabase.com/) (Postgres + RLS + Edge Functions)
- **Maps**: [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles (web);
  `react-native-maps` with `PROVIDER_DEFAULT` — Apple Maps on iOS, free Google
  SDK on Android (mobile)
- **Directory & geocoding**: NPPES NPI Registry (CMS), US Census geocoder,
  Nominatim, Photon — all free, no API key
  (see [docs/RD-GOOGLE-MAPS-REPLACEMENT.md](docs/RD-GOOGLE-MAPS-REPLACEMENT.md))

## Develop

```bash
npm install            # root — installs all workspaces

# web
npm run web             # or: npm run dev  --workspace @seemywait/web  (localhost:3001)
npm run web:build
npm run web:test

# mobile
npm run mobile          # expo start   (from apps/mobile)
```

### Environment

- Web: copy `apps/web/.env.example` → `apps/web/.env`, fill the two Supabase
  values. Map runs on keyless OpenStreetMap tiles by default.
- Mobile: `apps/mobile/.env` with `EXPO_PUBLIC_SUPABASE_URL` /
  `_PUBLISHABLE_KEY` / `_PROJECT_ID`.
- Edge functions: no API keys except `RESEND_*` for `send-email`.

## Database

Migrations in `supabase/migrations/`. Apply with `supabase db push` (needs the
project DB password or a personal access token) or the dashboard SQL editor.

```bash
node scripts/seed-nppes.mjs --state FL --city Miami --limit 800 --geocode --push
```

## Deploy

- **Web** → Vercel. Project **Root Directory = `apps/web`**. SPA routing via
  `apps/web/vercel.json`. Pushes to `main` auto-deploy.
- **Mobile** → EAS. `cd apps/mobile && eas build --profile production`. A root
  `.easignore` keeps `apps/web` out of the upload.
- **Edge functions** → `supabase functions deploy <name>`.

## Region

Backend is being moved us-west-1 → **us-east-1** (closer to Miami). Cutover
runbook: [docs/MIGRATION-US-EAST.md](docs/MIGRATION-US-EAST.md).
