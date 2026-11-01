import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { router } from 'expo-router';

const PUSH_TOKEN_KEY = 'pantro_tenant_push_token';
const AUTH_TOKEN_KEY = 'pantro_tenant_token';

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
    console.log('[Push] Push permission not granted');
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResponse.data;
  } catch (err) {
    console.warn('[Push] Error getting push token:', err?.message || err);
    return null;
  }
}

export async function registerDeviceToken() {
  try {
    const token = await registerForPushNotifications();
    if (!token) return;

    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (stored === token) return; // already registered

    await api.post('/notifications/device-token', {
      token,
      platform: Platform.OS,
      deviceName: Device.deviceName || Platform.OS,
      app: 'tenant',
    });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    console.log('[Push] Tenant device token registered successfully');
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
  // Register once at app start if logged in
  AsyncStorage.getItem(AUTH_TOKEN_KEY).then((authToken) => {
    if (authToken) {
      registerDeviceToken();
    }
  }).catch(() => {});

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
