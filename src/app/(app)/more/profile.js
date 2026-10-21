import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  User, Mail, Phone, MapPin, Calendar, Building2, Home, BedDouble,
  Wallet, Shield, Users, IdCard, AlertTriangle, AlertCircle, RefreshCw,
  CheckCircle2, GraduationCap, Briefcase, Banknote, FileText,
  ExternalLink, X, Save, Heart, Edit3, Lock, FileCheck, PenLine,
  Check, ArrowRight, ShieldCheck, BadgeCheck, ShieldAlert,
  HelpCircle, Sparkles, RotateCcw, LogOut, Loader2, Upload,
} from 'lucide-react-native';
import Signature from 'react-native-signature-canvas';
import { WebView } from 'react-native-webview';
import { tenantService } from '../../../services/tenantService';
import { logout } from '../../../slices/authSlice';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import api, { resolveMediaUrl } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/format';
import {
  Screen, Card, Button, Badge, Avatar, ProgressBar, Chip, TextField, SelectField,
  EmptyState, ImageKitUploader, TenantPageHeader, Skeleton, CardSkeleton, PantroLoader,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

const EDUCATION_LEVELS = [
  { value: 'high_school',   label: 'High school' },
  { value: 'diploma',       label: 'Diploma' },
  { value: 'undergraduate', label: "Undergraduate (Bachelor's)" },
  { value: 'postgraduate',  label: "Postgraduate (Master's)" },
  { value: 'phd',          label: 'PhD' },
  { value: 'other',        label: 'Other' },
];

const EMPLOYMENT_STATUSES = [
  { value: 'student',       label: 'Student' },
  { value: 'employed',      label: 'Employed (full-time / part-time)' },
  { value: 'self_employed', label: 'Self-employed / Freelance' },
  { value: 'unemployed',    label: 'Unemployed' },
  { value: 'other',         label: 'Other' },
];

const GENDERS = [
  { value: 'male',   label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other',  label: 'Other' },
];

const SECTION_NAV = [
  { key: 'personal',   label: 'Personal',   icon: User },
  { key: 'family',     label: 'Family',     icon: Heart },
  { key: 'education',  label: 'Education',  icon: GraduationCap },
  { key: 'employment', label: 'Employment', icon: Briefcase },
  { key: 'bank',       label: 'Bank',       icon: Banknote },
  { key: 'kyc',        label: 'Aadhaar',    icon: IdCard },
  { key: 'signature',  label: 'Signature',  icon: PenLine },
  { key: 'session',    label: 'Session',    icon: LogOut },
];

function formatBedNumber(bedNumber, roomNumber) {
  if (!bedNumber) return '—';
  const bed = String(bedNumber).trim();
  if (roomNumber) {
    const prefix = `${String(roomNumber).trim()}-`;
    if (bed.startsWith(prefix)) return bed.slice(prefix.length) || bed;
  }
  return bed;
}

// ── Local KYC service helpers (mirrors web tenantService) ─────────
async function kycCheckAadhaarUnique(aadhaarNumber) {
  const res = await api.post('/tenant/kyc/check-unique', { aadhaarNumber });
  return res?.data;
}

async function kycInit(payload = {}) {
  const res = await api.post('/tenant/kyc/init', payload);
  return res?.data;
}

async function kycComplete(clientId) {
  const res = await api.post('/tenant/kyc/complete', { clientId });
  return res?.data;
}

async function kycGet() {
  const res = await api.get('/tenant/kyc');
  return res?.data;
}

const DIGILOCKER_FALLBACK_SDK_URL =
  'https://cdn.jsdelivr.net/gh/surepassio/surepass-digiboost-web-sdk@latest/index.min.js';

function formatAadhaarInput(val) {
  const digits = String(val || '').replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.substring(i, i + 4));
  }
  return parts.join(' ');
}

function maskAadhaar(num) {
  const clean = String(num || '').replace(/\s/g, '');
  if (clean.length !== 12) return num || '';
  return `XXXX XXXX ${clean.slice(-4)}`;
}

const SIGNATURE_WEB_STYLE = `
  .m-signature-pad--footer {display: flex; justify-content: space-between; margin: 12px 20px;}
  .m-signature-pad {box-shadow: none; border: none; background-color: #ffffff;}
  .m-signature-pad--body {border: 1px dashed #cbd5e1; border-radius: 8px;}
  body,html {width: 100%; height: 100%; margin: 0; padding: 0;}
  .button {background-color: #2563eb; color: #ffffff; font-weight: bold; border-radius: 8px; padding: 10px 24px; font-size: 15px;}
  .button.clear {background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;}
`;

export default function TenantProfileScreen() {
  const toast = useToast();
  const dispatch = useDispatch();
  const { colors, isDark } = useTheme();
  const storedUser = useSelector((state) => state.auth?.user);

  const cachedForm = tenantService.getCachedProfileForm();
  const [form, setForm] = useState(cachedForm);
  const [loading, setLoading] = useState(!cachedForm);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Editing states: { family: bool, education: bool, employment: bool, bank: bool, kyc: bool }
  const [editing, setEditing] = useState({});
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState({});
  const [saveError, setSaveError] = useState({});
  const [saveSuccess, setSaveSuccess] = useState({});

  // Signature state
  const [signatureInput, setSignatureInput] = useState('');
  const [signatureData, setSignatureData] = useState(''); // drawn signature (data URL)
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [signatureError, setSignatureError] = useState('');
  const [drawModalOpen, setDrawModalOpen] = useState(false);

  // Lightbox modal state
  const [lightbox, setLightbox] = useState(null); // { url, label }

  // Quick navigation
  const [activeSection, setActiveSection] = useState('personal');
  const scrollRef = useRef(null);
  const sectionLayouts = useRef({});

  const fetchForm = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedProfileForm()) setLoading(true);
      setError('');
      try {
        const res = await tenantService.getProfileForm({ bypassCache: refresh });
        const payload = res?.data?.data || res?.data || res;
        setForm(payload);
        if (payload?.profile) {
          setDraft(seedDraft(payload.profile));
        }
      } catch (err) {
        if (!tenantService.getCachedProfileForm()) {
          setError(getErrorMessage(err));
        }
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profile = form?.profile;
  const progress = form?.progress || { filled: 0, total: 0, percent: 0 };
  const checklist = form?.checklist || [];

  const updateDraftField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (sectionKey) => {
    setEditing((prev) => ({ ...prev, [sectionKey]: true }));
    setSaveError((prev) => ({ ...prev, [sectionKey]: '' }));
    setSaveSuccess((prev) => ({ ...prev, [sectionKey]: '' }));
  };

  const handleCancel = (sectionKey) => {
    if (!profile) return;
    setDraft(seedDraft(profile));
    setEditing((prev) => ({ ...prev, [sectionKey]: false }));
    setSaveError((prev) => ({ ...prev, [sectionKey]: '' }));
    setSaveSuccess((prev) => ({ ...prev, [sectionKey]: '' }));
  };

  const validateSection = (sectionKey) => {
    if (sectionKey === 'personal') {
      if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
        return 'Enter a valid email address';
      }
    }
    if (sectionKey === 'family') {
      if (draft.fatherPhone) {
        const clean = String(draft.fatherPhone).replace(/\D/g, '').slice(-10);
        if (!/^[6-9]\d{9}$/.test(clean)) {
          return 'Enter a valid 10-digit father phone number';
        }
      }
      if (draft.emergencyContactPhone) {
        const clean = String(draft.emergencyContactPhone).replace(/\D/g, '').slice(-10);
        if (!/^[6-9]\d{9}$/.test(clean)) {
          return 'Enter a valid 10-digit emergency contact phone number';
        }
      }
    }
    if (sectionKey === 'kyc') {
      if (draft.aadhaarNumber) {
        const clean = String(draft.aadhaarNumber).replace(/\D/g, '');
        if (clean.length !== 12) {
          return 'Aadhaar must be exactly 12 digits';
        }
      }
    }
    if (sectionKey === 'bank') {
      if (draft.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(draft.ifsc.trim().toUpperCase())) {
        return 'Enter a valid 11-character IFSC code (e.g. SBIN0001234)';
      }
    }
    return '';
  };

  const handleSave = async (sectionKey) => {
    const validationErr = validateSection(sectionKey);
    if (validationErr) {
      setSaveError((prev) => ({ ...prev, [sectionKey]: validationErr }));
      toast.error(validationErr);
      return;
    }

    setSaving((prev) => ({ ...prev, [sectionKey]: true }));
    setSaveError((prev) => ({ ...prev, [sectionKey]: '' }));
    setSaveSuccess((prev) => ({ ...prev, [sectionKey]: '' }));

    try {
      const payload = buildSectionPayload(sectionKey, draft);
      const res = await tenantService.updateProfile(payload);
      const fresh = res?.data?.data || res?.data || res;
      if (fresh) {
        setForm(fresh);
        if (fresh?.profile) {
          setDraft(seedDraft(fresh.profile));
        }
      }
      setEditing((prev) => ({ ...prev, [sectionKey]: false }));
      const msg = 'Changes saved successfully!';
      setSaveSuccess((prev) => ({ ...prev, [sectionKey]: msg }));
      toast.success(msg);
      setTimeout(() => {
        setSaveSuccess((prev) => ({ ...prev, [sectionKey]: '' }));
      }, 3500);
      fetchForm({ refresh: true });
    } catch (err) {
      const msg = getErrorMessage(err);
      setSaveError((prev) => ({ ...prev, [sectionKey]: msg }));
      toast.error(msg);
    } finally {
      setSaving((prev) => ({ ...prev, [sectionKey]: false }));
    }
  };

  const isAnyEditing = Object.values(editing).some(Boolean);

  const handleToggleEditAll = () => {
    if (isAnyEditing) {
      // Cancel all edits
      setDraft(seedDraft(profile));
      setEditing({});
      setSaveError({});
    } else {
      // Enable all editable sections
      setEditing({
        family: true,
        education: true,
        employment: true,
        bank: true,
        kyc: !profile?.aadhaarVerification?.verified,
      });
      setSaveError({});
    }
  };

  const handleSaveAll = async () => {
    // Validate all sections
    for (const key of ['family', 'bank', 'kyc']) {
      const err = validateSection(key);
      if (err) {
        setSaveError({ all: err });
        toast.error(err);
        return;
      }
    }

    setSaving((prev) => ({ ...prev, all: true }));
    setSaveError({});
    try {
      const payload = buildSectionPayload('all', draft);
      const res = await tenantService.updateProfile(payload);
      const fresh = res?.data?.data || res?.data || res;
      if (fresh) {
        setForm(fresh);
        if (fresh?.profile) {
          setDraft(seedDraft(fresh.profile));
        }
      }
      setEditing({});
      const msg = 'All profile sections saved successfully!';
      setSaveSuccess({ all: msg });
      toast.success(msg);
      setTimeout(() => setSaveSuccess({}), 3500);
      fetchForm({ refresh: true });
    } catch (err) {
      const msg = getErrorMessage(err);
      setSaveError({ all: msg });
      toast.error(msg);
    } finally {
      setSaving((prev) => ({ ...prev, all: false }));
    }
  };

  const handleSaveSignature = async () => {
    const val = (signatureData || signatureInput || '').trim();
    if (!val) {
      setSignatureError('Please draw or upload your signature before saving.');
      return;
    }
    setSignatureSaving(true);
    setSignatureError('');
    try {
      const payload = val.startsWith('data:') ? { signatureData: val } : { signatureUrl: val };
      await tenantService.saveMySignature(payload);
      setSignatureData('');
      setSignatureInput('');
      setSignatureSaved(true);
      setTimeout(() => setSignatureSaved(false), 3000);
      fetchForm({ refresh: true });
    } catch (err) {
      setSignatureError(getErrorMessage(err));
    } finally {
      setSignatureSaving(false);
    }
  };

  const handleSignOut = () => {
    dispatch(logout());
  };

  const scrollToSection = (key) => {
    setActiveSection(key);
    const layout = sectionLayouts.current[key];
    if (layout && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, layout.y - 12), animated: true });
    }
  };

  const onSectionLayout = (key, event) => {
    const { y } = event.nativeEvent.layout;
    sectionLayouts.current[key] = { y };
  };

  if (loading && !form) {
    return (
      <Screen scroll={false}>
        <View style={styles.container}>
          <TenantPageHeader title="My Profile" icon={User} iconTone="blue" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
            <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
              Loading your profile…
            </Text>
          </View>
          {/* Hero card skeleton */}
          <Card padded={false}>
            <Skeleton variant="card" style={{ height: 128, borderRadius: 0 }} />
            <View style={{ flexDirection: 'row' }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ flex: 1, padding: SPACING.sm + 2, gap: 8 }}>
                  <Skeleton variant="text" style={{ width: 64, height: 10 }} />
                  <Skeleton variant="text" style={{ width: '80%', height: 14 }} />
                </View>
              ))}
            </View>
          </Card>
          {/* Section card skeletons */}
          <CardSkeleton count={3} />
        </View>
      </Screen>
    );
  }

  if (error && !profile) {
    return (
      <Screen>
        <TenantPageHeader title="My Profile" icon={User} iconTone="blue" />
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load profile"
          message={error}
          action="Retry"
          onAction={() => fetchForm({ refresh: true })}
        />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <TenantPageHeader title="My Profile" icon={User} iconTone="blue" />
        <EmptyState
          icon={User}
          title="No profile data"
          message="We couldn't find your profile information."
          action="Retry"
          onAction={() => fetchForm({ refresh: true })}
        />
      </Screen>
    );
  }

  const property = typeof profile.propertyId === 'object' ? profile.propertyId : null;
  const room = typeof profile.roomId === 'object' ? profile.roomId : null;
  const bed = typeof profile.bedId === 'object' ? profile.bedId : null;
  const isRk = room?.type === 'RK' || room?.sharingType === 'RK' || ['RK', 'Flat'].includes(property?.type);
  const fullName = profile.fullName || storedUser?.name || 'Tenant';
  const email = profile.email || storedUser?.email || '';
  const phone = profile.phone || storedUser?.phone || '';
  const initial = (fullName?.[0] || email?.[0] || 'T').toUpperCase();

  const v = profile.aadhaarVerification || {};
  const isVerified = v.verified === true || v.status === 'verified';
  const aadhaarPhone = profile.aadhaarLinkedPhone || v.phone || '';

  const edu = profile.education || {};
  const eduLevelLabel = EDUCATION_LEVELS.find((l) => l.value === edu.level)?.label || edu.level;

  const emp = profile.employment || {};
  const empStatusLabel = EMPLOYMENT_STATUSES.find((s) => s.value === emp.status)?.label || emp.status;

  const bank = profile.bankDetails || {};
  const signatureUrl = resolveMediaUrl(profile.signatureUrl);

  const propertyPlan = profile?.propertyId?.plan || profile?.property?.plan || 'free';
  const isBasicPlan = propertyPlan === 'basic';

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => fetchForm({ refresh: true })}
      scrollRef={scrollRef}
    >
      <View style={styles.container}>
        {/* Page Header */}
        <TenantPageHeader
          title="My Profile"
          subtitle="Manage your personal details, emergency contacts, education, employment, bank details, and KYC in one place."
          icon={User}
          iconTone="blue"
        />

        {/* Global Action Bar */}
        <View style={[styles.actionBar, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleToggleEditAll}
            style={[
              styles.actionBtn,
              isAnyEditing ? styles.actionBtnSecondary : styles.actionBtnPrimary,
              { borderColor: isAnyEditing ? colors.border : '#2563eb' }
            ]}
          >
            {isAnyEditing ? (
              <>
                <RotateCcw size={14} color={colors.textPrimary} />
                <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Cancel Edits</Text>
              </>
            ) : (
              <>
                <Edit3 size={14} color="#ffffff" />
                <Text style={[styles.actionBtnText, { color: '#ffffff', fontWeight: '700' }]}>Edit All Details</Text>
              </>
            )}
          </TouchableOpacity>

          {isAnyEditing && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSaveAll}
              disabled={saving.all}
              style={[styles.actionBtn, styles.actionBtnSuccess]}
            >
              <Save size={14} color="#ffffff" />
              <Text style={[styles.actionBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                {saving.all ? 'Saving...' : 'Save All'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => fetchForm({ refresh: true })}
            style={[styles.actionBtn, { borderColor: colors.border }]}
          >
            <RefreshCw size={14} color={colors.textSecondary} />
            <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSignOut}
            style={[styles.actionBtn, styles.actionBtnDanger]}
          >
            <LogOut size={14} color={COLORS.danger} />
            <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Global Feedback Messages */}
        {saveSuccess.all ? (
          <View style={[styles.banner, styles.bannerSuccess]}>
            <CheckCircle2 size={16} color={COLORS.success} />
            <Text style={styles.bannerSuccessText}>{saveSuccess.all}</Text>
          </View>
        ) : null}

        {saveError.all ? (
          <View style={[styles.banner, styles.bannerDanger]}>
            <AlertTriangle size={16} color={COLORS.danger} />
            <Text style={styles.bannerDangerText}>{saveError.all}</Text>
          </View>
        ) : null}

        {/* Hero Overview & Tenancy Card */}
        <Card style={styles.heroCard} padded={false}>
          <View style={[styles.heroHeader, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#f0f7ff' }]}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
              <View style={styles.activeDot} />
            </View>

            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={[styles.heroName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {fullName}
                </Text>
                <Badge
                  label={(profile.status || 'active').replace('_', ' ')}
                  color={profile.status === 'active' ? COLORS.success : COLORS.warning}
                />
              </View>

              <View style={styles.statusChipsRow}>
                {form?.profileCompleted ? (
                  <View style={[styles.microChip, styles.microChipSuccess]}>
                    <FileCheck size={11} color={COLORS.success} />
                    <Text style={styles.microChipSuccessText}>Profile complete</Text>
                  </View>
                ) : (
                  <View style={[styles.microChip, styles.microChipWarning]}>
                    <AlertTriangle size={11} color={COLORS.warning} />
                    <Text style={styles.microChipWarningText}>Incomplete profile</Text>
                  </View>
                )}
                {profile.gender ? (
                  <View style={[styles.microChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }]}>
                    <Text style={[styles.microChipText, { color: colors.textSecondary }]}>
                      {profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.contactItemsWrap}>
                {email ? (
                  <View style={styles.contactItem}>
                    <Mail size={12} color={colors.textTertiary} />
                    <Text style={[styles.contactText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {email}
                    </Text>
                  </View>
                ) : null}

                {phone ? (
                  <View style={styles.contactItem}>
                    <Phone size={12} color="#3b82f6" />
                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>{phone}</Text>
                    <View style={styles.loginPill}>
                      <Text style={styles.loginPillText}>Login</Text>
                    </View>
                  </View>
                ) : null}

                {aadhaarPhone ? (
                  <View style={styles.contactItem}>
                    <ShieldCheck size={12} color={COLORS.success} />
                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>{aadhaarPhone}</Text>
                    <View style={styles.aadhaarPill}>
                      <Text style={styles.aadhaarPillText}>Aadhaar Linked</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* 4-Stat Tenancy Grid */}
          <View style={[styles.tenancyGrid, { borderTopColor: colors.border, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#ffffff' }]}>
            <TenancyStat label="Property" value={property?.name || '—'} sub={property?.city} />
            <TenancyStat
              label="Room"
              value={room?.roomNumber ? `Room ${room.roomNumber}` : '—'}
              sub={room?.type || room?.floor ? `Floor ${room.floor ?? ''}` : null}
            />
            <TenancyStat
              label="Bed"
              value={isRk ? 'Shared' : formatBedNumber(bed?.bedNumber, room?.roomNumber)}
              sub={bed?.bedNumber ? `Bed ${bed.bedNumber}` : null}
            />
            <TenancyStat
              label="Monthly Rent"
              value={formatCurrency(profile.monthlyRent)}
              sub={profile.moveInDate ? `Moved in ${formatDate(profile.moveInDate)}` : null}
            />
          </View>

          {/* Profile Progress Bar */}
          <View style={[styles.progressSection, { borderTopColor: colors.border, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc' }]}>
            <View style={styles.progressHeaderRow}>
              <Text style={[styles.progressLabel, { color: colors.textPrimary }]}>Profile completion status</Text>
              <Text style={[styles.progressValue, { color: colors.textSecondary }]}>
                {progress.filled} / {progress.total} fields completed ({progress.percent}%)
              </Text>
            </View>
            <ProgressBar
              value={progress.percent}
              color={progress.percent >= 100 ? COLORS.success : progress.percent >= 60 ? '#2563eb' : COLORS.warning}
            />
            {progress.percent < 100 && (
              <Text style={[styles.progressHint, { color: colors.textTertiary }]}>
                Complete all sections below to ensure seamless rent agreements, deposit refunds, and verification.
              </Text>
            )}
          </View>
        </Card>

        {/* Section Jump Nav Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navChipsContainer}>
          {SECTION_NAV.map((sec) => {
            const Icon = sec.icon;
            const isSelected = activeSection === sec.key;
            return (
              <TouchableOpacity
                key={sec.key}
                activeOpacity={0.7}
                onPress={() => scrollToSection(sec.key)}
                style={[
                  styles.navChip,
                  {
                    backgroundColor: isSelected ? '#2563eb' : isDark ? colors.card : '#ffffff',
                    borderColor: isSelected ? '#2563eb' : colors.border,
                  },
                ]}
              >
                <Icon size={13} color={isSelected ? '#ffffff' : colors.textSecondary} />
                <Text
                  style={[
                    styles.navChipText,
                    {
                      color: isSelected ? '#ffffff' : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {sec.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 1. PERSONAL DETAILS (READ-ONLY / SYNCED FROM AADHAAR) */}
        <View onLayout={(e) => onSectionLayout('personal', e)}>
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff' }]}>
                  <User size={18} color="#2563eb" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personal Details</Text>
                  <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                    Official identification and registered contact details
                  </Text>
                </View>
              </View>
              {isVerified ? (
                <View style={[styles.statusBadge, styles.badgeVerified]}>
                  <ShieldCheck size={13} color={COLORS.success} />
                  <Text style={styles.badgeVerifiedText}>Verified via Aadhaar</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, styles.badgeReadOnly]}>
                  <Lock size={12} color={colors.textTertiary} />
                  <Text style={[styles.badgeReadOnlyText, { color: colors.textSecondary }]}>Onboarding Record (Read-Only)</Text>
                </View>
              )}
            </View>

            {/* Information Notice Banner */}
            {isVerified ? (
              <View style={[styles.infoBanner, styles.infoBannerVerified]}>
                <ShieldCheck size={16} color={COLORS.success} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoBannerTitleVerified}>Official Government Verified Details</Text>
                  <Text style={styles.infoBannerSubVerified}>
                    Your personal details are fetched directly from your verified Aadhaar card. For security and compliance, these official records cannot be manually altered.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.infoBanner, styles.infoBannerWarning]}>
                <Lock size={16} color={COLORS.warning} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoBannerTitleWarning}>Onboarding Record (Unverified)</Text>
                  <Text style={styles.infoBannerSubWarning}>
                    These personal details were recorded by your property owner during onboarding. Once your Aadhaar verification is completed, details will be synchronized directly from official Aadhaar records.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.detailGrid}>
              <DetailRow label="Full Legal Name" value={profile.fullName} icon={User} badge={isVerified ? "Verified" : "Onboarding"} />
              <DetailRow label="Primary Mobile (Login)" value={profile.phone} icon={Phone} badge="Login & OTP" subtext="Registered for account login & OTPs" />
              <DetailRow
                label="Aadhaar Linked Mobile"
                value={aadhaarPhone || (isVerified ? 'Not linked on card' : 'Pending Aadhaar verification')}
                icon={ShieldCheck}
                badge={aadhaarPhone ? "Aadhaar Linked" : undefined}
                subtext="Mobile linked with UIDAI Aadhaar record"
              />
              <DetailRow label="Email Address" value={profile.email} icon={Mail} />
              <DetailRow label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : ''} />
              <DetailRow label="Date of Birth" value={formatDate(profile.dateOfBirth)} icon={Calendar} />
              <DetailRow label="Permanent Address" value={profile.permanentAddress} icon={MapPin} />
            </View>
          </Card>
        </View>

        {/* 2. FAMILY & EMERGENCY CONTACTS */}
        <View onLayout={(e) => onSectionLayout('family', e)}>
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: isDark ? 'rgba(225,29,72,0.2)' : '#ffe4e6' }]}>
                  <Heart size={18} color="#e11d48" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Family & Emergency Contacts</Text>
                  <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                    Contacts used in case of medical emergencies or urgent hostel notices
                  </Text>
                </View>
              </View>

              {editing.family ? (
                <View style={styles.editActionRow}>
                  <TouchableOpacity
                    onPress={() => handleCancel('family')}
                    disabled={saving.family}
                    style={[styles.smallBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSave('family')}
                    disabled={saving.family}
                    style={[styles.smallBtn, styles.smallBtnPrimary]}
                  >
                    <Save size={13} color="#ffffff" />
                    <Text style={[styles.smallBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                      {saving.family ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleEdit('family')}
                  style={[styles.smallBtn, { borderColor: colors.border }]}
                >
                  <Edit3 size={13} color={colors.textPrimary} />
                  <Text style={[styles.smallBtnText, { color: colors.textPrimary }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {editing.family ? (
              <View style={styles.formContainer}>
                <Text style={[styles.subGroupHeading, { color: colors.textTertiary }]}>Father / Guardian</Text>
                <TextField
                  label="Father's / Guardian's Name"
                  value={draft.fatherName}
                  onChangeText={(v) => updateDraftField('fatherName', v)}
                  placeholder="Full name"
                />
                <TextField
                  label="Father's / Guardian's Phone"
                  value={draft.fatherPhone}
                  onChangeText={(v) => updateDraftField('fatherPhone', v)}
                  keyboardType="phone-pad"
                  placeholder="10-digit phone"
                  maxLength={10}
                />

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text style={[styles.subGroupHeading, { color: colors.textTertiary }]}>Emergency Contact (Alternative)</Text>
                <TextField
                  label="Contact Person Name"
                  value={draft.emergencyContactName}
                  onChangeText={(v) => updateDraftField('emergencyContactName', v)}
                  placeholder="Name of friend / relative"
                />
                <TextField
                  label="Emergency Phone"
                  value={draft.emergencyContactPhone}
                  onChangeText={(v) => updateDraftField('emergencyContactPhone', v)}
                  keyboardType="phone-pad"
                  placeholder="10-digit phone"
                  maxLength={10}
                  helper="Person to contact immediately if your primary guardian cannot be reached."
                />

                <SectionActionFooter
                  saving={saving.family}
                  onSave={() => handleSave('family')}
                  onCancel={() => handleCancel('family')}
                />
              </View>
            ) : (
              <View style={styles.detailGrid}>
                <Text style={[styles.subGroupHeading, { color: colors.textTertiary }]}>Father / Guardian</Text>
                <DetailRow label="Father / Guardian Name" value={profile.fatherName} icon={User} />
                <DetailRow label="Father / Guardian Phone" value={profile.fatherPhone} icon={Phone} />

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text style={[styles.subGroupHeading, { color: colors.textTertiary }]}>Emergency Contact</Text>
                <DetailRow label="Emergency Contact Name" value={profile.emergencyContactName} icon={Users} />
                <DetailRow label="Emergency Contact Phone" value={profile.emergencyContactPhone} icon={Phone} />
              </View>
            )}

            <SectionFeedback error={saveError.family} success={saveSuccess.family} />
          </Card>
        </View>

        {/* 3. EDUCATION */}
        <View onLayout={(e) => onSectionLayout('education', e)}>
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: isDark ? 'rgba(217,119,6,0.2)' : '#fef3c7' }]}>
                  <GraduationCap size={18} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Education</Text>
                  <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                    Details of your college, university, or current academic degree
                  </Text>
                </View>
              </View>

              {editing.education ? (
                <View style={styles.editActionRow}>
                  <TouchableOpacity
                    onPress={() => handleCancel('education')}
                    disabled={saving.education}
                    style={[styles.smallBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSave('education')}
                    disabled={saving.education}
                    style={[styles.smallBtn, styles.smallBtnPrimary]}
                  >
                    <Save size={13} color="#ffffff" />
                    <Text style={[styles.smallBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                      {saving.education ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleEdit('education')}
                  style={[styles.smallBtn, { borderColor: colors.border }]}
                >
                  <Edit3 size={13} color={colors.textPrimary} />
                  <Text style={[styles.smallBtnText, { color: colors.textPrimary }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {editing.education ? (
              <View style={styles.formContainer}>
                <TextField
                  label="College / Institution / University"
                  value={draft.institution}
                  onChangeText={(v) => updateDraftField('institution', v)}
                  placeholder="e.g. Indian Institute of Technology Bombay"
                />
                <SelectField
                  label="Education Level"
                  value={draft.level}
                  options={EDUCATION_LEVELS}
                  onSelect={(v) => updateDraftField('level', v)}
                  placeholder="Select level"
                />
                <TextField
                  label="Course / Degree"
                  value={draft.course}
                  onChangeText={(v) => updateDraftField('course', v)}
                  placeholder="e.g. B.Tech Computer Science"
                />
                <TextField
                  label="Year of Study"
                  value={draft.yearOfStudy}
                  onChangeText={(v) => updateDraftField('yearOfStudy', v)}
                  placeholder="e.g. 2nd Year / 2026 Batch"
                />
                <TextField
                  label="College City"
                  value={draft.city}
                  onChangeText={(v) => updateDraftField('city', v)}
                  placeholder="e.g. Mumbai"
                />

                <SectionActionFooter
                  saving={saving.education}
                  onSave={() => handleSave('education')}
                  onCancel={() => handleCancel('education')}
                />
              </View>
            ) : (
              <View style={styles.detailGrid}>
                <DetailRow label="Institution / College" value={edu.institution} icon={Building2} />
                <DetailRow label="Level" value={eduLevelLabel} />
                <DetailRow label="Course / Degree" value={edu.course} />
                <DetailRow label="Year of Study" value={edu.yearOfStudy} />
                <DetailRow label="College City" value={edu.city} icon={MapPin} />
              </View>
            )}

            <SectionFeedback error={saveError.education} success={saveSuccess.education} />
          </Card>
        </View>

        {/* 4. EMPLOYMENT & OCCUPATION */}
        <View onLayout={(e) => onSectionLayout('employment', e)}>
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: isDark ? 'rgba(13,148,136,0.2)' : '#ccfbf1' }]}>
                  <Briefcase size={18} color="#0d9488" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Employment & Income</Text>
                  <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                    Your current professional status, company, and monthly income
                  </Text>
                </View>
              </View>

              {editing.employment ? (
                <View style={styles.editActionRow}>
                  <TouchableOpacity
                    onPress={() => handleCancel('employment')}
                    disabled={saving.employment}
                    style={[styles.smallBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSave('employment')}
                    disabled={saving.employment}
                    style={[styles.smallBtn, styles.smallBtnPrimary]}
                  >
                    <Save size={13} color="#ffffff" />
                    <Text style={[styles.smallBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                      {saving.employment ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleEdit('employment')}
                  style={[styles.smallBtn, { borderColor: colors.border }]}
                >
                  <Edit3 size={13} color={colors.textPrimary} />
                  <Text style={[styles.smallBtnText, { color: colors.textPrimary }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {editing.employment ? (
              <View style={styles.formContainer}>
                <SelectField
                  label="Employment Status"
                  value={draft.employmentStatus}
                  options={EMPLOYMENT_STATUSES}
                  onSelect={(v) => updateDraftField('employmentStatus', v)}
                  placeholder="Select status"
                />
                <TextField
                  label="Company / Employer"
                  value={draft.company}
                  onChangeText={(v) => updateDraftField('company', v)}
                  placeholder="e.g. Infosys / Self-employed"
                />
                <TextField
                  label="Designation / Job Role"
                  value={draft.designation}
                  onChangeText={(v) => updateDraftField('designation', v)}
                  placeholder="e.g. Software Engineer"
                />
                <TextField
                  label="Workplace City"
                  value={draft.workCity}
                  onChangeText={(v) => updateDraftField('workCity', v)}
                  placeholder="e.g. Bengaluru"
                />
                <TextField
                  label="Monthly Income (₹)"
                  value={draft.monthlyIncome}
                  onChangeText={(v) => updateDraftField('monthlyIncome', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 50000"
                />

                <SectionActionFooter
                  saving={saving.employment}
                  onSave={() => handleSave('employment')}
                  onCancel={() => handleCancel('employment')}
                />
              </View>
            ) : (
              <View style={styles.detailGrid}>
                <DetailRow label="Employment Status" value={empStatusLabel} />
                <DetailRow label="Company / Employer" value={emp.company} icon={Building2} />
                <DetailRow label="Designation" value={emp.designation} />
                <DetailRow label="Work City" value={emp.workCity} icon={MapPin} />
                <DetailRow
                  label="Monthly Income"
                  value={emp.monthlyIncome !== null && emp.monthlyIncome !== undefined ? formatCurrency(emp.monthlyIncome) : ''}
                  icon={Banknote}
                />
              </View>
            )}

            <SectionFeedback error={saveError.employment} success={saveSuccess.employment} />
          </Card>
        </View>

        {/* 5. BANK & REFUND DETAILS */}
        <View onLayout={(e) => onSectionLayout('bank', e)}>
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: isDark ? 'rgba(5,150,105,0.2)' : '#dcfce7' }]}>
                  <Banknote size={18} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bank & Refund Account</Text>
                  <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                    Bank account details where your security deposit will be refunded when checking out
                  </Text>
                </View>
              </View>

              {editing.bank ? (
                <View style={styles.editActionRow}>
                  <TouchableOpacity
                    onPress={() => handleCancel('bank')}
                    disabled={saving.bank}
                    style={[styles.smallBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSave('bank')}
                    disabled={saving.bank}
                    style={[styles.smallBtn, styles.smallBtnPrimary]}
                  >
                    <Save size={13} color="#ffffff" />
                    <Text style={[styles.smallBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                      {saving.bank ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleEdit('bank')}
                  style={[styles.smallBtn, { borderColor: colors.border }]}
                >
                  <Edit3 size={13} color={colors.textPrimary} />
                  <Text style={[styles.smallBtnText, { color: colors.textPrimary }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Privacy notice banner */}
            <View style={[styles.infoBanner, { backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff', borderColor: 'rgba(37,99,235,0.25)' }]}>
              <Lock size={15} color="#2563eb" style={{ marginTop: 1 }} />
              <Text style={[styles.infoBannerSubVerified, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
                Your bank details are securely stored and strictly used for returning your security deposit at the end of your stay. For privacy, your property manager will only see the last 4 digits of your account number.
              </Text>
            </View>

            {editing.bank ? (
              <View style={styles.formContainer}>
                <TextField
                  label="Account Holder Name"
                  value={draft.accountHolderName}
                  onChangeText={(v) => updateDraftField('accountHolderName', v)}
                  placeholder="As printed on bank passbook"
                  required
                />
                <TextField
                  label="Account Number"
                  value={draft.accountNumber}
                  onChangeText={(v) => updateDraftField('accountNumber', v)}
                  keyboardType="numeric"
                  placeholder="9 to 18 digit account number"
                  required
                />
                <TextField
                  label="IFSC Code"
                  value={draft.ifsc}
                  onChangeText={(v) => updateDraftField('ifsc', v.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="e.g. HDFC0001234"
                  maxLength={11}
                  required
                />
                <TextField
                  label="Bank Name"
                  value={draft.bankName}
                  onChangeText={(v) => updateDraftField('bankName', v)}
                  placeholder="e.g. HDFC Bank"
                />
                <TextField
                  label="Branch Name"
                  value={draft.branch}
                  onChangeText={(v) => updateDraftField('branch', v)}
                  placeholder="e.g. Koramangala Branch"
                />
                <TextField
                  label="UPI ID (Optional)"
                  value={draft.upiId}
                  onChangeText={(v) => updateDraftField('upiId', v)}
                  autoCapitalize="none"
                  placeholder="e.g. rahul@okaxis"
                />

                <SectionActionFooter
                  saving={saving.bank}
                  onSave={() => handleSave('bank')}
                  onCancel={() => handleCancel('bank')}
                />
              </View>
            ) : (
              <View style={styles.detailGrid}>
                <DetailRow label="Account Holder" value={bank.accountHolderName} icon={User} />
                <DetailRow
                  label="Account Number"
                  value={bank.accountNumber ? `•••• •••• ${String(bank.accountNumber).slice(-4)}` : ''}
                  icon={Lock}
                  mono
                />
                <DetailRow label="IFSC Code" value={bank.ifsc} mono />
                <DetailRow label="Bank Name" value={bank.bankName} icon={Building2} />
                <DetailRow label="Branch" value={bank.branch} />
                <DetailRow label="UPI ID" value={bank.upiId} />
              </View>
            )}

            <SectionFeedback error={saveError.bank} success={saveSuccess.bank} />
          </Card>
        </View>

        {/* 6. AADHAAR & KYC */}
        <View onLayout={(e) => onSectionLayout('kyc', e)}>
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: isDark ? 'rgba(124,58,237,0.2)' : '#f5f3ff' }]}>
                  <IdCard size={18} color="#7c3aed" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Aadhaar & KYC Verification</Text>
                  <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                    Government identity verification for police verification and rent agreement
                  </Text>
                </View>
              </View>

              {!isVerified ? (
                editing.kyc ? (
                  <View style={styles.editActionRow}>
                    <TouchableOpacity
                      onPress={() => handleCancel('kyc')}
                      disabled={saving.kyc}
                      style={[styles.smallBtn, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleSave('kyc')}
                      disabled={saving.kyc}
                      style={[styles.smallBtn, styles.smallBtnPrimary]}
                    >
                      <Save size={13} color="#ffffff" />
                      <Text style={[styles.smallBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                        {saving.kyc ? 'Saving...' : 'Save Aadhaar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleEdit('kyc')}
                    style={[styles.smallBtn, { borderColor: colors.border }]}
                  >
                    <Edit3 size={13} color={colors.textPrimary} />
                    <Text style={[styles.smallBtnText, { color: colors.textPrimary }]}>Edit Aadhaar</Text>
                  </TouchableOpacity>
                )
              ) : null}
            </View>

            {editing.kyc && !isVerified ? (
              <View style={[styles.editAadhaarBox, { backgroundColor: isDark ? colors.cardSecondary : '#f8fafc', borderColor: colors.border }]}>
                <TextField
                  label="12-digit Aadhaar Number"
                  value={draft.aadhaarNumber}
                  onChangeText={(v) => updateDraftField('aadhaarNumber', v.replace(/\D/g, '').slice(0, 12))}
                  keyboardType="numeric"
                  placeholder="Enter 12 digits"
                  maxLength={12}
                  helper={
                    'Entering your Aadhaar number manually saves it to your tenancy file.' +
                    (isBasicPlan ? ' You can also verify directly using DigiLocker below.' : '')
                  }
                />
                <View style={styles.formActionFooter}>
                  <TouchableOpacity
                    onPress={() => handleCancel('kyc')}
                    disabled={saving.kyc}
                    style={[styles.smallBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSave('kyc')}
                    disabled={saving.kyc}
                    style={[styles.smallBtn, styles.smallBtnPrimary]}
                  >
                    <Save size={13} color="#ffffff" />
                    <Text style={[styles.smallBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                      {saving.kyc ? 'Saving...' : 'Save Number'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* KYC Details (mirrors web KycDetails) */}
            <KycDetailsView
              title="Aadhaar KYC Status"
              kyc={{
                aadhaarNumber: profile.aadhaarNumber,
                aadhaarFront: resolveMediaUrl(profile.aadhaarFront),
                aadhaarBack: resolveMediaUrl(profile.aadhaarBack),
                verification: profile.aadhaarVerification,
              }}
              onOpenPhoto={(url, label) => setLightbox({ url, label })}
            />

            {/* Aadhaar Document Photos Preview (only when at least one exists, like web) */}
            {profile.aadhaarFront || profile.aadhaarBack ? (
              <View style={[styles.docsRow, { borderTopColor: colors.border }]}>
                <DocumentPhotoCard
                  label="Aadhaar Front Photo"
                  url={resolveMediaUrl(profile.aadhaarFront)}
                  onOpen={(url, label) => setLightbox({ url, label })}
                />
                <DocumentPhotoCard
                  label="Aadhaar Back Photo"
                  url={resolveMediaUrl(profile.aadhaarBack)}
                  onOpen={(url, label) => setLightbox({ url, label })}
                />
              </View>
            ) : null}

            {/* DigiLocker verify card only if property has Basic plan and not yet verified */}
            {!isVerified && isBasicPlan ? (
              <View style={styles.dlWrapper}>
                <DigiLockerVerifyCard
                  initialAadhaar={profile?.aadhaarNumber || ''}
                  onVerified={() => fetchForm({ refresh: true })}
                />
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/more/documents')}
              style={[styles.viewDocsBtn, { borderColor: colors.border }]}
            >
              <FileText size={15} color="#2563eb" />
              <Text style={styles.viewDocsBtnText}>View All Tenancy Documents</Text>
              <ArrowRight size={14} color="#2563eb" />
            </TouchableOpacity>

            <SectionFeedback error={saveError.kyc} success={saveSuccess.kyc} />
          </Card>
        </View>

        {/* 7. DIGITAL SIGNATURE */}
        <View onLayout={(e) => onSectionLayout('signature', e)}>
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: isDark ? 'rgba(225,29,72,0.2)' : '#ffe4e6' }]}>
                  <PenLine size={18} color="#e11d48" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Digital Signature</Text>
                  <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                    Your signature is placed on your official digital rent agreement and move-in inventory
                  </Text>
                </View>
              </View>
            </View>

            {signatureUrl ? (
              <View style={[styles.sigStatusBanner, styles.sigStatusBannerSuccess]}>
                <View style={styles.sigStatusTextWrap}>
                  <CheckCircle2 size={16} color={COLORS.success} />
                  <View>
                    <Text style={styles.sigStatusTitle}>Digital signature on file</Text>
                    <Text style={styles.sigStatusSub}>
                      {profile.signatureUpdatedAt
                        ? `Last updated ${formatDate(profile.signatureUpdatedAt)}`
                        : 'Ready for rent agreement signing'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setLightbox({ url: signatureUrl, label: 'Digital Signature' })}
                  style={styles.sigThumbBox}
                >
                  <Image source={{ uri: signatureUrl }} style={styles.sigThumbImg} resizeMode="contain" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.sigStatusBanner, styles.sigStatusBannerWarning]}>
                <AlertTriangle size={15} color={COLORS.warning} style={{ marginTop: 1 }} />
                <Text style={styles.sigStatusWarningText}>
                  You haven't added a signature yet. Please sign in the box below to complete your profile.
                </Text>
              </View>
            )}

            {/* Draw or upload your signature */}
            <View style={styles.sigPadContainer}>
              <View style={styles.sigPadLabelRow}>
                <Text style={[styles.sigPadLabel, { color: colors.textSecondary }]}>
                  Draw or upload your signature
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setDrawModalOpen(true)}
                  style={styles.sigPadDrawBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <PenLine size={13} color="#2563eb" />
                  <Text style={styles.sigPadDrawBtnText}>{signatureData ? 'Draw new' : 'Draw'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setDrawModalOpen(true)}
                style={[styles.sigPadBox, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff' }]}
              >
                {signatureData ? (
                  <Image source={{ uri: signatureData }} style={styles.sigPadPreviewImg} resizeMode="contain" />
                ) : (
                  <View style={styles.sigPadPlaceholder}>
                    <PenLine size={16} color={colors.textTertiary} />
                    <Text style={[styles.sigPadPlaceholderText, { color: colors.textTertiary }]}>Sign here</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={[styles.sigPadHint, { color: colors.textTertiary }]}>
                Sign neatly inside the canvas or upload an image file of your signature. Click 'Save Signature' when done.
              </Text>
            </View>

            <View style={styles.sigUploadContainer}>
              <ImageKitUploader
                folder="/tenants/signatures"
                label="Upload or Photograph Signature"
                value={signatureInput}
                onChange={setSignatureInput}
              />
            </View>

            {signatureError ? (
              <View style={[styles.banner, styles.bannerDanger, { marginTop: SPACING.sm }]}>
                <AlertTriangle size={15} color={COLORS.danger} />
                <Text style={styles.bannerDangerText}>{signatureError}</Text>
              </View>
            ) : null}

            {signatureSaved ? (
              <View style={[styles.banner, styles.bannerSuccess, { marginTop: SPACING.sm }]}>
                <CheckCircle2 size={15} color={COLORS.success} />
                <Text style={styles.bannerSuccessText}>Signature saved successfully!</Text>
              </View>
            ) : null}

            <Button
              title={signatureSaving ? 'Saving Signature...' : 'Save Signature'}
              icon={Save}
              onPress={handleSaveSignature}
              loading={signatureSaving}
              disabled={(!signatureData && !signatureInput.trim()) || signatureSaving}
              fullWidth
              style={{ marginTop: SPACING.md }}
            />
          </Card>
        </View>

        {/* 8. ACCOUNT & SESSION */}
        <View onLayout={(e) => onSectionLayout('session', e)}>
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2' }]}>
                  <LogOut size={18} color={COLORS.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account & Session</Text>
                  <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                    Manage your current login session
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionName, { color: colors.textPrimary }]}>
                  Signed in as <Text style={{ fontWeight: '700' }}>{fullName}</Text>
                </Text>
                <Text style={[styles.sessionSub, { color: colors.textSecondary }]}>
                  {phone || email || ''}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSignOut}
                style={[styles.smallBtn, styles.smallBtnDanger]}
              >
                <LogOut size={14} color={COLORS.danger} />
                <Text style={[styles.smallBtnText, { color: COLORS.danger, fontWeight: '700' }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </View>

      {/* Document Lightbox Modal */}
      {lightbox && (
        <Modal
          visible={!!lightbox}
          transparent
          animationType="fade"
          onRequestClose={() => setLightbox(null)}
        >
          <View style={styles.lightboxOverlay}>
            <View style={styles.lightboxHeader}>
              <Text style={styles.lightboxTitle} numberOfLines={1}>{lightbox.label}</Text>
              <TouchableOpacity
                onPress={() => setLightbox(null)}
                style={styles.lightboxCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.lightboxBody}>
              <Image
                source={{ uri: lightbox.url }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Draw Signature Modal (react-native-signature-canvas renders inside a WebView) */}
      <Modal
        visible={drawModalOpen}
        animationType="slide"
        onRequestClose={() => setDrawModalOpen(false)}
      >
        <View style={styles.sigDrawModalContainer}>
          <View style={styles.sigDrawModalHeader}>
            <Text style={styles.sigDrawModalTitle}>Draw your signature</Text>
            <TouchableOpacity
              onPress={() => setDrawModalOpen(false)}
              style={styles.sigDrawModalCloseBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View style={styles.sigDrawCanvasWrap}>
            <Signature
              onOK={(data) => {
                if (data) setSignatureData(`data:image/png;base64,${data}`);
                setSignatureError('');
                setDrawModalOpen(false);
              }}
              onEmpty={() => {}}
              clearText="Clear"
              confirmText="Save"
              webStyle={SIGNATURE_WEB_STYLE}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

// ── Components ──────────────────────────────────────────────

function DetailRow({ label, value, icon: Icon, mono = false, badge, emptyText = 'Not provided', subtext }) {
  const { colors, isDark } = useTheme();
  const isFilled = Boolean(value && value !== '—');

  return (
    <View style={[styles.detailRowCard, { backgroundColor: isDark ? colors.cardSecondary : '#f8fafc', borderColor: colors.border }]}>
      <View style={styles.detailRowHeader}>
        <View style={styles.detailRowLabelWrap}>
          {Icon ? <Icon size={12} color={colors.textTertiary} /> : null}
          <Text style={[styles.detailRowLabel, { color: colors.textTertiary }]}>{label}</Text>
        </View>
        {badge ? (
          <View style={styles.detailRowBadge}>
            <Text style={styles.detailRowBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[
          styles.detailRowValue,
          { color: isFilled ? colors.textPrimary : colors.textTertiary },
          !isFilled && styles.italic,
          mono && styles.monoText,
        ]}
      >
        {isFilled ? value : emptyText}
      </Text>
      {subtext ? (
        <Text style={[styles.detailRowSubtext, { color: colors.textTertiary }]}>{subtext}</Text>
      ) : null}
    </View>
  );
}

function TenancyStat({ label, value, sub }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statBoxLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.statBoxValue, { color: colors.textPrimary }]} numberOfLines={1}>
        {value || '—'}
      </Text>
      {sub ? (
        <Text style={[styles.statBoxSub, { color: colors.textTertiary }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function KycDetailsView({ title = 'Aadhaar KYC Status', kyc, onOpenPhoto }) {
  const { colors, isDark } = useTheme();
  const aadhaarNumber = kyc?.aadhaarNumber;
  const isVerified = Boolean(
    kyc?.verification?.status === 'verified' ||
    kyc?.verification?.verified ||
    kyc?.verification?.isVerified
  );

  return (
    <View style={[styles.kycCardBox, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }]}>
      <View style={styles.kycStatusHeader}>
        <View style={styles.kycStatusLeft}>
          <ShieldCheck size={18} color={isVerified ? '#059669' : '#f59e0b'} />
          <Text style={[styles.kycStatusTitle, { color: colors.textPrimary }]}>{title}</Text>
        </View>
        <Badge
          label={isVerified ? 'VERIFIED' : 'PENDING'}
          color={isVerified ? COLORS.success : COLORS.warning}
        />
      </View>

      <View style={styles.kycDetailRow}>
        <Text style={[styles.kycDetailLabel, { color: colors.textSecondary }]}>Aadhaar Number:</Text>
        <Text style={[styles.kycDetailValue, { color: colors.textPrimary }]}>
          {aadhaarNumber ? maskAadhaar(aadhaarNumber) : 'Not provided'}
        </Text>
      </View>

      {kyc?.verification?.verifiedAt ? (
        <View style={styles.kycDetailRow}>
          <Text style={[styles.kycDetailLabel, { color: colors.textSecondary }]}>Verified On:</Text>
          <Text style={[styles.kycDetailValue, { color: colors.textPrimary }]}>
            {formatDate(kyc.verification.verifiedAt)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DigiLockerVerifyCard({ initialAadhaar, onVerified }) {
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const startVerification = async () => {
    setLoading(true);
    try {
      const res = await kycInit({ aadhaarNumber: initialAadhaar ? String(initialAadhaar).replace(/\D/g, '') : undefined });
      const url = res?.url || res?.data?.url || res?.redirectUrl;
      if (url) {
        await Linking.openURL(url);
        toast.info('Complete verification in your browser and return to Pantro');
      } else {
        toast.error('Verification service unavailable. Please contact manager.');
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.dlCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(37,99,235,0.08)' : '#eff6ff' }]}>
      <View style={styles.dlHead}>
        <Sparkles size={16} color="#2563eb" />
        <Text style={[styles.dlTitle, { color: colors.textPrimary }]}>Instant DigiLocker Verification</Text>
      </View>
      <Text style={[styles.dlSub, { color: colors.textSecondary }]}>
        Verify your Aadhaar record instantly via official government DigiLocker.
      </Text>
      <TouchableOpacity
        style={[styles.smallBtn, styles.smallBtnPrimary, { alignSelf: 'flex-start', marginTop: SPACING.xs }]}
        onPress={startVerification}
        disabled={loading}
      >
        <ShieldCheck size={14} color="#ffffff" />
        <Text style={[styles.smallBtnText, { color: '#ffffff', fontWeight: '700' }]}>
          {loading ? 'Opening DigiLocker...' : 'Verify with DigiLocker'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function DocumentPhotoCard({ label, url, onOpen }) {
  const { colors, isDark } = useTheme();

  if (!url) {
    return (
      <View style={[styles.docPhotoCard, styles.docPhotoCardEmpty, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }]}>
        <FileText size={22} color={colors.textTertiary} />
        <Text style={[styles.docPhotoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.docPhotoSub, { color: colors.textTertiary }]}>Not uploaded</Text>
      </View>
    );
  }

  return (
    <View style={[styles.docPhotoCard, { borderColor: colors.border }]}>
      <Text style={[styles.docPhotoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onOpen(url, label)}
        style={styles.docPhotoThumbWrap}
      >
        <Image source={{ uri: url }} style={styles.docPhotoThumb} resizeMode="cover" />
        <View style={styles.docPhotoBar}>
          <ExternalLink size={11} color="#2563eb" />
          <Text style={styles.docPhotoBarText}>Tap to expand</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function SectionActionFooter({ saving, onSave, onCancel }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.formActionFooter, { borderTopColor: colors.border }]}>
      <TouchableOpacity
        onPress={onCancel}
        disabled={saving}
        style={[styles.smallBtn, { borderColor: colors.border }]}
      >
        <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        style={[styles.smallBtn, styles.smallBtnPrimary]}
      >
        <Save size={13} color="#ffffff" />
        <Text style={[styles.smallBtnText, { color: '#ffffff', fontWeight: '700' }]}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionFeedback({ error, success }) {
  if (error) {
    return (
      <View style={[styles.banner, styles.bannerDanger, { marginTop: SPACING.sm }]}>
        <AlertTriangle size={15} color={COLORS.danger} />
        <Text style={styles.bannerDangerText}>{error}</Text>
      </View>
    );
  }
  if (success) {
    return (
      <View style={[styles.banner, styles.bannerSuccess, { marginTop: SPACING.sm }]}>
        <CheckCircle2 size={15} color={COLORS.success} />
        <Text style={styles.bannerSuccessText}>{success}</Text>
      </View>
    );
  }
  return null;
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionBtnPrimary: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnSuccess: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  actionBtnDanger: {
    borderColor: 'rgba(225, 29, 72, 0.3)',
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
  },
  actionBtnText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  bannerSuccess: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderColor: 'rgba(5, 150, 105, 0.25)',
  },
  bannerSuccessText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: '#059669',
    fontWeight: '600',
  },
  bannerDanger: {
    backgroundColor: 'rgba(225, 29, 72, 0.1)',
    borderColor: 'rgba(225, 29, 72, 0.25)',
  },
  bannerDangerText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: '#e11d48',
    fontWeight: '600',
  },
  heroCard: {
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  heroName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statusChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  microChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  microChipSuccess: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.25)',
  },
  microChipSuccessText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },
  microChipWarning: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  microChipWarningText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.warning,
  },
  microChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  contactItemsWrap: {
    marginTop: 6,
    gap: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contactText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  loginPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  loginPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563eb',
  },
  aadhaarPill: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  aadhaarPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.success,
  },
  tenancyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
  },
  statBox: {
    width: '50%',
    padding: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statBoxValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  statBoxSub: {
    fontSize: 11,
    marginTop: 1,
  },
  progressSection: {
    padding: SPACING.md,
    borderTopWidth: 1,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  progressHint: {
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
  navChipsContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  navChipText: {
    fontSize: FONT_SIZES.xs,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flex: 1,
  },
  sectionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  editActionRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  smallBtnPrimary: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  smallBtnDanger: {
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
    borderColor: 'rgba(225, 29, 72, 0.25)',
  },
  smallBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  badgeVerified: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderColor: 'rgba(5, 150, 105, 0.25)',
  },
  badgeVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },
  badgeReadOnly: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeReadOnlyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  infoBannerVerified: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderColor: 'rgba(5, 150, 105, 0.25)',
  },
  infoBannerTitleVerified: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: '#059669',
  },
  infoBannerSubVerified: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
    lineHeight: 16,
  },
  infoBannerWarning: {
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  infoBannerTitleWarning: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: '#d97706',
  },
  infoBannerSubWarning: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 2,
    lineHeight: 16,
  },
  detailGrid: {
    gap: 8,
  },
  detailRowCard: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 3,
  },
  detailRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailRowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailRowLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRowBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  detailRowBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563eb',
  },
  detailRowValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  detailRowSubtext: {
    fontSize: 10,
    marginTop: 1,
  },
  italic: {
    fontStyle: 'italic',
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  subGroupHeading: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 4,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    marginVertical: 6,
  },
  formContainer: {
    gap: SPACING.xs,
  },
  formActionFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
    borderTopWidth: 1,
  },
  editAadhaarBox: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  kycCardBox: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  kycStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  kycStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kycStatusTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  kycDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  kycDetailLabel: {
    fontSize: FONT_SIZES.xs,
  },
  kycDetailValue: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  dlWrapper: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  dlCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },
  dlHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dlTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  dlSub: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
  },
  docsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
  },
  docPhotoCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.xs,
    overflow: 'hidden',
  },
  docPhotoCardEmpty: {
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: 4,
  },
  docPhotoLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  docPhotoSub: {
    fontSize: 10,
  },
  docPhotoThumbWrap: {
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  docPhotoThumb: {
    width: '100%',
    height: 90,
  },
  docPhotoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 3,
    backgroundColor: 'rgba(37,99,235,0.1)',
  },
  docPhotoBarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563eb',
  },
  viewDocsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  viewDocsBtnText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: '#2563eb',
  },
  sigStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  sigStatusBannerSuccess: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderColor: 'rgba(5, 150, 105, 0.25)',
  },
  sigStatusBannerWarning: {
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderColor: 'rgba(217, 119, 6, 0.25)',
    gap: SPACING.sm,
  },
  sigStatusTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  sigStatusTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: '#059669',
  },
  sigStatusSub: {
    fontSize: 10,
    color: '#047857',
    marginTop: 1,
  },
  sigStatusWarningText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: '#d97706',
  },
  sigThumbBox: {
    width: 80,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.3)',
  },
  sigThumbImg: {
    width: '100%',
    height: '100%',
  },
  sigUploadContainer: {
    marginTop: 4,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  sessionName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  sessionSub: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  lightboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  lightboxTitle: {
    color: '#ffffff',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    flex: 1,
  },
  lightboxCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lightboxBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '85%',
  },
});

function seedDraft(profile) {
  if (!profile) return {};
  const toDateInput = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };
  const edu = profile.education || {};
  const emp = profile.employment || {};
  const bank = profile.bankDetails || {};

  return {
    fullName: profile.fullName || '',
    phone: profile.phone || '',
    email: profile.email || '',
    gender: profile.gender || '',
    dateOfBirth: toDateInput(profile.dateOfBirth),
    permanentAddress: profile.permanentAddress || '',

    fatherName: profile.fatherName || '',
    fatherPhone: profile.fatherPhone || '',
    emergencyContactName: profile.emergencyContactName || '',
    emergencyContactPhone: profile.emergencyContactPhone || '',

    institution: edu.institution || '',
    level: edu.level || '',
    course: edu.course || '',
    yearOfStudy: edu.yearOfStudy || '',
    city: edu.city || '',

    employmentStatus: emp.status || '',
    company: emp.company || '',
    designation: emp.designation || '',
    workCity: emp.workCity || '',
    monthlyIncome: emp.monthlyIncome ?? '',

    accountHolderName: bank.accountHolderName || '',
    accountNumber: bank.accountNumber || '',
    ifsc: bank.ifsc || '',
    bankName: bank.bankName || '',
    branch: bank.branch || '',
    upiId: bank.upiId || '',

    aadhaarNumber: profile.aadhaarNumber || '',
  };
}

function buildSectionPayload(sectionKey, d) {
  const draft = d || {};
  if (sectionKey === 'personal') {
    return { email: draft.email };
  }
  if (sectionKey === 'family') {
    return {
      fatherName: draft.fatherName,
      fatherPhone: draft.fatherPhone,
      emergencyContactName: draft.emergencyContactName,
      emergencyContactPhone: draft.emergencyContactPhone,
    };
  }
  if (sectionKey === 'education') {
    return {
      education: {
        institution: draft.institution,
        level: draft.level,
        course: draft.course,
        yearOfStudy: draft.yearOfStudy,
        city: draft.city,
      },
    };
  }
  if (sectionKey === 'employment') {
    return {
      employment: {
        status: draft.employmentStatus,
        company: draft.company,
        designation: draft.designation,
        workCity: draft.workCity,
        monthlyIncome:
          draft.monthlyIncome === '' || draft.monthlyIncome === null || draft.monthlyIncome === undefined
            ? null
            : Number(draft.monthlyIncome),
      },
    };
  }
  if (sectionKey === 'bank') {
    return {
      bankDetails: {
        accountHolderName: draft.accountHolderName,
        accountNumber: draft.accountNumber,
        ifsc: draft.ifsc ? draft.ifsc.toUpperCase().trim() : '',
        bankName: draft.bankName,
        branch: draft.branch,
        upiId: draft.upiId,
      },
    };
  }
  if (sectionKey === 'kyc') {
    return {
      aadhaarNumber: draft.aadhaarNumber ? draft.aadhaarNumber.replace(/\D/g, '') : '',
    };
  }

  // 'all'
  return {
    email: draft.email,
    fatherName: draft.fatherName,
    fatherPhone: draft.fatherPhone,
    emergencyContactName: draft.emergencyContactName,
    emergencyContactPhone: draft.emergencyContactPhone,
    education: {
      institution: draft.institution,
      level: draft.level,
      course: draft.course,
      yearOfStudy: draft.yearOfStudy,
      city: draft.city,
    },
    employment: {
      status: draft.employmentStatus,
      company: draft.company,
      designation: draft.designation,
      workCity: draft.workCity,
      monthlyIncome:
        draft.monthlyIncome === '' || draft.monthlyIncome === null || draft.monthlyIncome === undefined
          ? null
          : Number(draft.monthlyIncome),
    },
    bankDetails: {
      accountHolderName: draft.accountHolderName,
      accountNumber: draft.accountNumber,
      ifsc: draft.ifsc ? draft.ifsc.toUpperCase().trim() : '',
      bankName: draft.bankName,
      branch: draft.branch,
      upiId: draft.upiId,
    },
    ...(draft.aadhaarNumber ? { aadhaarNumber: draft.aadhaarNumber.replace(/\D/g, '') } : {}),
  };
}
