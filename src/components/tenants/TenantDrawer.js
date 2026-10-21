import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  X,
  User,
  LayoutDashboard,
  IndianRupee,
  CreditCard,
  Receipt,
  DoorOpen,
  Bell,
  AlertTriangle,
  LogOut,
  FileText,
  HeadphonesIcon,
  Moon,
  Sun,
  ChevronRight,
  CalendarClock,
} from 'lucide-react-native';
import { logout } from '../../slices/authSlice';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, SHADOWS } from '../../constants/colors';

const PANTRO_ICON = require('../../../assets/pantro-icon.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

const MENU_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'dues', label: 'Dues & Pending', href: '/dues', icon: IndianRupee },
  { key: 'rent', label: 'Rent Payments', href: '/rent', icon: CreditCard },
  { key: 'payments', label: 'Transactions', href: '/payments', icon: Receipt },
  { key: 'room', label: 'My Room & Stay', href: '/more/room', icon: DoorOpen },
  { key: 'notices', label: 'Notices', href: '/more/notices', icon: Bell },
  { key: 'complaints', label: 'Complaints', href: '/complaints', icon: AlertTriangle },
  { key: 'notice-period', label: 'Notice Period', href: '/more/notice-period', icon: CalendarClock },
  { key: 'documents', label: 'Documents', href: '/more/documents', icon: FileText },
  { key: 'support', label: 'Support & Help', href: '/more/support', icon: HeadphonesIcon },
  { key: 'profile', label: 'My Profile', href: '/profile', icon: User },
];

export default function TenantDrawer({ visible, onClose }) {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { user } = useSelector((state) => state.auth);
  const { isDark, toggleTheme } = useTheme();

  const [showModal, setShowModal] = useState(visible);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  if (!showModal) return null;

  const displayName = user?.name || user?.fullName || 'Tenant';
  const displayContact = user?.email || user?.phone || 'View Profile';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'T';

  const handleNavigate = (href) => {
    onClose();
    router.push(href);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your Pantro account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            onClose();
            dispatch(logout());
          },
        },
      ]
    );
  };

  const isActive = (href) => {
    if (!pathname) return false;
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const drawerBg = isDark ? '#0b1120' : '#ffffff';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#cbd5e1' : '#475569';
  const textFaint = isDark ? '#64748b' : '#94a3b8';

  return (
    <Modal
      transparent
      visible={showModal}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim,
                backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15,23,42,0.5)',
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Drawer Panel */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              backgroundColor: drawerBg,
              borderRightColor: borderColor,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
            {/* Header: Brand + Close */}
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
              <View style={styles.brandRow}>
                <Image source={PANTRO_ICON} style={styles.brandLogo} resizeMode="contain" />
                <View>
                  <Text style={[styles.brandTitle, { color: textPrimary }]}>Pantro</Text>
                  <Text style={[styles.brandSub, { color: textFaint }]}>Tenant Portal</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }]}
                activeOpacity={0.7}
                hitSlop={8}
                aria-label="Close menu"
              >
                <X size={18} color={textSecondary} strokeWidth={2.3} />
              </TouchableOpacity>
            </View>

            {/* Profile summary card */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => handleNavigate('/profile')}
              style={[
                styles.profileCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                  borderColor: borderColor,
                },
              ]}
            >
              <View style={styles.avatarBox}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: textPrimary }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.profileContact, { color: textFaint }]} numberOfLines={1}>
                  {displayContact}
                </Text>
              </View>
              <ChevronRight size={16} color={textFaint} />
            </TouchableOpacity>

            {/* Navigation links */}
            <ScrollView
              style={styles.navScroll}
              contentContainerStyle={styles.navContent}
              showsVerticalScrollIndicator={false}
            >
              {MENU_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.key}
                    activeOpacity={0.7}
                    onPress={() => handleNavigate(item.href)}
                    style={[
                      styles.navItem,
                      active && {
                        backgroundColor: isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff',
                      },
                    ]}
                  >
                    <Icon
                      size={18}
                      color={active ? '#2563eb' : textSecondary}
                      strokeWidth={active ? 2.4 : 1.9}
                    />
                    <Text
                      style={[
                        styles.navLabel,
                        {
                          color: active ? (isDark ? '#60a5fa' : '#2563eb') : textSecondary,
                          fontWeight: active ? '700' : '600',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {active && <View style={styles.activeDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Footer Actions */}
            <View style={[styles.footer, { borderTopColor: borderColor }]}>
              {/* Theme Toggle Button */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={toggleTheme}
                style={[
                  styles.themeToggleBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
                    borderColor: borderColor,
                  },
                ]}
              >
                <View style={styles.themeLeft}>
                  {isDark ? (
                    <Moon size={16} color="#38bdf8" strokeWidth={2.2} />
                  ) : (
                    <Sun size={16} color="#f59e0b" strokeWidth={2.2} />
                  )}
                  <Text style={[styles.themeLabel, { color: textPrimary }]}>
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </Text>
                </View>
                <Text style={styles.themeSwitchText}>Switch</Text>
              </TouchableOpacity>

              {/* Sign Out Button */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleSignOut}
                style={styles.signOutBtn}
              >
                <LogOut size={16} color="#e11d48" strokeWidth={2.2} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>

              {/* Corporate Footer Branding */}
              <View style={styles.brandingBox}>
                <Text style={[styles.brandingTitle, { color: textSecondary }]}>
                  Pantro Tenant Portal
                </Text>
                <Text style={[styles.brandingSub, { color: textFaint }]}>
                  A Product of Wabsyte Studio (OPC) Private Limited
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    height: '100%',
    borderRightWidth: 1,
    ...SHADOWS.lg,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '700',
  },
  profileContact: {
    fontSize: 11,
    marginTop: 1,
  },
  navScroll: {
    flex: 1,
    marginTop: SPACING.xs,
  },
  navContent: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navLabel: {
    fontSize: 13,
    flex: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
  },
  footer: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
    borderTopWidth: 1,
    gap: 6,
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
  },
  themeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  themeSwitchText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e11d48',
  },
  brandingBox: {
    alignItems: 'center',
    paddingTop: 2,
  },
  brandingTitle: {
    fontSize: 10,
    fontWeight: '700',
  },
  brandingSub: {
    fontSize: 8,
    marginTop: 1,
    textAlign: 'center',
  },
});
