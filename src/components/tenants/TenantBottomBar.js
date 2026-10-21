import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  IndianRupee,
  CreditCard,
  Receipt,
  User,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';

export const NAV_TABS = [
  { key: 'dashboard', name: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { key: 'dues', name: 'dues', label: 'Dues', icon: IndianRupee },
  { key: 'rent', name: 'rent', label: 'Rent', icon: CreditCard },
  { key: 'payments', name: 'payments', label: 'Passbook', icon: Receipt },
  { key: 'profile', name: 'profile', label: 'Profile', icon: User },
];

export default function TenantBottomBar({ state, descriptors, navigation }) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const currentRouteName = state?.routes?.[state.index]?.name;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#070b14' : '#ffffff',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.8)',
          paddingBottom: Math.max(insets.bottom, 6),
        },
      ]}
    >
      <View style={styles.tabsRow}>
        {NAV_TABS.map((tab) => {
          const matchingRoute = state?.routes?.find((r) => r.name === tab.name);
          const isFocused =
            currentRouteName === tab.name ||
            (tab.name === 'dues' && currentRouteName === 'more' && descriptors?.[state.routes[state.index].key]?.route?.params?.screen === 'dues') ||
            (tab.name === 'profile' && currentRouteName === 'more' && descriptors?.[state.routes[state.index].key]?.route?.params?.screen === 'profile');

          const Icon = tab.icon;

          const onPress = () => {
            if (matchingRoute) {
              const event = navigation.emit({
                type: 'tabPress',
                target: matchingRoute.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate({ name: tab.name, merge: true });
              }
            } else {
              navigation.navigate(tab.name);
            }
          };

          const onLongPress = () => {
            if (matchingRoute) {
              navigation.emit({
                type: 'tabLongPress',
                target: matchingRoute.key,
              });
            }
          };

          const activeColor = isDark ? '#60a5fa' : '#2563eb';
          const inactiveColor = isDark ? '#94a3b8' : '#64748b';
          const activeBg = isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff';

          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={tab.label}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.7}
              style={[
                styles.tabItem,
                isFocused && { backgroundColor: activeBg },
              ]}
            >
              <Icon
                size={isFocused ? 20 : 19}
                color={isFocused ? activeColor : inactiveColor}
                strokeWidth={isFocused ? 2.3 : 1.9}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? activeColor : inactiveColor,
                    fontWeight: isFocused ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 6,
    paddingHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
