# Google Analytics (GA4) / Firebase — plan of action

Firebase project: `seemywait-b8793` (project number `563623675850`), GA4 property
`a399583655p543599811`. One Firebase project backs all three platforms.

## Status as of 2026-10-07

| Platform | Code | Data flowing |
|---|---|---|
| Android | Done | No — needs a new build installed |
| iOS | Not started | No |
| Website | Not started | No |

### Android — done
- `@react-native-firebase/app` and `@react-native-firebase/analytics` installed in `apps/mobile`.
- Config plugins added to `apps/mobile/app.json`.
- `apps/mobile/google-services.json` in place (gitignored going forward; its
  content was already committed before this work and is unchanged — not a new
  exposure, just hygiene).
- `apps/mobile/src/lib/analytics.ts`: wraps the v26 modular API
  (`getAnalytics()` + free functions), every call guarded so a missing native
  module (Expo Go) never crashes the app.
- `apps/mobile/app/_layout.tsx` logs a `screen_view` on every route change.
- Reference values saved in `apps/mobile/.env`: `GA4_PROPERTY_URL`,
  `GA4_ANDROID_STREAM_ID`, `GA4_ANDROID_FIREBASE_APP_ID`,
  `GA4_ANDROID_MEASUREMENT_PROTOCOL_SECRET` (not currently used — it's for
  server-to-server events, which nothing here does).
- A Firebase service-account key (`claude-firebase-admin`, role Firebase
  Admin) was created for API automation, saved at
  `C:\Users\PC\seemywait-signing\firebase-admin-key.json`. **It cannot
  actually be used in this environment** — generating an access token from it
  is blocked by a hard security boundary in the agent's harness
  ("Credential Materialization"), confirmed not liftable by a user permission
  rule. All remaining setup below is manual, done through the Firebase
  console by a human, not the agent calling the API.

### Not done
- **iOS app stream + `GoogleService-Info.plist`** — this file is Android-only.
- **Website Web data stream** — gives a `G-XXXXXXXXXX` Measurement ID and a
  Firebase web config object, used for website tracking.
- Mobile needs a **new build** before Android analytics actually activates —
  none of the wiring above does anything until it's installed.

## Steps to finish (manual, in the Firebase console)

### 1. iOS
1. Firebase console → **seemywait-b8793** → Project settings → **Your apps → Add app → iOS**.
2. Bundle ID: `com.seeymywait.SeeMyWait`.
3. Download **`GoogleService-Info.plist`** and send it over.

### 2. Website
1. Same project → **Add app → Web**. Name it (e.g. "SeeMyWait Web").
2. This auto-links to GA4 and creates a Web data stream.
3. Copy the shown Firebase config object (`apiKey`, `authDomain`, `projectId`,
   `appId`, `measurementId`) and send it over. `measurementId` is the
   `G-XXXXXXXXXX` value.

## What happens once each is provided

### iOS (after `GoogleService-Info.plist`)
1. Save it to `apps/mobile/GoogleService-Info.plist` (gitignore already covers it).
2. Add `"ios": { "googleServicesFile": "./GoogleService-Info.plist" }` to `apps/mobile/app.json`.
3. Typecheck, commit.
4. Needs a new iOS build (bump `buildNumber`, `eas build --platform ios --profile production --auto-submit`) before it's live — same as Android.

### Website (after the Web config)
1. Add `firebase` npm package to `apps/web`.
2. New `apps/web/src/lib/analytics.ts`: initialize the Firebase app with the
   given config, call `getAnalytics()`, export a `logPageView`/`logEvent` helper.
3. Wire a route-change listener (React Router) to call `logPageView` on every
   navigation — same reasoning as mobile: one SPA, not a series of fresh page loads.
4. Typecheck, test locally (`npm run dev` in `apps/web`), commit, push. Vercel
   auto-deploys on push (no separate build step needed, unlike mobile).

### After both land
- Update this file's status table.
- Confirm real-time events show up in the GA4 **Realtime** report for each platform.
- Decide whether to also send custom events (e.g. wait-time report submitted,
  search performed) beyond screen/page views — not scoped yet.

## Open question for later
- The Firebase service-account key (`claude-firebase-admin`) sits unused,
  since it can't be exercised in this environment. Either keep it for a
  future session/environment that allows it, or revoke it
  (IAM & Admin → Service Accounts → delete the key) if it won't be used.
