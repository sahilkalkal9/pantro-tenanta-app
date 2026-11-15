import React, { useState, useEffect } from 'react';
import { Platform, View, StatusBar as RNStatusBar } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TenantTopbar, TenantBottomBar, TenantDrawer, PantroLoader } from '../../components';
import { useTheme } from '../../hooks/useTheme';
import { tenantService } from '../../services/tenantService';

export default function AppLayout() {
  const { isAuthenticated } = useSelector((state) => state.auth);
  const { isDark } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    tenantService.preloadPortalData();
  }, []);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const bgColor = isDark ? '#070b14' : '#ffffff';

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar
        style="light"
        backgroundColor="#2864B2"
        translucent
      />
      <TenantTopbar onMenuToggle={() => setDrawerOpen(true)} />
      <TenantDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Tabs
        tabBar={(props) => <TenantBottomBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'none',
          freezeOnBlur: false,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name="dues"
          options={{
            title: 'Dues',
          }}
        />
        <Tabs.Screen
          name="rent"
          options={{
            title: 'Rent',
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: 'Passbook',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
          }}
        />
        <Tabs.Screen
          name="complaints"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="privacy-policy"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="terms"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}
