# iOS build and TestFlight submit (runbook)

Last working build: version 5.6, build 11, EAS build 5ae42b8f-2a38-4335-b3f3-6adfa9f4207e (2026-10-05), submitted to TestFlight automatically.

## Accounts and IDs (no secrets here)
- Expo owner account: `seemywaits-team`. Project `seemywait`, project ID `d8323be7-2237-4c19-a45f-055b9600ddc5` (in apps/mobile/app.json). The personal `seemywait` project (`9e5881ad-…`) is a duplicate; ignore it.
- Apple Developer team: `LW544BA6KQ` (Individual, Matthew Kramer). Membership renews 2027-05-18.
- Bundle ID: `com.seeymywait.SeeMyWait`. ASC app ID: `6785563775`.
- App Store Connect API key: ID `VKGFC6BBD3`, Issuer ID in `apps/mobile/.env` (`Apple_Issuer_Id`). Key file `AuthKey_VKGFC6BBD3.p8` is in `C:\Users\PC\seemywait-signing\` (not in repo).
- Distribution certificate: serial `1253DEB13A190DE6A61587D29602F45E`, SHA-1 `970AE072808A033ED2E03B0FCDF02E33F4AE9565`, expires 2027-06-30 (Apple Distribution).
- Provisioning profile: `SeeMyWait AppStore`, UUID `abc3837d-0b1c-4b91-bf0f-09db24726ce0`, expires 2027-10-05.
- Old certificate `D3167E9C…` was revoked. Do not use it.

## Local signing files (keep private, never commit)
Folder: `C:\Users\PC\seemywait-signing\`
- `distribution.key`: private key. Needed to regenerate a `.p12`.
- `distribution.pem` / `distribution.cer`: public certificate.
- `distribution-legacy.p12`: certificate + key for Expo. Exported with `-legacy` flags because macOS on EAS could not verify the default OpenSSL 3 MAC.
- `SeeMyWait_AppStore.mobileprovision`: provisioning profile.
- `AuthKey_VKGFC6BBD3.p8`, `expo-recovery-codes`, `recovery-codes (1)`: secrets.

## Build and submit
1. Bump version in `apps/mobile/app.json` (`version`, `ios.buildNumber`) and `app.config.ts` fallbacks. Current: 5.6 / buildNumber 11. Each TestFlight upload needs a new buildNumber.
2. Commit and push the code.
3. From `apps/mobile`, make sure the EAS login is the owner account (`eas whoami` should print `seemywait`). Do not load `.env` for the build: its `EAS_ACCESS_TOKEN` line belonged to another account and overrode the login.
4. Run:
   `eas build --platform ios --profile production --auto-submit --non-interactive --no-wait`
5. Watch the build at expo.dev under `seemywaits-team/projects/seemywait/builds`. Fastlane takes about 10–15 min. The submission to TestFlight starts after it finishes.

## Credentials: when they break
- "hasn't been imported successfully" + "macOS could not verify the PKCS#12 MAC": the `.p12` is in the wrong format. Re-export with the legacy command (below) and replace the certificate in Expo's App Store credentials.
- "Signing certificate is invalid … revoked or expired": the App Store credentials point at an old certificate. Remove it and attach `1253DEB…`.
- "Provisioning profile is not associated with uploaded Distribution Certificate": upload the matching `.mobileprovision`.
- "App Store Connect API Keys cannot be set up in --non-interactive mode": the ASC key on the credentials page is missing or old. Replace it with `VKGFC6BBD3` and the `.p8`.
- Expo's CLI login to Apple often fails. Avoid it: upload files in the browser (expo.dev → project → Credentials → iOS).

Re-export command (Git Bash, password typed at prompt):
```
cd /c/Users/PC/seemywait-signing
openssl pkcs12 -export -legacy -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1 -inkey distribution.key -in distribution.pem -out distribution-legacy.p12
```

## Certificates and profile expiry
- Distribution certificate expires 2027-06-30. Renew before then, or the next upload will fail.
- Provisioning profile expires 2027-10-05.
- Push key `9Y8MNZ5QG2` (2026-06-30) is for notifications, not used yet.

## Open items
- Test the TestFlight build on a phone (v5.6 parity changes are untested on device).
- Fix duplicate React (19.1.0 mobile, 18.3.1 root) flagged by expo doctor. Test web and mobile after.
- Android: not built. Needs a go-ahead before the Play Store upload.
