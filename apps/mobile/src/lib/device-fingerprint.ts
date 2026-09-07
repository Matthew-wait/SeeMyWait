import * as Application from 'expo-application';
import { Platform } from 'react-native';

let cachedFingerprint: string | null = null;

const installationFingerprintPart = async (): Promise<string> => {
  try {
    if (typeof Application.getInstallationTimeAsync !== 'function') {
      return 'no_install_api';
    }
    const t = await Application.getInstallationTimeAsync();
    if (t instanceof Date) return t.toISOString();
    if (typeof t === 'number') return String(t);
    if (t == null) return 'null_install_time';
  } catch {
    return 'install_time_unavailable';
  }
  return 'unknown_install';
};

export const getDeviceFingerprint = async (): Promise<string> => {
  if (cachedFingerprint) return cachedFingerprint;

  const installationId = await installationFingerprintPart();

  const source = [
    Platform.OS,
    Application.applicationId ?? 'unknown-app-id',
    Application.nativeApplicationVersion ?? 'unknown-version',
    installationId,
  ].join('|');

  cachedFingerprint = `fp_${source.replace(/[^a-zA-Z0-9]/g, '_')}`.slice(0, 120);
  return cachedFingerprint;
};
