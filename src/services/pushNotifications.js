import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { api as namedApi } from '../lib/api';
import { getAuthToken } from '../lib/storage';
import { router } from 'expo-router';

const apiClient = api || namedApi;

const PUSH_TOKEN_KEY = 'pantro_tenant_push_token';
const AUTH_TOKEN_KEY = 'pantro_tenant_token';

// EAS project id from app.json `extra.eas.projectId`, with a fallback so the
// service never crashes if expo config isn't loaded yet.
const EAS_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.easConfig?.projectId ||
  Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId ||
  '5d2bd7c1-abe1-45ab-bf0b-ee548647d10a';

// Map backend TENANT_ROUTE_MAP web links -> expo-router mobile routes so a
// tapped push notification opens the right screen.
export function tenantRouteFromLink(link: string | undefined | null) {
  if (!link) return null;
  const url = new URL(link, 'https://tenant.pantro.in');
  const { pathname } = url;
  const map: Record<string, string> = {
    '/tenants/payments': '/(app)/payments',
    '/tenants/payment-proofs': '/(app)/more/documents',
    '/tenants/complaints': '/(app)/complaints',
    '/tenants/notices': '/(app)/more/notices',
    '/tenants/notice-period': '/(app)/more/notice-period',
    '/tenants/room': '/(app)/more/room',
    '/tenants/rent': '/(app)/rent',
    '/tenants/profile': '/(app)/profile',
    '/tenants/dashboard': '/(app)/dashboard',
    '/tenants/dues': '/(app)/dues',
    '/owner/dashboard': '/(app)/dashboard',
  };
  return map[pathname] || null;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 53+: banner/list are what actually show the notification in foreground.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowForegroundNotification: true,
  }),
});

export async function registerForPushNotifications(retries = 3) {
  if (Device.isDevice === false) {
    console.warn('[Push] Physical device recommended for push notifications (emulator detected)');
  }

  // Android notification channel (required on Android 8+)
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    } catch (channelErr) {
      console.warn('[Push] Channel setup warning:', channelErr?.message);
    }
  }

  // Request / check push permission.
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = request.status;
  }
  if (status !== 'granted') {
    console.log('[Push] Push permission not granted, status:', status);
    return null;
  }

  let token = null;

  // 1. Expo push service (primary, cross-platform Android & iOS)
  // On iOS, APNs token can take a moment to be registered natively, so we retry.
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: EAS_PROJECT_ID,
      });
      token = tokenResponse?.data;
      if (token) {
        console.log('[Push] Acquired Expo push token:', token.substring(0, 25) + '...');
        break;
      }
    } catch (err) {
      console.warn(`[Push] Expo push token fetch attempt ${attempt}/${retries} failed:`, err?.message || err);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // 2. Native fallback: FCM token on Android or native APNs token on iOS
  if (!token) {
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      token = deviceToken?.data;
      if (token) {
        console.log(`[Push] Acquired native device push token (${Platform.OS}):`, String(token).substring(0, 25) + '...');
      }
    } catch (deviceErr) {
      console.warn('[Push] Native device push token fallback also failed:', deviceErr?.message || deviceErr);
    }
  }

  return token;
}

export async function registerDeviceToken(options = {}) {
  const { retries = 3 } = options;
  try {
    const token = await registerForPushNotifications(retries);
    if (!token) {
      console.warn('[Push] No push token acquired; skipping backend registration');
      return { ok: false };
    }

    let authToken = await getAuthToken();
    if (!authToken) {
      authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    }
    if (!authToken) {
      authToken = apiClient.defaults?.headers?.common['Authorization']?.replace('Bearer ', '');
    }

    const headers = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    console.log(`[Push] Registering device token with backend (${Platform.OS}, authenticated: ${Boolean(authToken)})...`);
    const res = await apiClient.post(
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
    console.log('[Push] Tenant device token registered successfully in backend database');
    return { ok: true, token, data: res?.data };
  } catch (err) {
    console.error('[Push] Failed to register tenant device token:', err?.response?.data || err?.message || err);
    return { ok: false, error: err?.message };
  }
}

export async function unregisterDeviceToken() {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) return;
    await apiClient.delete('/notifications/device-token', { data: { token } });
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    console.log('[Push] Tenant device token unregistered');
  } catch (err) {
    console.warn('[Push] Failed to unregister device token:', err?.message || err);
  }
}

export function setupPushNotifications() {
  // Handle notification taps while the app is running (foreground/background)
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const link =
      response.notification.request.content.data?.link ||
      response.notification.request.content.data?.url;
    const route = tenantRouteFromLink(link);
    if (route) {
      try {
        router.replace(route);
      } catch {
        router.push(route);
      }
    }
  });

  // Handle cold-start launch from a notification (app opened from terminated state)
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const link =
        response.notification.request.content.data?.link ||
        response.notification.request.content.data?.url;
      const route = tenantRouteFromLink(link);
      if (route) {
        try {
          router.replace(route);
        } catch {
          router.push(route);
        }
      }
    }
  });

  return () => {
    try {
      responseSub.remove();
    } catch {}
  };
}

export default {
  registerForPushNotifications,
  registerDeviceToken,
  unregisterDeviceToken,
  setupPushNotifications,
  tenantRouteFromLink,
};
