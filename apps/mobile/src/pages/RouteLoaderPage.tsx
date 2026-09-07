import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/src/hooks/use-theme';

export function RouteLoaderPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ to?: string }>();

  const targetRoute = typeof params.to === 'string' && params.to.trim().length > 0 ? params.to : '/map';

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(targetRoute as '/map' | '/onboarding' | '/settings' | '/suggest-clinic');
    }, 1100);
    return () => clearTimeout(timer);
  }, [router, targetRoute]);

  const { isDark } = useTheme();
  const palette = useMemo(
    () =>
      isDark
        ? { bg: '#060A13', text: '#E2E8F0', sub: '#93C5FD', spinner: '#60A5FA' }
        : { bg: '#F4F7FF', text: '#0B1220', sub: '#3B82F6', spinner: '#2563EB' },
    [isDark]
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View style={styles.center}>
        <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <ActivityIndicator size="small" color={palette.spinner} style={styles.spinner} />
        <Text style={[styles.label, { color: palette.text }]}>Preparing your experience...</Text>
        <Text style={[styles.subLabel, { color: palette.sub }]}>Just a moment</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 18,
  },
  spinner: {
    marginTop: 16,
  },
  label: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '700',
  },
  subLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
});

