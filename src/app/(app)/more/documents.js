import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import {
  FileText, Eye, IdCard, ExternalLink, ShieldCheck, CheckCircle2,
  Clock, RefreshCw, Download, ArrowRight,
} from 'lucide-react-native';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import { resolveMediaUrl } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import {
  Screen, TenantPageHeader, Card, Badge, ModalSheet, EmptyState, CardSkeleton,
  Button,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

export default function DocumentsScreen({ navigation }) {
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const cachedProf = tenantService.getCachedProfile();
  const [profile, setProfile] = useState(cachedProf);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(!cachedProf);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [verifRefreshing, setVerifRefreshing] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const fetchData = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedProfile()) setLoading(true);
      setError('');
      try {
        const [profRes, verifRes] = await Promise.allSettled([
          tenantService.getProfile({ bypassCache: refresh }),
          tenantService.getMyVerification(),
        ]);
        if (profRes.status === 'fulfilled') {
          setProfile(profRes.value);
        }
        if (verifRes.status === 'fulfilled') {
          setVerification(verifRes.value?.data || null);
        }
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

  const handleRefreshVerification = async () => {
    setVerifRefreshing(true);
    try {
      const res = await tenantService.refreshMyVerification();
      const updated = res?.data || null;
      if (updated) {
        setVerification(updated);
      }
      toast.success(
        updated?.policeVerification?.status === 'completed'
          ? 'Background verification report updated: Completed!'
          : 'Status checked. eCourts query is in progress.'
      );
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Could not refresh status');
    } finally {
      setVerifRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !profile) {
    return (
      <Screen>
        <TenantPageHeader title="Documents" subtitle="Your verified identity & documents" icon={ShieldCheck} iconTone="blue" />
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
        <TenantPageHeader title="Documents" subtitle="Your verified identity & documents" icon={ShieldCheck} iconTone="blue" />
        <EmptyState icon={FileText} title="Failed to load documents" message={error} />
      </Screen>
    );
  }

  const fullAadhaar = (() => {
    const raw = String(profile?.aadhaarNumber || verification?.aadhaarNumber || '').replace(/\D/g, '');
    if (raw.length === 12) return `${raw.slice(0, 4)} ${raw.slice(4, 8)} ${raw.slice(8, 12)}`;
    return raw || null;
  })();
  const fullPan = (profile?.panNumber || profile?.pan || '').toUpperCase().trim() || null;

  const kycDocs = [
    { key: 'aadhaarFront', label: 'Aadhaar Card (Front)', url: profile?.aadhaarFront, idValue: fullAadhaar },
    { key: 'aadhaarBack', label: 'Aadhaar Card (Back)', url: profile?.aadhaarBack, idValue: fullAadhaar },
    ...(profile?.panFront ? [{ key: 'panFront', label: 'PAN Card', url: profile.panFront, idValue: fullPan }] : []),
    ...(Array.isArray(profile?.kycDocuments)
      ? profile.kycDocuments.map((docUrl, i) => ({
          key: `kycDoc_${i}`,
          label: `KYC Document ${i + 1}`,
          url: docUrl,
        }))
      : []),
  ];
  const hasKyc = kycDocs.some((d) => d.url);

  const isAadhaarDone =
    verification?.aadhaarVerification?.verified ||
    profile?.aadhaarVerification?.status === 'verified' ||
    profile?.aadhaarVerification?.verified === true;

  const police = verification?.policeVerification || profile?.policeVerification || {};
  const isPoliceCompleted = police.status === 'completed';
  const isPoliceInProgress = police.status === 'in_progress' || police.status === 'submitted';
  const reportUrl = police.reportUrl;
  const docUrl = police.docUrl;

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchData({ refresh: true })}>
      <TenantPageHeader
        title="Documents & Verification"
        subtitle="Your verified identity and background clearance"
        icon={ShieldCheck}
        iconTone="blue"
      />

      {/* Background Verification Card */}
      <Card style={{ marginBottom: SPACING.md }}>
        <View style={[styles.head, { borderBottomColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: 'rgba(37, 99, 235, 0.10)' }]}>
            <ShieldCheck size={16} color={COLORS.primary} />
          </View>
          <Text style={[styles.headTitle, { color: colors.textPrimary }]}>Background Verification</Text>
          {isPoliceCompleted ? (
            <Badge
              label={police.verdict === 'clear' ? '✓ Record Clear' : '⚠️ Record Found'}
              color={police.verdict === 'clear' ? COLORS.success : COLORS.error}
              style={{ marginLeft: 'auto' }}
            />
          ) : isPoliceInProgress ? (
            <Badge label="In Progress" color={COLORS.primary} style={{ marginLeft: 'auto' }} />
          ) : (
            <Badge label={isAadhaarDone ? 'Verification Pending' : 'Aadhaar Pending'} color={COLORS.warning} style={{ marginLeft: 'auto' }} />
          )}
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Official two-step tenant background clearance powered by Surepass eCourts and UIDAI DigiLocker.
        </Text>

        {/* Steps */}
        <View style={{ gap: 10, marginBottom: 14 }}>
          {/* Step 1: DigiLocker Aadhaar KYC */}
          <View
            style={[
              styles.stepBox,
              {
                borderColor: isAadhaarDone ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                backgroundColor: isAadhaarDone
                  ? isDark ? 'rgba(16, 185, 129, 0.10)' : '#f0fdf4'
                  : isDark ? 'rgba(245, 158, 11, 0.10)' : '#fffbeb',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={[
                    styles.stepIcon,
                    {
                      backgroundColor: isAadhaarDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    },
                  ]}
                >
                  {isAadhaarDone ? (
                    <CheckCircle2 size={16} color="#059669" />
                  ) : (
                    <Clock size={16} color="#d97706" />
                  )}
                </View>
                <View>
                  <Text style={[styles.stepNumber, { color: colors.textTertiary }]}>STEP 1</Text>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>DigiLocker Aadhaar KYC</Text>
                </View>
              </View>
              <Badge label={isAadhaarDone ? 'Verified' : 'Pending'} color={isAadhaarDone ? COLORS.success : COLORS.warning} />
            </View>
            <View style={{ marginTop: 8 }}>
              {isAadhaarDone ? (
                <Text style={{ fontSize: 11.5, color: isDark ? '#34d399' : '#059669', fontWeight: '600' }}>
                  Identity verified via UIDAI DigiLocker {maskedAadhaar ? `(${maskedAadhaar})` : ''}
                </Text>
              ) : (
                <View>
                  <Text style={{ fontSize: 11.5, color: isDark ? '#fbbf24' : '#b45309', fontWeight: '500' }}>
                    Aadhaar verification is pending.
                  </Text>
                  {navigation && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
                      onPress={() => navigation.navigate('Profile', { tab: 'kyc' })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary }}>
                        Verify with DigiLocker
                      </Text>
                      <ArrowRight size={12} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Step 2: eCourts Background Check */}
          <View
            style={[
              styles.stepBox,
              {
                borderColor: isPoliceCompleted
                  ? 'rgba(16, 185, 129, 0.3)'
                  : isPoliceInProgress
                  ? 'rgba(59, 130, 246, 0.3)'
                  : colors.border,
                backgroundColor: isPoliceCompleted
                  ? isDark ? 'rgba(16, 185, 129, 0.10)' : '#f0fdf4'
                  : isPoliceInProgress
                  ? isDark ? 'rgba(59, 130, 246, 0.10)' : '#eff6ff'
                  : isDark ? colors.cardSecondary : COLORS.gray50,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={[
                    styles.stepIcon,
                    {
                      backgroundColor: isPoliceCompleted
                        ? 'rgba(16, 185, 129, 0.2)'
                        : isPoliceInProgress
                        ? 'rgba(59, 130, 246, 0.2)'
                        : 'rgba(148, 163, 184, 0.15)',
                    },
                  ]}
                >
                  <ShieldCheck
                    size={16}
                    color={
                      isPoliceCompleted
                        ? '#059669'
                        : isPoliceInProgress
                        ? '#2563eb'
                        : colors.textTertiary
                    }
                  />
                </View>
                <View>
                  <Text style={[styles.stepNumber, { color: colors.textTertiary }]}>STEP 2</Text>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>eCourts Background Check</Text>
                </View>
              </View>
              <Badge
                label={isPoliceCompleted ? 'Verified' : isPoliceInProgress ? 'Querying' : 'Not Started'}
                color={isPoliceCompleted ? COLORS.success : isPoliceInProgress ? COLORS.primary : COLORS.gray400}
              />
            </View>
            <View style={{ marginTop: 8 }}>
              {isPoliceCompleted ? (
                <Text style={{ fontSize: 11.5, color: isDark ? '#34d399' : '#059669', fontWeight: '600' }}>
                  {police.verdict === 'clear'
                    ? 'Clear / No Adverse Judicial Record Found'
                    : 'Adverse Court Record Detected'}
                  {police.completedAt ? ` · ${formatDate(police.completedAt)}` : ''}
                </Text>
              ) : isPoliceInProgress ? (
                <Text style={{ fontSize: 11.5, color: isDark ? '#93c5fd' : '#1d4ed8', fontWeight: '500' }}>
                  Querying national court repository (~2-5 mins).
                </Text>
              ) : (
                <Text style={{ fontSize: 11.5, color: colors.textTertiary, fontWeight: '500' }}>
                  Will be initiated by your property manager after DigiLocker KYC.
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Certificate Ready or In-Progress Actions */}
        {isPoliceCompleted && reportUrl ? (
          <View style={[styles.actionBanner, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
                Background Verification Certificate Ready
              </Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                Official certificate digitally signed and verified.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={styles.downloadBtn}
                activeOpacity={0.8}
                onPress={() => Linking.openURL(resolveMediaUrl(reportUrl)).catch(() => {})}
              >
                <Download size={13} color="#fff" />
                <Text style={styles.downloadBtnText}>PDF</Text>
              </TouchableOpacity>
              {docUrl && (
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: '#475569' }]}
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL(resolveMediaUrl(docUrl)).catch(() => {})}
                >
                  <Download size={13} color="#fff" />
                  <Text style={styles.downloadBtnText}>DOC</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : isPoliceInProgress ? (
          <View style={[styles.actionBanner, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff', borderColor: 'rgba(59, 130, 246, 0.25)' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
                eCourts Background Check In Progress
              </Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                Surepass is searching court records (~1-3 mins).
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.downloadBtn, { backgroundColor: '#2563eb' }]}
              activeOpacity={0.8}
              onPress={handleRefreshVerification}
              disabled={verifRefreshing}
            >
              {verifRefreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <RefreshCw size={13} color="#fff" />
                  <Text style={styles.downloadBtnText}>Refresh</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Mandatory Legal & Partner Attribution */}
        <View style={[styles.attributionBox, { borderTopColor: colors.border }]}>
          <Text style={[styles.attributionText, { color: colors.textTertiary }]}>
            Background Verification Done by <Text style={{ fontWeight: '700' }}>Pantro</Text> powered with{' '}
            <Text style={{ fontWeight: '700' }}>Surepass Technologies Private Limited</Text>.
          </Text>
          <Text style={[styles.attributionText, { color: colors.textTertiary, marginTop: 2 }]}>
            Pantro is a product of <Text style={{ fontWeight: '700' }}>Wabsyte Studio Private Limited</Text>.
          </Text>
        </View>
      </Card>

      {/* KYC Documents Card */}
      <Card>
        <View style={[styles.head, { borderBottomColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: 'rgba(37, 99, 235, 0.10)' }]}>
            <IdCard size={16} color={COLORS.primary} />
          </View>
          <Text style={[styles.headTitle, { color: colors.textPrimary }]}>KYC Document Photos</Text>
        </View>

        {/* Identity Numbers Summary Banner */}
        <View style={[styles.idBanner, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff', borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#bfdbfe' }]}>
          <View style={styles.idBannerItem}>
            <Text style={[styles.idBannerLabel, { color: colors.textSecondary }]}>Full Aadhaar</Text>
            <Text style={[styles.idBannerValue, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
              {fullAadhaar || 'Not Available'}
            </Text>
          </View>
          <View style={[styles.idBannerDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1' }]} />
          <View style={styles.idBannerItem}>
            <Text style={[styles.idBannerLabel, { color: colors.textSecondary }]}>Full PAN</Text>
            <Text style={[styles.idBannerValue, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
              {fullPan || 'Not Available'}
            </Text>
          </View>
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Official identity documents on file. All cards are rendered edge-to-edge uncropped with full UIDAI & ITD identity records.
        </Text>

        {!hasKyc ? (
          <View style={[styles.emptyBox, { borderColor: colors.border }]}>
            <FileText size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No KYC document photos uploaded</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Physical document photos are optional when DigiLocker KYC has been completed.
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

function DocumentPhoto({ label, url, idValue, onOpen }) {
  const { colors, isDark } = useTheme();
  if (!url) {
    return (
      <View style={[styles.photoEmpty, { borderColor: colors.border, backgroundColor: isDark ? colors.cardSecondary : COLORS.gray50 }]}>
        <FileText size={24} color={colors.textTertiary} />
        <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>{label}</Text>
        {idValue ? (
          <Text style={{ fontSize: 11, fontWeight: '700', fontFamily: 'monospace', color: COLORS.primary, marginTop: 3 }}>
            {idValue}
          </Text>
        ) : null}
        <Text style={[styles.photoNotUploaded, { color: colors.textTertiary }]}>Not uploaded</Text>
      </View>
    );
  }
  return (
    <View style={[styles.docCardContainer, { borderColor: colors.border, backgroundColor: isDark ? '#111827' : '#ffffff' }]}>
      <View style={styles.photoLabelRow}>
        <IdCard size={13} color={COLORS.primary} />
        <Text style={[styles.photoLabel, { color: colors.textPrimary }]}>{label}</Text>
        {idValue ? (
          <View style={[styles.idBadge, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff', borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe' }]}>
            <Text style={[styles.idBadgeText, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>{idValue}</Text>
          </View>
        ) : null}
      </View>
      <TouchableOpacity activeOpacity={0.88} onPress={onOpen} style={[styles.photoWrapper, { borderColor: colors.border, backgroundColor: isDark ? '#030712' : '#f8fafc' }]}>
        <Image source={{ uri: resolveMediaUrl(url) }} style={styles.photo} resizeMode="contain" />
        <View style={styles.viewOverlay}>
          <Eye size={13} color={COLORS.white} />
          <Text style={styles.viewText}>Full View</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.openLink}
        activeOpacity={0.7}
        onPress={() => Linking.openURL(resolveMediaUrl(url)).catch(() => {})}
      >
        <ExternalLink size={10} color={colors.textTertiary} />
        <Text style={[styles.openLinkText, { color: colors.textTertiary }]}>Open in full resolution</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  icon: { width: 30, height: 30, borderRadius: BORDER_RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  note: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: SPACING.sm, marginBottom: SPACING.sm, lineHeight: 18 },
  idBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 6,
  },
  idBannerItem: {
    alignItems: 'center',
    flex: 1,
  },
  idBannerLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  idBannerValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  idBannerDivider: {
    width: 1,
    height: 24,
  },
  stepBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  attributionBox: {
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: 4,
  },
  attributionText: {
    fontSize: 10,
    lineHeight: 14,
  },
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
  docCardContainer: {
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  photoLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  photoLabel: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary },
  idBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  idBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
  photoNotUploaded: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: 2 },
  photoWrapper: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  photo: { width: '100%', height: '100%' },
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
    backgroundColor: 'rgba(0,0,0,0.65)',
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
