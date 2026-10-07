/**
 * Thin wrapper around @react-native-firebase/analytics (v26+ modular API —
 * getAnalytics() plus free functions, not a default-export instance).
 * Firebase Analytics is a native module — it has no effect in Expo Go (no
 * google-services.json there), only in a real development/preview/production
 * build. Every call is wrapped so a missing or misconfigured native module
 * never crashes the app; it just silently does nothing and logs once to the
 * console for debugging.
 */
import { Platform } from 'react-native';

let warnedOnce = false;

async function getAnalyticsInstance() {
  try {
    const { getAnalytics } = await import('@react-native-firebase/analytics');
    return getAnalytics();
  } catch (err) {
    if (!warnedOnce) {
      warnedOnce = true;
      console.warn('Firebase Analytics unavailable (expected in Expo Go):', err);
    }
    return null;
  }
}

/** Call on every route change so screens show up in GA4's realtime/engagement reports. */
export async function logScreenView(screenName: string, screenClass?: string): Promise<void> {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  try {
    const { logScreenView: fbLogScreenView } = await import('@react-native-firebase/analytics');
    await fbLogScreenView(analytics, {
      screen_name: screenName,
      screen_class: screenClass ?? screenName,
    });
  } catch (err) {
    console.warn('logScreenView failed', err);
  }
}

/** Generic custom event, for anything beyond screen views (e.g. a report submitted, a search run). */
export async function logEvent(name: string, params?: Record<string, string | number | boolean>): Promise<void> {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  try {
    const { logEvent: fbLogEvent } = await import('@react-native-firebase/analytics');
    await fbLogEvent(analytics, name, { platform: Platform.OS, ...params });
  } catch (err) {
    console.warn(`logEvent(${name}) failed`, err);
  }
}
