import { useCallback, useEffect, useState } from 'react';
import { safeGetItem, safeSetItem } from '@/src/lib/safe-storage';

const STORAGE_KEY = 'settings_theme';

export type AppTheme = 'light' | 'dark';

let sharedTheme: AppTheme = 'light';
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
const listeners = new Set<(theme: AppTheme) => void>();

const notifyTheme = (theme: AppTheme) => {
  sharedTheme = theme;
  listeners.forEach((listener) => listener(theme));
};

const hydrateTheme = async () => {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const stored = await safeGetItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        notifyTheme(stored);
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
};

export const useTheme = () => {
  const [theme, setTheme] = useState<AppTheme>(sharedTheme);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listeners.add(setTheme);
    const load = async () => {
      await hydrateTheme();
      setTheme(sharedTheme);
      setLoading(false);
    };
    void load();
    return () => {
      listeners.delete(setTheme);
    };
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    notifyTheme(next);
    await safeSetItem(STORAGE_KEY, next);
  }, [theme]);

  const setThemeValue = useCallback(async (next: AppTheme) => {
    notifyTheme(next);
    await safeSetItem(STORAGE_KEY, next);
  }, []);

  return { theme, isDark: theme === 'dark', loading, toggleTheme, setTheme: setThemeValue };
};
