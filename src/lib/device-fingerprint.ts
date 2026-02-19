// Simple device fingerprint for spam prevention
export function getDeviceFingerprint(): string {
  const stored = localStorage.getItem("device_fingerprint");
  if (stored) return stored;

  const fp =
    Math.random().toString(36).substring(2) +
    Date.now().toString(36) +
    navigator.userAgent.length.toString(36);

  localStorage.setItem("device_fingerprint", fp);
  return fp;
}
