import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { router } from 'expo-router';
import {
  Sun,
  Moon,
  Bell,
  User,
  X,
  CheckCheck,
  LogOut,
  ChevronRight,
  ExternalLink,
  Menu,
} from 'lucide-react-native';
import { tenantService } from '../../services/tenantService';
import { logout } from '../../slices/authSlice';
import { useTheme } from '../../hooks/useTheme';
import { formatDate } from '../../lib/format';
import { COLORS, SPACING, SHADOWS } from '../../constants/colors';

const PANTRO_ICON = require('../../../assets/pantro-icon.png');

export default function TenantTopbar({ onMenuToggle }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { theme, toggleTheme, isDark, mounted } = useTheme();

  const [propertyName, setPropertyName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  // Notifications Modal State
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Account Menu Modal State
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const fetchTopbarData = useCallback(async () => {
    try {
      const [dashRes, countsRes] = await Promise.allSettled([
        tenantService.getDashboard(),
        tenantService.getNotificationCounts(),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value) {
        const d = dashRes.value?.dashboard || dashRes.value?.data || dashRes.value;
        const name = d?.profile?.propertyId?.name || d?.property?.name || d?.profile?.property?.name || '';
        if (name) setPropertyName(name);
      }

      if (countsRes.status === 'fulfilled' && countsRes.value) {
        const c = countsRes.value?.data || countsRes.value;
        const total = typeof c?.total === 'number' ? c.total : (typeof c === 'number' ? c : 0);
        setUnreadCount(total);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchTopbarData();
    const timer = setInterval(fetchTopbarData, 30000);
    return () => clearInterval(timer);
  }, [fetchTopbarData]);

  const fetchNotificationsList = async () => {
    setNotifLoading(true);
    try {
      const res = await tenantService.getNotifications({ page: 1, limit: 10 });
      setNotifications(Array.isArray(res) ? res : res?.notifications || []);
    } catch (_) {
    } finally {
      setNotifLoading(false);
    }
  };

  const handleOpenNotifications = () => {
    setNotifOpen(true);
    fetchNotificationsList();
  };

  const handleMarkAllRead = async () => {
    try {
      await tenantService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (_) {}
  };

  const handleNotificationPress = async (n) => {
    try {
      if (!n.read && n._id) {
        await tenantService.markNotificationRead(n._id);
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (_) {}
    setNotifOpen(false);
    if (n.link) {
      router.push(n.link);
    } else {
      router.push('/more/notifications');
    }
  };

  const handleSignOut = () => {
    setProfileMenuOpen(false);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await dispatch(logout());
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const displayName = user?.name || user?.fullName || 'Tenant';
  const displayContact = user?.email || user?.phone || '';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'T';

  return (
    <>
      <View style={[styles.topbar, isDark && styles.topbarDark]}>
        {/* ── Left: Menu & Brand & Property ──────────────── */}
        <View style={styles.leftRow}>
          {!!onMenuToggle && (
            <TouchableOpacity
              style={[styles.menuBtn, isDark && styles.menuBtnDark]}
              onPress={onMenuToggle}
              activeOpacity={0.7}
              hitSlop={6}
              accessibilityLabel="Open navigation menu"
            >
              <Menu size={18} color={isDark ? '#e2e8f0' : '#1e293b'} strokeWidth={2.2} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.brandRow}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.7}
          >
            <Image
              source={PANTRO_ICON}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <Text style={[styles.brandText, isDark && styles.brandTextDark]}>
              PANTRO
            </Text>

            {!!propertyName && (
              <View style={styles.propertyWrap}>
                <Text style={[styles.slashText, isDark && styles.slashTextDark]}>/</Text>
                <View style={[styles.propertyPill, isDark && styles.propertyPillDark]}>
                  <Text
                    style={[styles.propertyName, isDark && styles.propertyNameDark]}
                    numberOfLines={1}
                  >
                    {propertyName}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Right: Theme Toggle, Notifications, Profile ─── */}
        <View style={styles.actionsRow}>
          {/* Theme Switcher Button */}
          <TouchableOpacity
            style={[styles.iconBtn, isDark && styles.iconBtnDark]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            hitSlop={6}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun size={17} color="#fbbf24" strokeWidth={2.2} />
            ) : (
              <Moon size={17} color="#0284c7" strokeWidth={2.2} />
            )}
          </TouchableOpacity>

          {/* Notification Bell */}
          <TouchableOpacity
            style={[styles.iconBtn, isDark && styles.iconBtnDark]}
            onPress={handleOpenNotifications}
            activeOpacity={0.7}
            hitSlop={6}
            aria-label="Notifications"
          >
            <Bell size={17} color={isDark ? '#cbd5e1' : '#475569'} strokeWidth={2.2} />
            {unreadCount > 0 && (
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Profile Button */}
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => setProfileMenuOpen(true)}
            activeOpacity={0.7}
            hitSlop={6}
            aria-label="Account menu"
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Notifications Popover Modal ────────────────────── */}
      <Modal
        visible={notifOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setNotifOpen(false)}
        >
          <View
            style={[styles.notifSheet, isDark && styles.notifSheetDark]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.notifHeader, isDark && styles.notifHeaderDark]}>
              <Text style={[styles.notifTitle, isDark && styles.notifTitleDark]}>
                NOTIFICATIONS
              </Text>
              <View style={styles.notifHeaderRight}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    style={[styles.markReadBtn, isDark && styles.markReadBtnDark]}
                    onPress={handleMarkAllRead}
                    activeOpacity={0.7}
                  >
                    <CheckCheck size={13} color="#2563eb" strokeWidth={2.2} />
                    <Text style={styles.markReadText}>Mark read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.notifCloseBtn}
                  onPress={() => setNotifOpen(false)}
                  hitSlop={8}
                >
                  <X size={16} color={isDark ? '#94a3b8' : '#64748b'} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.notifScroll}
              showsVerticalScrollIndicator={false}
            >
              {notifLoading ? (
                <View style={styles.emptyNotifBox}>
                  <Text style={styles.emptyNotifText}>Loading notifications…</Text>
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.emptyNotifBox}>
                  <Text style={styles.emptyNotifText}>No new notifications</Text>
                </View>
              ) : (
                notifications.map((n) => (
                  <TouchableOpacity
                    key={n._id || n.id}
                    style={[
                      styles.notifItem,
                      isDark && styles.notifItemDark,
                      !n.read && (isDark ? styles.notifItemUnreadDark : styles.notifItemUnread),
                    ]}
                    onPress={() => handleNotificationPress(n)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.notifItemTop}>
                      <Text
                        style={[
                          styles.notifItemTitle,
                          isDark && styles.notifItemTitleDark,
                          !n.read && styles.notifItemTitleUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {n.title}
                      </Text>
                      {!n.read && <View style={styles.unreadPing} />}
                    </View>
                    {n.message ? (
                      <Text
                        style={[styles.notifItemMessage, isDark && styles.notifItemMessageDark]}
                        numberOfLines={2}
                      >
                        {n.message}
                      </Text>
                    ) : null}
                    <Text style={styles.notifItemDate}>
                      {formatDate(n.createdAt)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.viewAllNotifsBtn, isDark && styles.viewAllNotifsBtnDark]}
              onPress={() => {
                setNotifOpen(false);
                router.push('/more/notifications');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllNotifsText}>View all notifications</Text>
              <ExternalLink size={13} color="#2563eb" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Profile Account Menu Modal ─────────────────────── */}
      <Modal
        visible={profileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setProfileMenuOpen(false)}
        >
          <View
            style={[styles.profileSheet, isDark && styles.profileSheetDark]}
            onStartShouldSetResponder={() => true}
          >
            {/* Header: User Summary */}
            <View style={[styles.profileMenuHeader, isDark && styles.profileMenuHeaderDark]}>
              <View style={styles.profileMenuAvatar}>
                <Text style={styles.profileMenuAvatarInitial}>{initial}</Text>
              </View>
              <View style={styles.profileMenuUserText}>
                <Text
                  style={[styles.profileMenuName, isDark && styles.profileMenuNameDark]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                {!!displayContact && (
                  <Text
                    style={[styles.profileMenuContact, isDark && styles.profileMenuContactDark]}
                    numberOfLines={1}
                  >
                    {displayContact}
                  </Text>
                )}
              </View>
            </View>

            {/* Menu Items */}
            <TouchableOpacity
              style={[styles.profileMenuItem, isDark && styles.profileMenuItemDark]}
              onPress={() => {
                setProfileMenuOpen(false);
                router.push('/more/profile');
              }}
              activeOpacity={0.7}
            >
              <User size={16} color={isDark ? '#cbd5e1' : '#334155'} strokeWidth={2.2} />
              <Text style={[styles.profileMenuItemText, isDark && styles.profileMenuItemTextDark]}>
                My Profile
              </Text>
              <ChevronRight size={15} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileMenuItem, styles.profileMenuItemDanger, isDark && styles.profileMenuItemDangerDark]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <LogOut size={16} color="#e11d48" strokeWidth={2.2} />
              <Text style={styles.profileMenuItemTextDanger}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  topbar: {
    height: 54,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 40,
    ...SHADOWS.small,
  },
  topbarDark: {
    backgroundColor: '#070b14',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
    gap: 8,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  menuBtnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logoIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    marginRight: 6,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: -0.4,
  },
  brandTextDark: {
    color: '#3b82f6',
  },
  propertyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  slashText: {
    fontSize: 12,
    color: '#cbd5e1',
    marginHorizontal: 5,
    fontWeight: '600',
  },
  slashTextDark: {
    color: '#334155',
  },
  propertyPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 130,
  },
  propertyPillDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  propertyName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  propertyNameDark: {
    color: '#cbd5e1',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...SHADOWS.small,
  },
  iconBtnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgePill: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  /* Modal Backdrop */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 14,
  },

  /* Notifications Modal Sheet */
  notifSheet: {
    width: 320,
    maxHeight: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...SHADOWS.large,
    overflow: 'hidden',
  },
  notifSheetDark: {
    backgroundColor: '#0e1526',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  notifHeaderDark: {
    backgroundColor: '#0e1526',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  notifTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#0f172a',
  },
  notifTitleDark: {
    color: '#f1f5f9',
  },
  notifHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  markReadBtnDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  notifCloseBtn: {
    padding: 3,
  },
  notifScroll: {
    maxHeight: 280,
  },
  notifItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  notifItemDark: {
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  notifItemUnread: {
    backgroundColor: '#f8fafc',
  },
  notifItemUnreadDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  notifItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
  },
  notifItemTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  notifItemTitleDark: {
    color: '#cbd5e1',
  },
  notifItemTitleUnread: {
    fontWeight: '800',
    color: '#0f172a',
  },
  unreadPing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
  },
  notifItemMessage: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  notifItemMessageDark: {
    color: '#94a3b8',
  },
  notifItemDate: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 4,
  },
  emptyNotifBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNotifText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  viewAllNotifsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  viewAllNotifsBtnDark: {
    backgroundColor: '#0b1120',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewAllNotifsText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563eb',
  },

  /* Profile Menu Sheet */
  profileSheet: {
    width: 250,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...SHADOWS.large,
    overflow: 'hidden',
  },
  profileSheetDark: {
    backgroundColor: '#0e1526',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  profileMenuHeaderDark: {
    backgroundColor: '#0e1526',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  profileMenuAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMenuAvatarInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileMenuUserText: {
    flex: 1,
    minWidth: 0,
  },
  profileMenuName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileMenuNameDark: {
    color: '#f1f5f9',
  },
  profileMenuContact: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  profileMenuContactDark: {
    color: '#94a3b8',
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  profileMenuItemDark: {
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  profileMenuItemDanger: {
    borderBottomWidth: 0,
    backgroundColor: '#fff1f2',
  },
  profileMenuItemDangerDark: {
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
  },
  profileMenuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  profileMenuItemTextDark: {
    color: '#cbd5e1',
  },
  profileMenuItemTextDanger: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e11d48',
    flex: 1,
  },
});
