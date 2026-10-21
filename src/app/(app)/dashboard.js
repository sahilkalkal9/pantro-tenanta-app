import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSelector } from 'react-redux';
import { router } from 'expo-router';
import {
  Home,
  BedDouble,
  CreditCard,
  AlertTriangle,
  Bell,
  Wrench,
  Receipt,
  Wallet,
  Sparkles,
  MapPin,
  ChevronRight,
  ShieldCheck,
  ArrowUpRight,
  LayoutDashboard,
} from 'lucide-react-native';
import { tenantService } from '../../services/tenantService';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/normalize';
import { formatCurrency, formatBedNumber, formatMonthYear } from '../../lib/format';
import {
  Screen,
  TenantPageHeader,
  Card,
  EmptyState,
  CardSkeleton,
  ListSkeleton,
  RentStatusCard,
  ComplaintCard,
  NoticeCard,
} from '../../components';
import PaymentSheet from '../../components/tenants/PaymentSheet';
import { COLORS, SPACING, SHADOWS } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';

const STAT_TONES = {
  violet: { light: { bg: '#f3e8ff', fg: '#7c3aed' }, dark: { bg: 'rgba(124, 58, 237, 0.18)', fg: '#a78bfa' } },
  cyan: { light: { bg: '#cffafe', fg: '#0891b2' }, dark: { bg: 'rgba(8, 145, 178, 0.18)', fg: '#38bdf8' } },
  amber: { light: { bg: '#fef3c7', fg: '#d97706' }, dark: { bg: 'rgba(217, 119, 6, 0.18)', fg: '#fbbf24' } },
  blue: { light: { bg: '#eff6ff', fg: '#2563eb' }, dark: { bg: 'rgba(37, 99, 235, 0.18)', fg: '#60a5fa' } },
};

function StatTile({ title, value, icon: Icon, tone = 'blue', onPress }) {
  const { colors, isDark } = useTheme();
  const palette = STAT_TONES[tone] || STAT_TONES.blue;
  const { bg, fg } = isDark ? palette.dark : palette.light;

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.statHeaderRow}>
        <Text style={[styles.statTitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.statIconBox, { backgroundColor: bg }]}>
          <Icon size={16} color={fg} strokeWidth={2.2} />
        </View>
      </View>
      <Text style={[styles.statValue, { color: colors.textPrimary }]} numberOfLines={1}>
        {value ?? '—'}
      </Text>
    </Wrapper>
  );
}

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useSelector((state) => state.auth);
  const toast = useToast();

  const cachedDash = tenantService.getCachedDashboard();
  const [dashboard, setDashboard] = useState(cachedDash);
  const [securityDeposit, setSecurityDeposit] = useState(cachedDash?.securityDeposit || null);
  const [additionalFeesPaid, setAdditionalFeesPaid] = useState([]);
  const [loading, setLoading] = useState(!cachedDash);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Payment State — every "Pay" tap opens the shared PaymentSheet.
  const [payTarget, setPayTarget] = useState(null); // the rent being paid
  const [payOpen, setPayOpen] = useState(false);
  const [includeDeposit, setIncludeDeposit] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh && !tenantService.getCachedDashboard()) {
        setLoading(true);
      }
      setError(null);
      const [dashRes, rentsRes] = await Promise.all([
        tenantService.getDashboard({ bypassCache: isRefresh }),
        tenantService.getMyRents({ page: 1, limit: 24 }, { bypassCache: isRefresh }).catch(() => null),
      ]);

      const d = dashRes?.dashboard || dashRes?.data || dashRes;
      if (d) {
        setDashboard(d);
      }

      const rd = rentsRes?.data || rentsRes;
      if (rd && typeof rd === 'object') {
        if (rd.securityDeposit) setSecurityDeposit(rd.securityDeposit);
        if (rd.additionalFeesPaid) setAdditionalFeesPaid(rd.additionalFeesPaid);
      } else {
        if (d?.securityDeposit) setSecurityDeposit(d.securityDeposit);
        if (d?.additionalFeesPaid) setAdditionalFeesPaid(d.additionalFeesPaid);
      }
    } catch (err) {
      console.warn('[dashboard] fetch error:', err?.message || err, err?.response?.status);
      const msg = getErrorMessage(err);
      // Only block screen if there is no data at all
      if (!tenantService.getCachedDashboard()) {
        setError(msg);
      }
      if (isRefresh) {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const currentRent = dashboard?.currentRent || null;
  const pendingAmount = Number(dashboard?.pendingAmount ?? (currentRent ? currentRent.pendingAmount : 0)) || 0;
  // "Pending Dues" is the tenant's TOTAL outstanding dues (every unpaid rent
  // month + months never billed + pending deposit + charges) — the same
  // figure the Dues page totals up to.
  const totalDues = Number(dashboard?.totalDues ?? dashboard?.totalPendingRents ?? pendingAmount) || 0;
  const duesBreakdown = dashboard?.duesBreakdown || null;
  const duesBreakdownText = (() => {
    if (!duesBreakdown) return '';
    const parts = [];
    const months = (duesBreakdown.unpaidRentMonths || 0) + (duesBreakdown.missingRentMonths || 0);
    if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'} rent`);
    if ((duesBreakdown.depositTotal || 0) > 0) parts.push('deposit');
    const charges = duesBreakdown.pendingCharges || 0;
    if ((duesBreakdown.chargesTotal || 0) > 0) parts.push(`${charges} charge${charges === 1 ? '' : 's'}`);
    return parts.join(' · ');
  })();

  const depositPending = securityDeposit
    ? Math.max(0, (Number(securityDeposit.expected) || 0) - (Number(securityDeposit.collected) || 0))
    : 0;

  // Every "Pay" tap opens the one shared payment sheet.
  const openPay = () => {
    if (!currentRent) {
      router.push('/rent');
      return;
    }
    setIncludeDeposit(false);
    setPayTarget(currentRent);
    setPayOpen(true);
  };

  const closePay = () => {
    setPayOpen(false);
    setPayTarget(null);
    setIncludeDeposit(false);
  };

  // The one configuration the shared PaymentSheet is opened with.
  const payConfig = useMemo(() => {
    if (!payTarget) return null;

    const rentId = payTarget._id || payTarget.id || null;
    const rentAmount = Math.max(
      0,
      Number(
        payTarget.pendingAmount ??
          (Number(payTarget.rentAmount) || 0) -
            (Number(payTarget.paidAmount) || 0) +
            (Number(payTarget.lateFeeAccrued) || 0)
      ) || 0
    );
    const withDeposit = includeDeposit && depositPending > 0;

    const items = [
      {
        type: 'rent',
        rentId,
        month: payTarget.month,
        year: payTarget.year,
        amount: rentAmount,
      },
    ];
    if (withDeposit) items.push({ type: 'deposit', amount: depositPending });

    return {
      title: 'Pay Rent',
      summary:
        payTarget.month && payTarget.year
          ? `Rent for ${formatMonthYear(payTarget.month, payTarget.year)}`
          : 'Current rent',
      amount: rentAmount + (withDeposit ? depositPending : 0),
      items,
      rentIds: rentId ? [rentId] : [],
      depositAmount: withDeposit ? depositPending : 0,
      depositToggle:
        depositPending > 0
          ? { amount: depositPending, checked: includeDeposit, onChange: setIncludeDeposit }
          : null,
    };
  }, [payTarget, includeDeposit, depositPending]);

  if (loading && !dashboard) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh} contentStyle={styles.scrollContent}>
        <TenantPageHeader title="Dashboard" subtitle="Welcome back!" icon={LayoutDashboard} iconTone="blue" />
        <View style={styles.inlineLoadingBox}>
          <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
          <Text style={[styles.inlineLoadingText, { color: colors.textSecondary }]}>
            Loading your dashboard…
          </Text>
        </View>
        <CardSkeleton count={3} />
        <ListSkeleton count={2} style={{ marginTop: SPACING.md }} />
      </Screen>
    );
  }

  if (error && !dashboard) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh} contentStyle={styles.scrollContent}>
        <TenantPageHeader title="Dashboard" icon={LayoutDashboard} iconTone="blue" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load dashboard"
            message={error}
            action="Try Again"
            onAction={onRefresh}
          />
        </Card>
      </Screen>
    );
  }

  const profile = dashboard?.profile || null;
  const property = profile?.propertyId || dashboard?.property || null;
  const room = dashboard?.roomDetails || profile?.roomId || null;
  const bed = dashboard?.bedDetails || profile?.bedId || null;

  const recentComplaints = Array.isArray(dashboard?.recentComplaints)
    ? dashboard.recentComplaints.slice(0, 3)
    : Array.isArray(dashboard?.complaints)
    ? dashboard.complaints.slice(0, 3)
    : [];

  const recentNotices = Array.isArray(dashboard?.latestNotices)
    ? dashboard.latestNotices.slice(0, 3)
    : Array.isArray(dashboard?.notices)
    ? dashboard.notices.slice(0, 3)
    : [];

  const openComplaintsCount = recentComplaints.filter(
    (c) => c.status !== 'resolved' && c.status !== 'closed'
  ).length;

  const propertyName = property?.name || '—';
  const propertyAddress = [property?.address, property?.city].filter(Boolean).join(', ');
  const roomNumber = room?.roomNumber || '—';
  const isRk = room?.type === 'RK' || room?.sharingType === 'RK' || ['RK', 'Flat'].includes(property?.type);
  const bedLabel = formatBedNumber(bed?.bedNumber, room?.roomNumber);
  const monthlyRent = profile?.monthlyRent || currentRent?.baseRent || currentRent?.rentAmount || 0;
  const tenantName = profile?.fullName || user?.name || user?.fullName || 'Tenant';
  const firstName = tenantName.split(' ')[0];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const isEx = profile?.status === 'ex' || profile?.status === 'moved_out';

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* ── Page Header / Greeting ─────────────────────────── */}
      <TenantPageHeader
        title={isEx ? `Welcome back, ${firstName}!` : `${greeting}, ${firstName}!`}
        subtitle={isEx ? 'Your stay has ended. Here is your record summary.' : "Here's what's happening at your home today"}
        icon={LayoutDashboard}
        iconTone={isEx ? 'slate' : 'blue'}
      />

      {/* ── Hero Stay Card ─────────────────────────────────── */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.heroBody, isEx && { backgroundColor: '#334155' }]}>
          {/* Subtle Ambient Backlight circles */}
          <View style={styles.heroDecorCircleRight} />
          <View style={styles.heroDecorCircleLeft} />

          {/* "Your Home" Badge */}
          <View style={styles.homePill}>
            <Sparkles size={11} color="#ffffff" />
            <Text style={styles.homePillText}>{isEx ? 'PREVIOUS STAY' : 'YOUR HOME'}</Text>
          </View>

          {/* Property Name */}
          <Text style={styles.propertyName} numberOfLines={2}>
            {propertyName}
          </Text>

          {/* Property Address */}
          {propertyAddress ? (
            <View style={styles.addressRow}>
              <MapPin size={13} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.addressText} numberOfLines={1}>
                {propertyAddress}
              </Text>
            </View>
          ) : null}

          {/* Room & Bed Pills */}
          <View style={styles.badgeRow}>
            <View style={styles.specBadge}>
              <Home size={13} color="#ffffff" strokeWidth={2.4} />
              <Text style={styles.specBadgeText}>Room {roomNumber}</Text>
            </View>

            {!isRk && bedLabel !== '—' && (
              <View style={styles.specBadge}>
                <BedDouble size={13} color="#ffffff" strokeWidth={2.4} />
                <Text style={styles.specBadgeText}>Bed {bedLabel}</Text>
              </View>
            )}

            {profile?.status ? (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {String(profile.status).replace('_', ' ')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Hero Bottom Split Metrics */}
        {!isEx && (
          <View style={[styles.heroMetricsSplit, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.metricColumn}
              onPress={() => router.push('/rent')}
              activeOpacity={0.7}
            >
              <View style={styles.metricLabelRow}>
                <Wallet size={13} color={colors.textSecondary} strokeWidth={2.2} />
                <Text style={[styles.metricLabelText, { color: colors.textSecondary }]}>MONTHLY RENT</Text>
              </View>
              <Text style={[styles.metricValueText, { color: colors.textPrimary }]}>{formatCurrency(monthlyRent)}</Text>
            </TouchableOpacity>

            <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.metricColumn}
              onPress={() => router.push('/more/dues')}
              activeOpacity={0.7}
            >
              <View style={styles.metricLabelRow}>
                <AlertTriangle size={13} color="#e11d48" strokeWidth={2.2} />
                <Text style={[styles.metricLabelText, { color: colors.textSecondary }]}>PENDING DUES</Text>
              </View>
              <Text
                style={[
                  styles.metricValueText,
                  { color: totalDues > 0 ? '#e11d48' : '#059669' },
                ]}
              >
                {formatCurrency(totalDues)}
              </Text>
              {duesBreakdownText ? (
                <Text style={[styles.metricSubText, { color: colors.textTertiary }]} numberOfLines={1}>
                  {duesBreakdownText}
                </Text>
              ) : null}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── At-a-Glance Stats Grid (2 in a row) ─────────────── */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatTile
            title="Room Number"
            value={roomNumber}
            icon={Home}
            tone="violet"
            onPress={() => router.push('/more/room')}
          />
          <StatTile
            title="Bed Number"
            value={isRk ? 'Shared' : bedLabel}
            icon={BedDouble}
            tone="cyan"
            onPress={() => router.push('/more/room')}
          />
        </View>
        <View style={styles.statsRow}>
          <StatTile
            title="Open Issues"
            value={openComplaintsCount}
            icon={AlertTriangle}
            tone="amber"
            onPress={() => router.push('/complaints')}
          />
          <StatTile
            title="Notices"
            value={recentNotices.length}
            icon={Bell}
            tone="blue"
            onPress={() => router.push('/more/notices')}
          />
        </View>
      </View>

      {/* ── Quick Actions Grid ──────────────────────────────── */}
      {!isEx && (
        <View style={styles.sectionWrap}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconTile, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff', borderColor: isDark ? 'rgba(37, 99, 235, 0.35)' : '#bfdbfe' }]}>
              <Sparkles size={17} color={isDark ? '#60a5fa' : '#2563eb'} strokeWidth={2.2} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={[styles.cardHeaderTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
              <Text style={[styles.cardHeaderSub, { color: colors.textSecondary }]}>Everything you need, one tap away</Text>
            </View>
          </View>

          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={[styles.quickTile, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={openPay}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickIconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff',
                    borderColor: isDark ? 'rgba(37, 99, 235, 0.35)' : '#bfdbfe',
                  },
                ]}
              >
                <CreditCard size={18} color={isDark ? '#60a5fa' : '#2563eb'} strokeWidth={2.2} />
              </View>
              <View style={styles.quickTextWrap}>
                <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>Pay Rent</Text>
              </View>
              {totalDues > 0 && <View style={styles.quickPulseDot} />}
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickTile, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/complaints')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickIconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.18)' : '#fef3c7',
                    borderColor: isDark ? 'rgba(217, 119, 6, 0.35)' : '#fde68a',
                  },
                ]}
              >
                <Wrench size={18} color={isDark ? '#fbbf24' : '#d97706'} strokeWidth={2.2} />
              </View>
              <View style={styles.quickTextWrap}>
                <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>Raise Issue</Text>
              </View>
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickTile, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/payments')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickIconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(22, 163, 74, 0.18)' : '#dcfce7',
                    borderColor: isDark ? 'rgba(22, 163, 74, 0.35)' : '#bbf7d0',
                  },
                ]}
              >
                <Receipt size={18} color={isDark ? '#4ade80' : '#16a34a'} strokeWidth={2.2} />
              </View>
              <View style={styles.quickTextWrap}>
                <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>Payments</Text>
              </View>
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickTile, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/more/notices')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickIconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.18)' : '#f5f3ff',
                    borderColor: isDark ? 'rgba(124, 58, 237, 0.35)' : '#ddd6fe',
                  },
                ]}
              >
                <Bell size={18} color={isDark ? '#a78bfa' : '#7c3aed'} strokeWidth={2.2} />
              </View>
              <View style={styles.quickTextWrap}>
                <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>Notices</Text>
              </View>
              {recentNotices.length > 0 && (
                <View style={styles.quickBadge}>
                  <Text style={styles.quickBadgeText}>{recentNotices.length > 9 ? '9+' : recentNotices.length}</Text>
                </View>
              )}
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Security Deposit Card ───────────────────────────── */}
      {securityDeposit && (Number(securityDeposit.expected) > 0 || Number(securityDeposit.collected) > 0) && (
        <View style={[styles.depositCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.depositHeader}>
            <View style={styles.depositHeaderLeft}>
              <ShieldCheck size={18} color="#059669" strokeWidth={2.2} />
              <View>
                <Text style={[styles.depositTitle, { color: colors.textPrimary }]}>Security Deposit</Text>
                <Text style={[styles.depositSub, { color: colors.textSecondary }]}>{isEx ? 'Deposit record' : 'Refundable on move-out'}</Text>
              </View>
            </View>
            {Number(securityDeposit.collected) >= Number(securityDeposit.expected) && Number(securityDeposit.expected) > 0 ? (
              <View style={styles.depositPaidPill}>
                <Text style={styles.depositPaidPillText}>Fully paid</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.depositGrid, { borderTopColor: colors.border }]}>
            <View style={styles.depositCol}>
              <Text style={[styles.depositColLabel, { color: colors.textSecondary }]}>EXPECTED</Text>
              <Text style={[styles.depositColValue, { color: colors.textPrimary }]}>{formatCurrency(securityDeposit.expected)}</Text>
            </View>
            <View style={[styles.depositCol, styles.depositColBorder, { borderLeftColor: colors.border }]}>
              <Text style={[styles.depositColLabel, { color: '#059669' }]}>PAID</Text>
              <Text style={[styles.depositColValue, { color: '#059669' }]}>
                {formatCurrency(securityDeposit.collected)}
              </Text>
            </View>
            <View style={[styles.depositCol, styles.depositColBorder, { borderLeftColor: colors.border }]}>
              <Text style={[styles.depositColLabel, { color: colors.textSecondary }]}>PENDING</Text>
              <Text
                style={[
                  styles.depositColValue,
                  {
                    color:
                      Number(securityDeposit.expected) - Number(securityDeposit.collected) > 0
                        ? '#d97706'
                        : colors.textSecondary,
                  },
                ]}
              >
                {formatCurrency(
                  Math.max(0, (Number(securityDeposit.expected) || 0) - (Number(securityDeposit.collected) || 0))
                )}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── One-time Fees Card ──────────────────────────────── */}
      {additionalFeesPaid.length > 0 && (
        <View style={[styles.feesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.depositHeader}>
            <View style={styles.depositHeaderLeft}>
              <Receipt size={18} color="#7c3aed" strokeWidth={2.2} />
              <View>
                <Text style={[styles.depositTitle, { color: colors.textPrimary }]}>One-time Fees</Text>
                <Text style={[styles.depositSub, { color: colors.textSecondary }]}>Fees paid at move-in</Text>
              </View>
            </View>
          </View>
          <View style={[styles.feesList, { borderTopColor: colors.border }]}>
            {additionalFeesPaid.map((fee, idx) => (
              <View key={idx} style={[styles.feeRow, idx > 0 && { borderTopWidth: 1, borderTopColor: isDark ? colors.border : '#f1f5f9' }]}>
                <Text style={[styles.feeName, { color: colors.textSecondary }]}>{fee.name}</Text>
                <Text style={[styles.feeAmount, { color: colors.textPrimary }]}>{formatCurrency(fee.amount)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── This Month's Rent Card ─────────────────────────── */}
      {currentRent && !isEx && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>This Month's Rent</Text>
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => router.push('/rent')}
              hitSlop={8}
            >
              <Text style={styles.viewAllText}>View all</Text>
              <ArrowUpRight size={13} color="#2563eb" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <RentStatusCard
            rent={currentRent}
            onPay={openPay}
          />
        </View>
      )}

      {/* ── Recent Complaints ───────────────────────────────── */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Recent Complaints</Text>
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => router.push('/complaints')}
            hitSlop={8}
          >
            <Text style={styles.viewAllText}>View all</Text>
            <ArrowUpRight size={13} color="#2563eb" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {recentComplaints.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AlertTriangle size={24} color="#d97706" style={{ marginBottom: 6 }} />
            <Text style={[styles.emptyCardTitle, { color: colors.textPrimary }]}>No complaints</Text>
            <Text style={[styles.emptyCardSub, { color: colors.textSecondary }]}>You haven't raised any complaints yet.</Text>
            <TouchableOpacity
              style={[styles.emptyCardBtn, isDark && { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}
              onPress={() => router.push('/complaints')}
            >
              <Text style={[styles.emptyCardBtnText, isDark && { color: '#60a5fa' }]}>Raise Complaint</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listStack}>
            {recentComplaints.map((item) => (
              <ComplaintCard
                key={item._id || item.id}
                complaint={item}
                onClick={() => router.push(`/complaints/${item._id || item.id}`)}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Recent Notices ─────────────────────────────────── */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Recent Notices</Text>
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => router.push('/more/notices')}
            hitSlop={8}
          >
            <Text style={styles.viewAllText}>View all</Text>
            <ArrowUpRight size={13} color="#2563eb" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {recentNotices.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Bell size={24} color="#7c3aed" style={{ marginBottom: 6 }} />
            <Text style={[styles.emptyCardTitle, { color: colors.textPrimary }]}>No notices</Text>
            <Text style={[styles.emptyCardSub, { color: colors.textSecondary }]}>No notices for you yet.</Text>
          </View>
        ) : (
          <View style={styles.listStack}>
            {recentNotices.map((n) => (
              <NoticeCard
                key={n._id || n.id}
                notice={n}
                onClick={() => router.push('/more/notices')}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Payment Sheet (shared with Dues & Rent) ─── */}
      <PaymentSheet
        visible={payOpen}
        onClose={closePay}
        onSuccess={() => fetchData(true)}
        target={payConfig}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 110,
  },
  topHeader: {
    marginBottom: SPACING.md,
  },
  greetingWrap: {
    gap: 3,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    ...SHADOWS.medium,
    marginBottom: SPACING.md,
  },
  heroBody: {
    backgroundColor: '#2563eb',
    padding: SPACING.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecorCircleRight: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroDecorCircleLeft: {
    position: 'absolute',
    left: -30,
    top: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  homePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  homePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#ffffff',
  },
  propertyName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  specBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'capitalize',
  },
  heroMetricsSplit: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metricColumn: {
    flex: 1,
    padding: SPACING.md,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#f1f5f9',
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metricLabelText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#64748b',
  },
  metricValueText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  metricSubText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  inlineLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  inlineLoadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    gap: 10,
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    ...SHADOWS.small,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  statTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionWrap: {
    marginBottom: SPACING.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cardIconTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  cardHeaderSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  sectionSubheading: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTile: {
    width: (Dimensions.get('window').width - 40) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
    ...SHADOWS.small,
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTextWrap: {
    flex: 1,
  },
  quickTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  quickSub: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  quickPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#e11d48',
  },
  quickBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#f43f5e',
  },
  quickBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  depositCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  depositHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  depositHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  depositTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  depositSub: {
    fontSize: 11,
    color: '#64748b',
  },
  depositPaidPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  depositPaidPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  depositGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  depositCol: {
    flex: 1,
    alignItems: 'center',
  },
  depositColBorder: {
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
  },
  depositColLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#64748b',
  },
  depositColValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 3,
  },
  feesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  feesList: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 4,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  feeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  feeAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  rentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  rentCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rentMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  rentAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  rentStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillPaid: {
    backgroundColor: '#dcfce7',
  },
  pillPartial: {
    backgroundColor: '#fef3c7',
  },
  pillUnpaid: {
    backgroundColor: '#ffe4e6',
  },
  rentStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  textPaid: {
    color: '#16a34a',
  },
  textPartial: {
    color: '#d97706',
  },
  textUnpaid: {
    color: '#e11d48',
  },
  rentCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dueDateText: {
    fontSize: 11.5,
    color: '#64748b',
  },
  payNowBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  payNowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyCardSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  emptyCardBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyCardBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  listStack: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  complaintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  complaintLeft: {
    flex: 1,
  },
  complaintTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  complaintTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  complaintBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeResolved: {
    backgroundColor: '#dcfce7',
  },
  badgeOpen: {
    backgroundColor: '#fef3c7',
  },
  complaintBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textResolved: {
    color: '#16a34a',
  },
  textOpen: {
    color: '#d97706',
  },
  complaintMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  noticeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  noticeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  noticeMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  errorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fee2e2',
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.sm,
    ...SHADOWS.medium,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});