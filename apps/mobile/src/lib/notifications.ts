import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '@/src/lib/supabase';
import { getDeviceFingerprint } from './device-fingerprint';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'd8323be7-2237-4c19-a45f-055b9600ddc5',
  });
  
  return tokenData.data;
}

export async function savePushToken(token: string) {
  const fingerprint = await getDeviceFingerprint();
  await supabase.from('push_tokens').upsert({
    device_fingerprint: fingerprint,
    push_token: token,
  });
}

export async function deletePushToken() {
  const fingerprint = await getDeviceFingerprint();
  await supabase.from('push_tokens').delete().eq('device_fingerprint', fingerprint);
}
