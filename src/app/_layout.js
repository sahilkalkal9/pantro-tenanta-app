import { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../store';
import { initializeAuth } from '../slices/authSlice';
import { requestAllPermissions } from '../slices/permissionsSlice';
import { initializeNetworkListener, loadOfflineQueue } from '../slices/offlineSlice';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { preventAutoHideAsync, hideAsync } from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Nunito_300Light,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { PixelRatio, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTheme } from '../slices/uiSlice';
import { useTheme } from '../hooks/useTheme';
import { Toaster, PantroLoader, OtaUpdateModal } from '../components';
import { warmupBackend } from '../lib/api';
import apiCache from '../services/apiCache';
import { initLiveSocket } from '../services/liveSocket';
import { setupPushNotifications, registerDeviceToken } from '../services/pushNotifications';
import { AppState } from 'react-native';
import { setFontMetrics } from '../theme/tokens';

preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_300Light,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    if (fontsLoaded) {
      try {
        setFontMetrics({ fontScale: PixelRatio.getFontScale(), screenWidth });
      } catch (e) {
        console.warn('[Theme] setFontMetrics error:', e);
      }
    }
  }, [fontsLoaded, screenWidth]);

  const isLoading = !fontsLoaded && !fontError;

  return (
    <Provider store={store}>
      <PersistGate
        loading={isLoading ? <PantroLoader fullScreen message="Loading Pantro Tenant Portal…" /> : null}
        persistor={persistor}
      >
        <SafeAreaProvider>
          <RootNav />
          <GlobalLoader />
          <Toaster />
          <OtaUpdateModal />
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}

function RootNav() {
  const { isDark } = useTheme();

  return (
    <>
      <AppEffects />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? '#070b14' : '#f8fafc' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ presentation: 'card' }} />
        <Stack.Screen name="(app)" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}

function GlobalLoader() {
  const { isLoading, loadingMessage } = useSelector((state) => state.ui);
  if (!isLoading) return null;
  return <PantroLoader fullScreen message={loadingMessage || 'Please wait…'} />;
}

function AppEffects() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    warmupBackend();
    apiCache.hydrate();
    initLiveSocket();
    setupPushNotifications();
    AsyncStorage.getItem('pantro_theme_mode').then((saved) => {
      if (saved === 'dark' || saved === 'light') {
        dispatch(setTheme(saved));
      }
    }).catch(() => {});

    dispatch(initializeAuth());
    dispatch(requestAllPermissions()).then(() => {
      // Push permissions may now be granted — register the device token.
      registerDeviceToken().catch(() => {});
    }).catch(() => {});
    dispatch(initializeNetworkListener());
    dispatch(loadOfflineQueue());
  }, [dispatch]);

  // Register the device token whenever the tenant logs in (auth state change).
  useEffect(() => {
    if (isAuthenticated) {
      registerDeviceToken().catch(() => {});
      const retryTimer = setTimeout(() => {
        registerDeviceToken().catch(() => {});
      }, 2000);
      return () => clearTimeout(retryTimer);
    }
  }, [isAuthenticated]);

  // Re-register on foreground resume so a previously denied permission grant
  // or a cleared device token is retried.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        registerDeviceToken().catch(() => {});
      }
    });
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      hideAsync().catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return null;
}

