import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  AlertCircle, Receipt, IndianRupee, User, FileText, DoorOpen, Bell,
  LogOut, Calendar, MessageSquare, Settings, ChevronRight, HelpCircle,
  Shield,
} from 'lucide-react-native';
import { logout } from '../../../slices/authSlice';
import {
  Screen, TenantPageHeader, Card, Avatar, ListItem, SectionHeader, Divider, Button, Badge,
} from '../../../components';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

import { useTheme } from '../../../hooks/useTheme';

const MENU = [
  {
    title: 'Financial',
    items: [
      { icon: AlertCircle, color: COLORS.danger, label: 'Dues', subtitle: 'Everything you need to pay', route: '/more/dues' },
      { icon: Receipt, color: COLORS.secondary, label: 'Transactions', subtitle: 'Payment history & proofs', route: '/payments' },
      { icon: IndianRupee, color: COLORS.success, label: 'Rent & Deposit', subtitle: 'View and pay your rent', route: '/rent' },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: User, color: COLORS.info, label: 'My Profile', subtitle: 'Personal, family, bank & signature', route: '/more/profile' },
      { icon: FileText, color: '#7c3aed', label: 'Documents', subtitle: 'Your uploaded KYC documents', route: '/more/documents' },
      { icon: DoorOpen, color: COLORS.accent, label: 'Room', subtitle: 'Your room & change requests', route: '/more/room' },
    ],
  },
  {
    title: 'Notices',
    items: [
      { icon: Bell, color: COLORS.warning, label: 'Notices', subtitle: 'Important updates from management', route: '/more/notices' },
      { icon: Calendar, color: COLORS.primary, label: 'Notice Period', subtitle: 'Submit a request to vacate', route: '/more/notice-period' },
    ],
  },
  {
    title: 'Support & Settings',
    items: [
      { icon: MessageSquare, color: COLORS.success, label: 'Complaints', subtitle: 'Raise and track complaints', route: '/complaints' },
      { icon: HelpCircle, color: COLORS.secondary, label: 'Support', subtitle: 'Contact your manager & help', route: '/more/support' },
      { icon: Bell, color: COLORS.info, label: 'Notifications', subtitle: 'Your recent notifications', route: '/more/notifications' },
      { icon: Settings, color: COLORS.gray500, label: 'Settings', subtitle: 'Password & account', route: '/more/settings' },
      { icon: Shield, color: '#7c3aed', label: 'Privacy Policy', subtitle: 'How we protect your data', route: '/more/privacy-policy' },
    ],
  },
];

export default function MoreScreen() {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const name = user?.name || user?.fullName || 'Tenant';
  const email = user?.email || user?.phone || '';

  return (
    <Screen>
      <TenantPageHeader title="More" subtitle="Everything else, in one place" icon={User} iconTone="blue" />

      <Card style={styles.profileCard} onPress={() => router.push('/more/profile')}>
        <View style={styles.profileRow}>
          <Avatar name={name} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]} numberOfLines={1}>
              {name}
            </Text>
            {!!email && (
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {email}
              </Text>
            )}
            <Badge label={(user?.role || 'tenant').toUpperCase()} color={COLORS.primary} style={{ marginTop: 6 }} />
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </View>
      </Card>

      {MENU.map((group) => (
        <View key={group.title} style={styles.group}>
          <SectionHeader title={group.title} />
          <Card padded={false} style={styles.groupCard}>
            {group.items.map((item, idx) => (
              <View key={item.label}>
                <ListItem
                  icon={item.icon}
                  iconColor={item.color}
                  title={item.label}
                  subtitle={item.subtitle}
                  chevron={ChevronRight}
                  onPress={() => router.push(item.route)}
                  style={styles.listItem}
                />
                {idx < group.items.length - 1 && <Divider style={{ marginLeft: 56 }} />}
              </View>
            ))}
          </Card>
        </View>
      ))}

      <Button
        title="Sign Out"
        variant="danger"
        icon={LogOut}
        onPress={() => dispatch(logout())}
        style={{ marginTop: SPACING.sm }}
        fullWidth
      />

      <Text style={[styles.version, { color: colors.textTertiary }]}>Pantro Tenant</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: { marginBottom: SPACING.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  profileName: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  profileEmail: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  group: { marginBottom: SPACING.lg },
  groupCard: { paddingHorizontal: SPACING.md },
  listItem: { paddingVertical: SPACING.md },
  version: {
    textAlign: 'center',
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    marginTop: SPACING.md,
  },
});
