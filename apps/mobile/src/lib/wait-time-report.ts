/**
 * `wait_time_reports.wait_time` uses Postgres enum `wait_time_category`.
 * Keep in sync with your Supabase enum labels.
 */
export type WaitTimeCategory = 'on_time' | '30_min' | '1_hour' | '1.5_hours_plus';

const MINUTES_TO_CATEGORY: Record<number, WaitTimeCategory> = {
  0: 'on_time',
  30: '30_min',
  60: '1_hour',
  90: '1.5_hours_plus',
};

export const waitMinutesToCategory = (minutes: number): WaitTimeCategory => {
  const cat = MINUTES_TO_CATEGORY[minutes];
  if (cat) return cat;
  if (minutes <= 15) return 'on_time';
  if (minutes <= 40) return '30_min';
  if (minutes <= 75) return '1_hour';
  return '1.5_hours_plus';
};

export const waitTimeCategoryToMinutes = (raw: string | null | undefined): number | null => {
  if (raw == null || raw === '') return null;
  switch (raw) {
    case 'on_time':
      return 0;
    case '30_min':
      return 30;
    case '1_hour':
      return 60;
    case '1.5_hours_plus':
      return 90;
    default:
      return null;
  }
};

/** The three admin-configurable per-category expiry settings (from
 *  `useAppSettings`) — each wait time reverts to On Time on its own
 *  schedule, not one flat window shared with the device cooldown. */
export interface ReportExpirySettings {
  reportExpiry30MinMinutes: number;
  reportExpiry60MinMinutes: number;
  reportExpiry90PlusMinutes: number;
}

/** An "On Time" report reverting to On Time has no visible effect (the
 *  badge shows On Time either way), so unlike the other three it isn't
 *  admin-configurable — just a fixed "how long this counts as fresh" value. */
const ON_TIME_EXPIRY_MINUTES = 60;

export const expiryMinutesForCategory = (
  category: WaitTimeCategory,
  settings: ReportExpirySettings
): number => {
  switch (category) {
    case 'on_time':
      return ON_TIME_EXPIRY_MINUTES;
    case '30_min':
      return settings.reportExpiry30MinMinutes;
    case '1_hour':
      return settings.reportExpiry60MinMinutes;
    case '1.5_hours_plus':
      return settings.reportExpiry90PlusMinutes;
    default:
      return 24 * 60;
  }
};

/** `wait_time_reports.expiry_time` from explicit TTL minutes. */
export const computeExpiryTimeFromMinutesIso = (minutes: number): string => {
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 1;
  const ms = safeMinutes * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
};

/** `wait_time_reports.expiry_time` — timestamptz when this report stops showing in the app. */
export const computeExpiryTimeIso = (category: WaitTimeCategory, settings: ReportExpirySettings): string => {
  return computeExpiryTimeFromMinutesIso(expiryMinutesForCategory(category, settings));
};
