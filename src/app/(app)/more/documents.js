import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { FileText, Eye, IdCard, ExternalLink } from 'lucide-react-native';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import { resolveMediaUrl } from '../../../lib/api';
import {
  Screen, TenantPageHeader, Card, Badge, ModalSheet, EmptyState, CardSkeleton,
  PantroLoader,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

export default function DocumentsScreen() {
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const cachedProf = tenantService.getCachedProfile();
  const [profile, setProfile] = useState(cachedProf);
  const [loading, setLoading] = useState(!cachedProf);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const fetchData = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedProfile()) setLoading(true);
      setError('');
      try {
        const res = await tenantService.getProfile({ bypassCache: refresh });
        setProfile(res);
      } catch (e) {
        if (!tenantService.getCachedProfile()) {
          setError(getErrorMessage(e));
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
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !profile) {
    return (
      <Screen>
        <TenantPageHeader title="Documents" subtitle="Your uploaded KYC documents" icon={IdCard} iconTone="blue" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
          <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
            Loading your documents…
          </Text>
        </View>
        <CardSkeleton count={2} />
      </Screen>
    );
  }

  if (error && !profile) {
    return (
      <Screen refreshing={refreshing} onRefresh={() => fetchData({ refresh: true })}>
        <TenantPageHeader title="Documents" subtitle="Your uploaded KYC documents" icon={IdCard} iconTone="blue" />
        <EmptyState icon={FileText} title="Failed to load documents" message={error} />
      </Screen>
    );
  }

  const kycDocs = [
    { key: 'aadhaarFront', label: 'Aadhaar Card (Front)', url: profile?.aadhaarFront },
    { key: 'aadhaarBack', label: 'Aadhaar Card (Back)', url: profile?.aadhaarBack },
  ];
  const hasKyc = kycDocs.some((d) => d.url);
  const maskedAadhaar = profile?.aadhaarNumber ? `XXXX XXXX ${String(profile.aadhaarNumber).slice(-4)}` : null;

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchData({ refresh: true })}>
      <TenantPageHeader title="Documents" subtitle="Your uploaded KYC documents" icon={IdCard} iconTone="blue" />

      <Card>
        <View style={[styles.head, { borderBottomColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: 'rgba(37, 99, 235, 0.10)' }]}>
            <IdCard size={16} color={COLORS.primary} />
          </View>
          <Text style={[styles.headTitle, { color: colors.textPrimary }]}>KYC Documents</Text>
          {!!maskedAadhaar && <Badge label={maskedAadhaar} color={COLORS.primary} style={{ marginLeft: 'auto' }} />}
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          These documents were uploaded by your owner/manager during onboarding. Tap any image to view full size.
        </Text>

        {!hasKyc ? (
          <View style={[styles.emptyBox, { borderColor: colors.border }]}>
            <FileText size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No KYC documents uploaded yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Please contact your manager/owner to upload your Aadhaar documents.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {kycDocs.map((doc) => (
              <DocumentPhoto key={doc.key} {...doc} onOpen={() => setLightbox(doc)} />
            ))}
          </View>
        )}
      </Card>

      <View style={[styles.infoNote, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.15)' }]}>
        <IdCard size={15} color={isDark ? '#60a5fa' : '#2563eb'} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>Why we need these documents</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Aadhaar is used for identity verification as per PG/hostel regulations. Your data is stored securely and
            never shared with third parties.
          </Text>
        </View>
      </View>

      <ModalSheet
        visible={!!lightbox}
        onClose={() => setLightbox(null)}
        title={lightbox?.label || 'Document'}
      >
        {lightbox?.url ? (
          <>
            <Image source={{ uri: resolveMediaUrl(lightbox.url) }} style={[styles.lightboxImage, { backgroundColor: colors.cardSecondary }]} resizeMode="contain" />
            <Text style={[styles.lightboxHint, { color: colors.textTertiary }]}>Tap anywhere outside to close</Text>
          </>
        ) : null}
      </ModalSheet>
    </Screen>
  );
}

function DocumentPhoto({ label, url, onOpen }) {
  const { colors, isDark } = useTheme();
  if (!url) {
    return (
      <View style={[styles.photoEmpty, { borderColor: colors.border, backgroundColor: isDark ? colors.cardSecondary : COLORS.gray50 }]}>
        <FileText size={24} color={colors.textTertiary} />
        <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.photoNotUploaded, { color: colors.textTertiary }]}>Not uploaded</Text>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.photoLabelRow}>
        <IdCard size={12} color={COLORS.primary} />
        <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <TouchableOpacity activeOpacity={0.85} onPress={onOpen}>
        <Image source={{ uri: resolveMediaUrl(url) }} style={[styles.photo, { backgroundColor: colors.cardSecondary }]} resizeMode="cover" />
        <View style={styles.viewOverlay}>
          <Eye size={13} color={COLORS.white} />
          <Text style={styles.viewText}>View</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.openLink}
        activeOpacity={0.7}
        onPress={() => Linking.openURL(resolveMediaUrl(url)).catch(() => {})}
      >
        <ExternalLink size={10} color={colors.textTertiary} />
        <Text style={[styles.openLinkText, { color: colors.textTertiary }]}>Open in new tab</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  icon: { width: 30, height: 30, borderRadius: BORDER_RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  note: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: SPACING.md, marginBottom: SPACING.md, lineHeight: 18 },
  emptyBox: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
  },
  emptyTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary, marginTop: SPACING.sm },
  emptyText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  grid: { gap: SPACING.md },
  photoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  photoLabel: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textSecondary },
  photoNotUploaded: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: 2 },
  photo: { width: '100%', height: 180, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.gray100 },
  photoEmpty: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray50,
  },
  viewOverlay: {
    position: 'absolute',
    right: SPACING.sm,
    bottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  viewText: { color: COLORS.white, fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semibold },
  infoNote: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderRadius: 14,
    padding: 14,
    marginTop: SPACING.md,
    borderWidth: 1,
  },
  infoTitle: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary },
  infoText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2, lineHeight: 17 },
  lightboxImage: { width: '100%', height: 400, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.gray100 },
  lightboxHint: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  openLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 6,
  },
  openLinkText: { fontSize: 11 },
});
