// Simple device fingerprint for spam prevention.
// Used as the edge function's `deviceId` (rate limiting) and as the
// per-device key for wait-report dedup, so it must stay stable across sessions.

const STORAGE_KEY = "device_fingerprint";

/** Survives a session when localStorage is unavailable (private mode, blocked cookies). */
let memoryFallback: string | null = null;

function generate(): string {
  return (
    Math.random().toString(36).substring(2) +
    Date.now().toString(36) +
    navigator.userAgent.length.toString(36)
  );
}

export function getDeviceFingerprint(): string {
  // Safari private mode and blocked-cookie settings make *any* localStorage
  // access throw. This sits on the search path (every keystroke) and the report
  // path, so a throw here would take down both.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;

    const fp = memoryFallback ?? generate();
    localStorage.setItem(STORAGE_KEY, fp);
    return fp;
  } catch {
    memoryFallback = memoryFallback ?? generate();
    return memoryFallback;
  }
}
