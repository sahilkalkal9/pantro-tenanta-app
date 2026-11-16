import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  IndianRupee,
  CreditCard,
  Receipt,
  User,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { responsiveFontSize } from "../../theme";

export const NAV_TABS = [
  { key: 'dashboard', name: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { key: 'dues', name: 'dues', label: 'Dues', icon: IndianRupee },
  { key: 'rent', name: 'rent', label: 'Rent', icon: CreditCard },
  { key: 'payments', name: 'payments', label: 'Passbook', icon: Receipt },
  { key: 'profile', name: 'profile', label: 'Profile', icon: User },
];

let globalPreviousTabIndex = 0;
let globalActiveTabIndex = 0;

export const getActiveTabIndex = (currentRouteName, state, descriptors) => {
  if (!currentRouteName) return 0;
  if (currentRouteName === 'dashboard') return 0;
  if (
    currentRouteName === 'dues' ||
    (currentRouteName === 'more' &&
      descriptors?.[state?.routes?.[state?.index]?.key]?.route?.params?.screen === 'dues')
  ) {
    return 1;
  }
  if (currentRouteName === 'rent') return 2;
  if (currentRouteName === 'payments') return 3;
  if (
    currentRouteName === 'profile' ||
    (currentRouteName === 'more' &&
      descriptors?.[state?.routes?.[state?.index]?.key]?.route?.params?.screen === 'profile')
  ) {
    return 4;
  }
  return 0;
};

export default function TenantBottomBar({ state, descriptors, navigation }) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(screenWidth - 16);

  const currentRouteName = state?.routes?.[state?.index]?.name;
  const activeIdx = getActiveTabIndex(currentRouteName, state, descriptors);

  const translateXAnim = useRef(new Animated.Value(globalActiveTabIndex)).current;

  useEffect(() => {
    if (activeIdx >= 0) {
      if (globalActiveTabIndex !== activeIdx) {
        globalPreviousTabIndex = globalActiveTabIndex;
        globalActiveTabIndex = activeIdx;
      }
      Animated.spring(translateXAnim, {
        toValue: activeIdx,
        damping: 22,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIdx, translateXAnim]);

  const tabWidth = rowWidth / 5;
  const pillWidth = Math.max(0, tabWidth - 6);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(7, 11, 20, 0.94)' : 'rgba(255, 255, 255, 0.92)',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.85)',
          paddingBottom: Math.max(insets.bottom, 6),
          shadowColor: isDark ? '#000000' : '#0f172a',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.35 : 0.06,
          shadowRadius: 16,
          elevation: 10,
        },
      ]}
    >
      <View
        style={styles.tabsRow}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - rowWidth) > 1) {
            setRowWidth(w);
          }
        }}
      >
        {/* Animated Sliding Liquid Glass Capsule (Owner App style) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingCapsule,
            {
              width: pillWidth,
              backgroundColor: isDark ? 'rgba(40, 100, 178, 0.22)' : 'rgba(40, 100, 178, 0.10)',
              borderColor: isDark ? 'rgba(96, 165, 250, 0.35)' : 'rgba(40, 100, 178, 0.25)',
              transform: [
                {
                  translateX: translateXAnim.interpolate({
                    inputRange: [0, 1, 2, 3, 4],
                    outputRange: [
                      3,
                      tabWidth + 3,
                      tabWidth * 2 + 3,
                      tabWidth * 3 + 3,
                      tabWidth * 4 + 3,
                    ],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Subtle top specular reflection line */}
          <View
            style={[
              styles.capsuleSpecular,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.8)' },
            ]}
          />
        </Animated.View>

        {NAV_TABS.map((tab, index) => {
          const matchingRoute = state?.routes?.find((r) => r.name === tab.name);
          const isFocused = activeIdx === index;
          const Icon = tab.icon;

          const onPress = () => {
            if (index !== globalActiveTabIndex) {
              globalPreviousTabIndex = globalActiveTabIndex;
              globalActiveTabIndex = index;
              Animated.spring(translateXAnim, {
                toValue: index,
                damping: 22,
                stiffness: 180,
                mass: 0.9,
                useNativeDriver: true,
              }).start();
            }

            if (matchingRoute) {
              const event = navigation.emit({
                type: 'tabPress',
                target: matchingRoute.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(tab.name, { merge: true });
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

          const activeColor = isDark ? '#60a5fa' : '#2864B2';
          const inactiveColor = isDark ? '#94a3b8' : '#64748b';

          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={tab.label}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.75}
              style={styles.tabItem}
            >
              {Icon ? (
                <Icon
                  size={19}
                  color={isFocused ? activeColor : inactiveColor}
                  strokeWidth={isFocused ? 2.4 : 1.9}
                />
              ) : null}
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? activeColor : inactiveColor,
                    fontWeight: isFocused ? '800' : '600',
                    marginTop: 2,
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
    position: 'relative',
  },
  slidingCapsule: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#2864B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  capsuleSpecular: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    borderRadius: 0.5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: responsiveFontSize(10.5),
    letterSpacing: 0.1,
  },
});
