import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  Phone, Mail, MapPin, Clock, MessageSquare, ChevronRight,
  ShieldCheck, Sparkles, AlertTriangle, Building2, LifeBuoy,
} from 'lucide-react-native';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import {
  Screen, TenantPageHeader, Card, CardSkeleton, PantroLoader,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

export default function SupportScreen() {
  const toast = useToast();
  const { colors, isDark } = useTheme();
  const cachedProf = tenantService.getCachedProfile();
  const [profile, setProfile] = useState(cachedProf);
  const [loading, setLoading] = useState(!cachedProf);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedProfile()) setLoading(true);
      try {
        const res = await tenantService.getProfile({ bypassCache: refresh });
        setProfile(res);
      } catch (e) {
        if (!tenantService.getCachedProfile()) {
          toast.error(getErrorMessage(e));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !profile) {
    return (
      <Screen>
        <TenantPageHeader title="Help & Support" subtitle="Need assistance with your stay, payments, or room? We're here to help." icon={LifeBuoy} iconTone="violet" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
          <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
            Loading support details…
          </Text>
        </View>
        <CardSkeleton count={2} />
      </Screen>
    );
  }

  const property = profile?.propertyId || null;
  const owner = profile?.ownerId || null;
  const propertyName = property?.name || '';
  const emergencyPhone = property?.contactPhone || owner?.phone || '';
  const managerName = owner?.name || property?.contactPerson || '';
  const managerPhone = owner?.phone || property?.contactPhone || '';
  const managerEmail = owner?.email || '';
  const address = [property?.address, property?.city, property?.state].filter(Boolean).join(', ');

  const call = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => toast.error('Could not open dialer'));
  };
  const mail = (email) => {
    if (email) Linking.openURL(`mailto:${email}`).catch(() => toast.error('Could not open mail app'));
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchProfile({ refresh: true })}>
      <TenantPageHeader
        title="Help & Support"
        subtitle="Need assistance with your stay, payments, or room? We're here to help."
        icon={LifeBuoy}
        iconTone="violet"
      />

      {/* 24/7 Emergency Contact */}
      <Card style={styles.card} onPress={() => emergencyPhone && call(emergencyPhone)}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: `${COLORS.danger}15` }]}>
            <Phone size={20} color={COLORS.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>24/7 Emergency Contact</Text>
            <Text style={[styles.sub, { color: colors.textTertiary }]}>Available day and night for urgent matters</Text>
            {emergencyPhone ? (
              <>
                <View style={styles.emergencyNumberRow}>
                  <Phone size={16} color={COLORS.danger} />
                  <Text style={styles.emergencyLink}>{emergencyPhone}</Text>
                </View>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  Call immediately for power outages, water leakage, lockouts, or safety emergencies.
                </Text>
              </>
            ) : (
              <Text style={[styles.muted, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                Emergency contact will be updated by your manager shortly.
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* Office & Gate Hours */}
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: `${COLORS.warning}15` }]}>
            <Clock size={20} color={COLORS.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Office & Gate Hours</Text>
            <Text style={[styles.sub, { color: colors.textTertiary, marginBottom: SPACING.xs }]}>
              Manager availability & property timings
            </Text>

            <View style={[styles.scheduleRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.scheduleLabel, { color: colors.textSecondary }]}>Manager Availability</Text>
              <Text style={[styles.scheduleValue, { color: colors.textTertiary }]}>10:00 AM – 7:00 PM</Text>
            </View>
            <View style={[styles.scheduleRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.scheduleLabel, { color: colors.textSecondary }]}>Working Days</Text>
              <Text style={[styles.scheduleValue, { color: colors.textTertiary }]}>Monday to Saturday</Text>
            </View>
            <View style={[styles.scheduleRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.scheduleLabel, { color: colors.textSecondary }]}>Main Gate Timings</Text>
              <Text style={[styles.scheduleValue, { color: colors.textTertiary }]}>Open 24/7 (Security on duty)</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Property Manager & Premises */}
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: `${COLORS.secondary}15` }]}>
            <Building2 size={20} color={COLORS.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {managerName ? `Property Manager — ${managerName}` : 'Property Manager & Premises'}
            </Text>
            <Text style={[styles.sub, { color: colors.textTertiary, marginBottom: SPACING.xs }]}>
              {propertyName || 'Your property contact'}
            </Text>

            <View style={styles.contactGrid}>
              {managerPhone ? (
                <TouchableOpacity
                  style={[styles.contactBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : COLORS.gray50, borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : COLORS.borderLight }]}
                  activeOpacity={0.7}
                  onPress={() => call(managerPhone)}
                >
                  <Text style={[styles.contactLabel, { color: colors.textFaint }]}>Phone Number</Text>
                  <View style={styles.contactValueRow}>
                    <Phone size={14} color={isDark ? '#60a5fa' : '#2563eb'} />
                    <Text style={[styles.contactValue, { color: isDark ? '#60a5fa' : '#2563eb' }]}>{managerPhone}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {managerEmail ? (
                <TouchableOpacity
                  style={[styles.contactBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : COLORS.gray50, borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : COLORS.borderLight }]}
                  activeOpacity={0.7}
                  onPress={() => mail(managerEmail)}
                >
                  <Text style={[styles.contactLabel, { color: colors.textFaint }]}>Email Address</Text>
                  <View style={styles.contactValueRow}>
                    <Mail size={14} color={isDark ? '#60a5fa' : '#2563eb'} />
                    <Text style={[styles.contactValue, { color: isDark ? '#60a5fa' : '#2563eb' }]} numberOfLines={1}>{managerEmail}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>

            {!!address && (
              <View style={[styles.addressRow, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : COLORS.gray50, borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : COLORS.borderLight }]}>
                <MapPin size={14} color={colors.textTertiary} style={{ marginTop: 2 }} />
                <Text style={[styles.address, { color: colors.textSecondary }]}>{address}</Text>
              </View>
            )}
          </View>
        </View>
      </Card>

      {/* Raise a Complaint */}
      <Card style={styles.card} onPress={() => router.push('/complaints')}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <AlertTriangle size={18} color="#d97706" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Need Maintenance or Have an Issue?</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              Raise a ticket for plumbing, electricity, cleaning, WiFi, or food.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} />
        </View>
      </Card>

      {/* Platform & Technology Partner Info */}
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: 'rgba(20, 184, 166, 0.15)' }]}>
            <Sparkles size={20} color="#0d9488" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Platform & Technology</Text>
            <Text style={[styles.sub, { color: colors.textTertiary }]}>Official technology partner information</Text>

            <View style={[styles.partnerBox, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff', borderColor: isDark ? 'rgba(37, 99, 235, 0.3)' : '#bfdbfe' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.partnerCompany, { color: colors.textPrimary }]}>
                  A Product of Wabsyte Studio (OPC) Private Limited
                </Text>
                <Text style={[styles.partnerDesc, { color: colors.textSecondary }]}>
                  Modern PropTech Software for PG, Hostel, RK & Flat Management.
                </Text>
              </View>
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={14} color="#2563eb" />
                <Text style={styles.verifiedText}>Verified Platform</Text>
              </View>
            </View>

            <Text style={[styles.licenseText, { color: colors.textTertiary }]}>
              All tenancy records, rent receipts, security deposit calculations, and digital rent agreements in this
              portal are powered by Pantro under license from{' '}
              <Text style={{ fontWeight: FONT_WEIGHTS.bold }}>Wabsyte Studio (OPC) Private Limited</Text>.
            </Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  icon: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold },
  emergencyNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  emergencyLink: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.danger },
  muted: { fontSize: FONT_SIZES.sm, marginTop: 4 },
  sub: { fontSize: FONT_SIZES.xs, lineHeight: 17, marginTop: 4 },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  scheduleLabel: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semibold },
  scheduleValue: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.normal },
  contactGrid: { flexDirection: 'column', gap: SPACING.md, marginTop: SPACING.sm },
  contactBox: { padding: 12, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  contactLabel: {
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  contactValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactValue: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semibold, flexShrink: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: SPACING.sm, padding: 12, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  address: { flex: 1, fontSize: FONT_SIZES.xs, lineHeight: 16 },
  partnerBox: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  partnerCompany: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold },
  partnerDesc: { fontSize: 11, marginTop: 2 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: { fontSize: 11, fontWeight: FONT_WEIGHTS.semibold, color: '#2563eb' },
  licenseText: { fontSize: 11, lineHeight: 16, marginTop: SPACING.md },
});
