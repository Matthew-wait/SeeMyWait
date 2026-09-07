/**
 * Visual tier for latest reported wait (aligned with map pin colors / legend).
 */
export type WaitTierVisual = {
  pin: string;
  borderColor: string;
  backgroundColor: string;
  /** Shown on clinic cards (list); neutral copy when there is no recent report. */
  waitLabel: string;
  waitTextColor: string;
};

export const waitTierVisual = (latestWaitMinutes: number | null): WaitTierVisual => {
  if (latestWaitMinutes === null) {
    // No active report — shown as the default green "On time" state.
    return {
      pin: '#22c55e',
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34, 197, 94, 0.14)',
      waitLabel: 'On time',
      waitTextColor: '#15803d',
    };
  }
  if (latestWaitMinutes <= 15) {
    return {
      pin: '#22c55e',
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34, 197, 94, 0.14)',
      waitLabel: latestWaitMinutes === 0 ? 'On time' : `~${latestWaitMinutes} min`,
      waitTextColor: '#15803d',
    };
  }
  if (latestWaitMinutes <= 35) {
    return {
      pin: '#eab308',
      borderColor: '#eab308',
      backgroundColor: 'rgba(234, 179, 8, 0.16)',
      waitLabel: latestWaitMinutes === 30 ? '~30 min' : `~${latestWaitMinutes} min`,
      waitTextColor: '#a16207',
    };
  }
  if (latestWaitMinutes <= 70) {
    return {
      pin: '#f97316',
      borderColor: '#f97316',
      backgroundColor: 'rgba(249, 115, 22, 0.14)',
      waitLabel: latestWaitMinutes === 60 ? '~1 hr' : `~${latestWaitMinutes} min`,
      waitTextColor: '#c2410c',
    };
  }
  return {
    pin: '#ef4444',
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    waitLabel: latestWaitMinutes >= 90 ? '1.5+ hrs' : `~${latestWaitMinutes} min`,
    waitTextColor: '#b91c1c',
  };
};
