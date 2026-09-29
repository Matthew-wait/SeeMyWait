import type { ExpoConfig } from '@expo/config-types';
import 'dotenv/config';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  // Map tiles are free OpenStreetMap raster tiles on both platforms (no Google
  // tile billing). Android's react-native-maps widget still needs a Maps SDK
  // for Android key just to host the native view (that SDK is free/unlimited,
  // separate from the OSM tiles actually shown). iOS uses Apple Maps via
  // PROVIDER_DEFAULT — no key, no billing, ever.
  const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  return {
    ...config,
    name: 'SeeMyWait',
    slug: 'seemywait',
    version: config.version ?? '5.5',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'seemywait',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    plugins: config.plugins ?? [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/logo.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.seeymywait.SeeMyWait',
      buildNumber: config.ios?.buildNumber ?? '2',
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'This app needs access to your location to show nearby doctor offices and calculate wait times.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'This app needs access to your location to show nearby doctor offices and calculate wait times.',
        // App uses only standard/exempt encryption (HTTPS/TLS) — avoids the
        // export-compliance prompt and annual US self-classification reports.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.seeymywait.SeeMyWait',
      versionCode: config.android?.versionCode ?? 2,
      googleServicesFile: config.android?.googleServicesFile,
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
      ],
      // expo-notifications (FCM) transitively injects the Advertising ID
      // permission. The app shows no ads and does no ad tracking, so strip it —
      // this also removes Play Console's "Advertising ID" Data-safety requirement.
      blockedPermissions: [
        'com.google.android.gms.permission.AD_ID',
      ],
      config: {
        googleMaps: {
          apiKey: mapsApiKey,
        },
      },
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-adaptive-foreground.png',
        monochromeImage: './assets/images/android-adaptive-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
  };
};

