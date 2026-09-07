# SeeMyWait App

Mobile app built with Expo + Expo Router + Zustand.

## Stack

- Expo (React Native app framework)
- Expo Router (file-based navigation)
- Zustand (global state management)
- EAS Build (development and release builds)

RevenueCat is not configured by default. For Android-only apps, this keeps the setup simpler.

## Run in Expo Go

```bash
npm install
npm start
```

## EAS build profiles

```bash
npm run eas:build:dev:android
npm run eas:build:preview:android
npm run eas:build:prod:android
```

Before the first EAS build, log in and configure EAS:

```bash
npx eas login
npx eas build:configure
```
