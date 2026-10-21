import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  ShieldCheck, Receipt, Wallet, AlertCircle,
  CreditCard, MessageSquare, LayoutDashboard,
} from 'lucide-react-native';
import { tenantService } from '../../services/tenantService';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/normalize';
import { formatCurrency, formatMonthYear } from '../../lib/format';
import {
  Screen, TenantPageHeader, Card, Button, EmptyState, SegmentedControl, CardSkeleton,
} from '../../components';
import PaymentSheet from '../../components/tenants/PaymentSheet';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import RentStatusCard from '../../components/tenants/RentStatusCard';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

export default function RentScreen() {
  const { colors, isDark } = useTheme();
  const toast = useToast();

  const cachedPayload = tenantService.getCachedRents({ page: 1, limit: 24 });
  const [payload, setPayload] = useState(cachedPayload);
  const [rejectedProofs, setRejectedProofs] = useState([]);
  const [loading, setLoading] = useState(!cachedPayload);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  // Payment State — everything happens inside the shared PaymentSheet.
  const [payTarget, setPayTarget] = useState(null); // { type: 'single'|'multi'|'deposit', rent? }
  const [payOpen, setPayOpen] = useState(false);
  const [includeDeposit, setIncludeDeposit] = useState(false);

  const fetchData = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedRents({ page: 1, limit: 24 })) setLoading(true);
      setError(null);
      try {
        const [res, pRes] = await Promise.all([
          tenantService.getMyRents({ page: 1, limit: 24 }, { bypassCache: refresh }),
          tenantService.getPaymentProofs({ limit: 50 }, { bypassCache: refresh }).catch(() => null),
        ]);
        if (res) setPayload(res);
        const pList = Array.isArray(pRes) ? pRes : pRes?.data || pRes?.proofs || [];
        setRejectedProofs(pList.filter((p) => p.status === 'rejected'));
      } catch (e) {
        const errMsg = getErrorMessage(e);
        setError(errMsg);
        if (!tenantService.getCachedRents({ page: 1, limit: 24 })) {
          toast.error(errMsg);
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

  const rents = useMemo(() => (Array.isArray(payload) ? payload : payload?.rents || []), [payload]);
  const securityDeposit = payload?.securityDeposit || null;
  const additionalFeesPaid = payload?.additionalFeesPaid || [];
  const nextMonthsUpToNotice = payload?.nextMonthsUpToNotice || [];
  const totalLateFee = Number(payload?.totalLateFee) || 0;

  const depositPending = securityDeposit
    ? Math.max(0, (Number(securityDeposit.expected) || 0) - (Number(securityDeposit.collected) || 0))
    : 0;

  const unpaidRents = useMemo(
    () =>
      rents.filter(
        (r) =>
          ['unpaid', 'partial', 'overdue'].includes(r.status || 'unpaid') &&
          Number(r.pendingAmount ?? r.rentAmount) > 0
      ),
    [rents]
  );

  const filteredRents = useMemo(() => {
    if (filter === 'all') return rents;
    if (filter === 'unpaid') return rents.filter((r) => ['unpaid', 'partial'].includes(r.status || 'unpaid'));
    return rents.filter((r) => r.status === filter);
  }, [rents, filter]);

  const filterCounts = useMemo(() => ({
    all: rents.length,
    unpaid: rents.filter((r) => ['unpaid', 'partial', 'overdue'].includes(r.status || 'unpaid')).length,
    paid: rents.filter((r) => r.status === 'paid').length,
    overdue: rents.filter((r) => r.status === 'overdue').length,
  }), [rents]);

  const FILTERS_WITH_COUNTS = useMemo(() => [
    { value: 'all', label: `All (${filterCounts.all})` },
    { value: 'unpaid', label: `Unpaid (${filterCounts.unpaid})` },
    { value: 'paid', label: `Paid (${filterCounts.paid})` },
    { value: 'overdue', label: `Overdue (${filterCounts.overdue})` },
  ], [filterCounts]);

  // ── Payment (the shared PaymentSheet handles the whole flow) ─────────
  const startPay = (target) => {
    setIncludeDeposit(false);
    setPayTarget(target);
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

    // Security deposit on its own.
    if (payTarget.type === 'deposit') {
      return {
        title: 'Pay Security Deposit',
        summary: 'Refundable at move-out',
        amount: depositPending,
        items: [{ type: 'deposit', amount: depositPending }],
        rentIds: [],
        depositAmount: depositPending,
      };
    }

    const list = payTarget.type === 'single' ? [payTarget.rent] : unpaidRents;
    const rentItems = list
      .filter(Boolean)
      .map((r) => ({
        type: 'rent',
        rentId: r._id || r.id,
        month: r.month,
        year: r.year,
        amount: Math.max(0, Number(r.pendingAmount ?? r.rentAmount) || 0),
      }))
      .filter((r) => r.amount > 0 || r.rentId);

    const rentTotal = rentItems.reduce((s, r) => s + r.amount, 0);
    const withDeposit = includeDeposit && depositPending > 0;
    const items = withDeposit ? [...rentItems, { type: 'deposit', amount: depositPending }] : rentItems;

    const single = payTarget.type === 'single' && payTarget.rent;

    return {
      title: single ? `Pay Rent — ${formatMonthYear(payTarget.rent.month, payTarget.rent.year)}` : 'Pay Multiple Months',
      summary: single
        ? `Rent for ${formatMonthYear(payTarget.rent.month, payTarget.rent.year)}`
        : `${rentItems.length} unpaid month${rentItems.length === 1 ? '' : 's'} selected`,
      amount: rentTotal + (withDeposit ? depositPending : 0),
      items,
      rentIds: rentItems.map((r) => r.rentId).filter(Boolean),
      depositAmount: withDeposit ? depositPending : 0,
      depositToggle:
        depositPending > 0
          ? { amount: depositPending, checked: includeDeposit, onChange: setIncludeDeposit }
          : null,
    };
  }, [payTarget, includeDeposit, unpaidRents, depositPending]);


  if (loading && !payload) {
    return (
      <Screen scroll={false}>
        <TenantPageHeader
          title="Rent & Payments"
          subtitle="View and pay your rent & security deposit"
          icon={LayoutDashboard}
          iconTone="blue"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
          <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
            Loading rent details…
          </Text>
        </View>
        <CardSkeleton count={3} />
      </Screen>
    );
  }

  const depositPaid = Number(securityDeposit?.collected) || 0;

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchData({ refresh: true })}>
      <TenantPageHeader
        title="Rent & Payments"
        subtitle="View and pay your rent & security deposit"
        icon={LayoutDashboard}
        iconTone="blue"
      />

      {error && (
        <EmptyState
          icon={CreditCard}
          title="Failed to load rent records"
          message={error}
          action="Retry"
          onAction={() => fetchData({ refresh: true })}
        />
      )}

      {rejectedProofs.length > 0 && (
        <Card style={[styles.rejectBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca', marginBottom: SPACING.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }}>
            <MessageSquare size={18} color="#ef4444" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rejectBannerTitle, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
                You have {rejectedProofs.length} rejected payment proof{rejectedProofs.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.rejectBannerText, { color: isDark ? '#f87171' : '#b91c1c' }]}>
                Before submitting a new payment, you can chat with the owner in Transactions to clarify details or upload a new screenshot. Your owner can approve the transaction directly, avoiding duplicate entries.
              </Text>
              <Button
                title="Review & Clarify"
                size="sm"
                variant="outline"
                onPress={() => router.push('/payments?filter=rejected')}
                style={{ alignSelf: 'flex-start', marginTop: SPACING.sm }}
              />
            </View>
          </View>
        </Card>
      )}

      {securityDeposit && ((Number(securityDeposit.expected) || 0) > 0 || depositPaid > 0) && (
        <Card style={styles.block}>
          <View style={styles.cardHead}>
            <View style={[styles.iconBox, { backgroundColor: `${COLORS.success}15` }]}>
              <ShieldCheck size={20} color={COLORS.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Security Deposit</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Refundable at move-out</Text>
            </View>
          </View>

          <View style={styles.depositRow}>
            <View style={[styles.depositCell, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.cellLabel, { color: colors.textSecondary }]}>Expected</Text>
              <Text style={[styles.cellValue, { color: colors.textPrimary }]}>{formatCurrency(securityDeposit.expected || 0)}</Text>
            </View>
            <View style={[styles.depositCell, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : `${COLORS.success}12` }]}>
              <Text style={[styles.cellLabel, { color: '#059669' }]}>Paid</Text>
              <Text style={[styles.cellValue, { color: '#059669' }]}>{formatCurrency(depositPaid)}</Text>
            </View>
            <View style={[styles.depositCell, depositPending > 0 ? { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : `${COLORS.warning}12` } : { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.cellLabel, depositPending > 0 ? { color: '#d97706' } : { color: colors.textSecondary }]}>
                {depositPending > 0 ? 'Pending' : 'Balance'}
              </Text>
              <Text style={[styles.cellValue, depositPending > 0 ? { color: '#d97706' } : { color: colors.textPrimary }]}>
                {formatCurrency(depositPending > 0 ? depositPending : securityDeposit.balance || 0)}
              </Text>
            </View>
          </View>

          {depositPending > 0 && (
            <>
              <View style={[styles.warnNote, isDark && { backgroundColor: 'rgba(217, 119, 6, 0.12)', borderColor: 'rgba(217, 119, 6, 0.3)' }]}>
                <AlertCircle size={14} color="#d97706" />
                <Text style={[styles.warnNoteText, isDark && { color: '#fbbf24' }]}>
                  You still owe {formatCurrency(depositPending)} security deposit.
                </Text>
              </View>
              <Button
                title="Pay Deposit Now"
                icon={ShieldCheck}
                size="sm"
                onPress={() => startPay({ type: 'deposit' })}
                style={{ marginTop: SPACING.sm }}
              />
            </>
          )}
        </Card>
      )}

      {additionalFeesPaid.length > 0 && (
        <Card style={styles.block}>
          <View style={styles.cardHead}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : '#7c3aed15' }]}>
              <Receipt size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>One-time Fees</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Fees paid at move-in</Text>
            </View>
          </View>
          {additionalFeesPaid.map((fee, idx) => (
            <View key={`${fee.name}-${idx}`} style={[styles.feeRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.feeName, { color: colors.textSecondary }]}>{fee.name}</Text>
              <Text style={[styles.feeAmount, { color: colors.textPrimary }]}>{formatCurrency(fee.amount || 0)}</Text>
            </View>
          ))}
        </Card>
      )}

      {unpaidRents.length > 1 && (
        <Card style={styles.multiCard}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Pay multiple months together</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              {unpaidRents.length} unpaid months • Total: {formatCurrency(
                unpaidRents.reduce((s, r) => s + Math.max(0, Number(r.pendingAmount ?? r.rentAmount) || 0), 0)
              )}
            </Text>
          </View>
          <Button title="Pay multiple at once" size="sm" icon={Wallet} onPress={() => startPay({ type: 'multi' })} />
        </Card>
      )}

      {totalLateFee > 0 && (
        <View style={[styles.warnNote, isDark && { backgroundColor: 'rgba(217, 119, 6, 0.12)', borderColor: 'rgba(217, 119, 6, 0.3)' }]}>
          <AlertCircle size={14} color="#d97706" />
          <Text style={[styles.warnNoteText, isDark && { color: '#fbbf24' }]}>
            Late fees accrued so far: {formatCurrency(totalLateFee)}
          </Text>
        </View>
      )}

      {nextMonthsUpToNotice.length > 0 && (
        <Card style={styles.block}>
          <Text style={[styles.upcomingLabel, { color: colors.textTertiary }]}>UPCOMING MONTHS (BEFORE NOTICE ENDS)</Text>
          {nextMonthsUpToNotice.map((nm, i) => (
            <View key={`${nm.month}-${nm.year}-${i}`} style={[styles.feeRow, { borderBottomColor: colors.border }, i === nextMonthsUpToNotice.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={[styles.feeName, { color: colors.textSecondary }]}>{formatMonthYear(nm.month, nm.year)}</Text>
              <Text style={[styles.feeAmount, { color: colors.textPrimary }]}>{formatCurrency(nm.rentAmount || 0)}</Text>
            </View>
          ))}
        </Card>
      )}

      {rents.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No rent records"
          message="No rent records found for your account."
        />
      ) : (
        <>
          <SegmentedControl
            options={FILTERS_WITH_COUNTS}
            value={filter}
            onChange={setFilter}
            style={{ marginVertical: SPACING.md }}
          />

          {filteredRents.length === 0 ? (
            <EmptyState icon={CreditCard} title="No matching records" message="No rent records match the selected filter." />
          ) : (
            filteredRents.map((rent) => <RentStatusCard key={rent._id || `${rent.month}-${rent.year}`} rent={rent} onPay={() => startPay({ type: 'single', rent })} />)
          )}
        </>
      )}

      {/* ── Payment Sheet (shared with Dues & Dashboard) ── */}
      <PaymentSheet
        visible={payOpen}
        onClose={closePay}
        onSuccess={() => fetchData({ refresh: true })}
        target={payConfig}
      />

    </Screen>
  );
}


const styles = StyleSheet.create({
  block: { marginBottom: SPACING.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  cardSub: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 1 },
  depositRow: { flexDirection: 'row', gap: SPACING.sm },
  depositCell: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  cellLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  cellValue: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary, marginTop: 4 },
  warnNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: `${COLORS.warning}12`,
    borderWidth: 1,
    borderColor: `${COLORS.warning}40`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  warnNoteText: { flex: 1, fontSize: FONT_SIZES.xs, color: COLORS.warning },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  feeName: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  feeAmount: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary },
  multiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  upcomingLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  rejectBanner: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  rejectBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  rejectBannerText: {
    fontSize: 12,
    lineHeight: 17,
  },
});

