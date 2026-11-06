import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { router } from 'expo-router';

const PUSH_TOKEN_KEY = 'pantro_tenant_push_token';
const AUTH_TOKEN_KEY = 'pantro_tenant_token';
const EAS_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.easConfig?.projectId ||
  Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId ||
  '5d2bd7c1-abe1-45ab-bf0b-ee548647d10a';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('[Push] Physical device required for push notifications');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (existingStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== 'granted') {
    console.log('[Push] Push permission not granted, status:', status);
    return null;
  }

  let token = null;

  // 1. Try Expo push service (Primary for cross-platform Android & iOS)
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    token = tokenResponse?.data;
    if (token) {
      console.log('[Push] Acquired Expo push token:', token.substring(0, 25) + '...');
    }
  } catch (err) {
    console.warn('[Push] Expo push token fetch failed:', err?.message || err);
  }

  // 2. Fallback to native FCM/APNs token if Expo service is unreachable
  if (!token) {
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      token = deviceToken?.data;
      if (token) {
        console.log('[Push] Acquired native device token:', String(token).substring(0, 25) + '...');
      }
    } catch (deviceErr) {
      console.warn('[Push] Native device token fallback also failed:', deviceErr?.message || deviceErr);
    }
  }

  return token;
}

export async function registerDeviceToken() {
  try {
    const token = await registerForPushNotifications();
    if (!token) return;

    let authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!authToken) {
      authToken = api.defaults.headers.common['Authorization']?.replace('Bearer ', '');
    }

    const headers = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    await api.post(
      '/notifications/device-token',
      {
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName || Platform.OS,
        app: 'tenant',
      },
      { headers }
    );
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    console.log('[Push] Tenant device token registered with backend for ' + Platform.OS);
  } catch (err) {
    console.warn('[Push] Failed to register tenant device token:', err?.message || err);
  }
}

export async function unregisterDeviceToken() {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) return;
    await api.delete('/notifications/device-token', { data: { token } });
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    console.log('[Push] Tenant device token unregistered');
  } catch (err) {
    console.warn('[Push] Failed to unregister device token:', err?.message || err);
  }
}

export function setupPushNotifications() {
  // Always register on app launch
  registerDeviceToken().catch(() => {});

  // Handle tapped notification interaction
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response.notification.request.content.data?.link;
      if (link) {
        try {
          router.push(link);
        } catch {}
      }
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

export default {
  registerForPushNotifications,
  registerDeviceToken,
  unregisterDeviceToken,
  setupPushNotifications,
};
