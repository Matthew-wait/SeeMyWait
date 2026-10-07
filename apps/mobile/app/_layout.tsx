import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import { AppLoadingSplash } from '@/src/components/AppLoadingSplash';
import { toastConfig } from '@/src/components/toast-config';
import { useTheme } from '@/src/hooks/use-theme';
import { logScreenView } from '@/src/lib/analytics';

export default function RootLayout() {
  const { isDark, loading } = useTheme();
  const [minSplashDone, setMinSplashDone] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashDone(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Screen-view on every route change — Firebase Analytics only ever sees the
  // very first screen otherwise, since this is a single native app, not a
  // series of fresh page loads.
  useEffect(() => {
    void logScreenView(pathname || '/');
  }, [pathname]);

  if (loading || !minSplashDone) {
    return (
      <>
        <AppLoadingSplash isDark={isDark} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Toast config={toastConfig} />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="loader" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="map" options={{ headerShown: false }} />
          <Stack.Screen name="suggest-clinic" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Toast config={toastConfig} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
