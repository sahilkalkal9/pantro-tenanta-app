import { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../store';
import { initializeAuth } from '../slices/authSlice';
import { requestAllPermissions } from '../slices/permissionsSlice';
import { initializeNetworkListener, loadOfflineQueue } from '../slices/offlineSlice';
import { Stack } from 'expo-router';
import { preventAutoHideAsync, hideAsync } from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTheme } from '../slices/uiSlice';
import { useTheme } from '../hooks/useTheme';
import { Toaster, PantroLoader } from '../components';
import { warmupBackend } from '../lib/api';
import apiCache from '../services/apiCache';

preventAutoHideAsync();

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate
        loading={<PantroLoader fullScreen message="Loading Pantro Tenant Portal…" />}
        persistor={persistor}
      >
        <RootNav />
        <GlobalLoader />
        <Toaster />
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

  useEffect(() => {
    warmupBackend();
    apiCache.hydrate();
    AsyncStorage.getItem('pantro_theme_mode').then((saved) => {
      if (saved === 'dark' || saved === 'light') {
        dispatch(setTheme(saved));
      }
    }).catch(() => {});
    dispatch(initializeAuth());
    dispatch(requestAllPermissions());
    dispatch(initializeNetworkListener());
    dispatch(loadOfflineQueue());
  }, [dispatch]);

  useEffect(() => {
    hideAsync();
  }, []);

  return null;
}

