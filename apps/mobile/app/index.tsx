import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { safeGetItem } from '@/src/lib/safe-storage';

const ONBOARDING_SEEN_KEY = 'onboarding_seen_v2';

export default function IndexRoute() {
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const value = await safeGetItem(ONBOARDING_SEEN_KEY);
      if (!mounted) return;
      setSeen(value === '1');
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;
  return <Redirect href={{ pathname: '/loader', params: { to: seen ? '/map' : '/onboarding' } }} />;
}
