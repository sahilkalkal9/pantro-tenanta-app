import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import {
  Receipt, CheckCircle, XCircle, Clock, TrendingUp, ShieldCheck, ShieldX,
  Wallet, Hash, IndianRupee, AlertTriangle, Calendar, MessageSquare, ImageIcon,
  Copy, Check, QrCode, Building, Info, ExternalLink, RefreshCw, ChevronRight,
  MessageSquareWarning,
} from 'lucide-react-native';
import { tenantService } from '../../services/tenantService';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/normalize';
import { resolveMediaUrl, api } from '../../lib/api';
import { formatCurrency, formatDateTime, formatMonthYear } from '../../lib/format';
import {
  Screen, ModalSheet, TenantPageHeader, Card, Button, StatusBadge, Divider,
  EmptyState, SegmentedControl, StatCard, KeyValue,
  TextField, ImageKitUploader, Skeleton, CardSkeleton, PantroLoader,
} from '../../components';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import { useLocalSearchParams, router } from 'expo-router';

const METHOD_LABELS = {
  upi: 'UPI', UPI: 'UPI',
  cash: 'Cash', Cash: 'Cash',
  bank_transfer: 'Bank Transfer', Bank_Transfer: 'Bank Transfer', 'bank transfer': 'Bank Transfer',
  cheque: 'Cheque', Cheque: 'Cheque',
  other: 'Other', Other: 'Other',
};

const STATUS_LABELS = {
  pending: 'Approval in Progress',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  partial: 'Partially Paid',
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const CATEGORY_GROUPS = [
  { key: 'rent', label: 'Rent Payments', icon: IndianRupee, color: COLORS.secondary },
  { key: 'security_deposit', label: 'Security Deposit', icon: ShieldCheck, color: COLORS.success },
  { key: 'mixed', label: 'Rent + Deposit', icon: Wallet, color: '#7c3aed' },
  { key: 'pending_payment', label: 'Other Charges', icon: Receipt, color: COLORS.warning },
  { key: 'other', label: 'Other', icon: Receipt, color: COLORS.gray500 },
];

function buildTransactions(proofs, rents) {
  const items = [];
  const coveredRentIds = new Set();

  proofs
    .filter((p) => p.status === 'approved')
    .forEach((p) => {
      const single = p.rentId?._id || p.rentId;
      if (single) coveredRentIds.add(String(single));
      (p.rentIds || []).forEach((rid) => coveredRentIds.add(String(rid?._id || rid)));
    });

  proofs.forEach((p) => {
    items.push({
      id: `proof-${p._id || p.id}`,
      kind: 'proof',
      proofId: p._id || p.id,
      conversation: p.conversation || [],
      category: p.category || 'rent',
      date: p.submittedAt || p.createdAt,
      verifiedAt: p.verifiedAt || null,
      amount: Number(p.amount) || 0,
      status: p.status || 'pending',
      method: METHOD_LABELS[p.paymentMethod] || p.paymentMethod || '—',
      reference: p.transactionId || p.utr || '—',
      notes: p.notes || '',
      rejectionReason: p.status === 'rejected' ? p.rejectionReason || '' : '',
      verifiedBy: p.verifiedBy || null,
      rentMonth: p.rentId?.month,
      rentYear: p.rentId?.year,
      rentAmount: p.rentId?.rentAmount,
      screenshot: p.screenshotUrl,
      transactions: p.transactions || [],
    });
  });

  rents.forEach((r) => {
    const status = r.status || (r.paidAmount >= r.rentAmount ? 'paid' : 'unpaid');
    if (status !== 'paid' && status !== 'partial') return;
    if (coveredRentIds.has(String(r._id || r.id))) return;
    if (!r.paidAmount) return;
    items.push({
      id: `rent-paid-${r._id || r.id}`,
      kind: 'rent',
      category: 'rent',
      date: r.paymentDate || r.updatedAt || r.createdAt,
      verifiedAt: null,
      amount: Number(r.paidAmount) || 0,
      status,
      method: METHOD_LABELS[r.paymentMethod] || r.paymentMethod || '—',
      reference: r.transactionId || '—',
      notes: r.notes || '',
      rejectionReason: '',
      verifiedBy: null,
      rentMonth: r.month,
      rentYear: r.year,
      rentAmount: r.rentAmount,
      screenshot: null,
      transactions: [],
    });
  });

  items.sort((a, b) => {
    const ad = a.date ? new Date(a.date).getTime() : 0;
    const bd = b.date ? new Date(b.date).getTime() : 0;
    return bd - ad;
  });

  return items;
}

export default function PaymentsScreen() {
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams();
  const [error, setError] = useState(null);

  const cachedProofs = tenantService.getCachedPaymentProofs({});
  const cachedRentsPayload = tenantService.getCachedRents({ page: 1, limit: 24 }) || tenantService.getCachedRents({ page: 1, limit: 36 });
  const hasCached = !!cachedProofs || !!cachedRentsPayload;

  const [proofs, setProofs] = useState(cachedProofs || []);
  const [rents, setRents] = useState(cachedRentsPayload?.rents || (Array.isArray(cachedRentsPayload) ? cachedRentsPayload : []));
  const [payInfo, setPayInfo] = useState(null);
  const [payInfoLoading, setPayInfoLoading] = useState(true);
  const [loading, setLoading] = useState(!hasCached);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(params.filter && ['all','pending','approved','rejected'].includes(params.filter) ? params.filter : 'all');
  const [selected, setSelected] = useState(null);
  const [previewQr, setPreviewQr] = useState(null);

  // Handle cf_order_id return from Cashfree
  useEffect(() => {
    if (params.cf_order_id) {
      const orderId = params.cf_order_id;
      tenantService.verifyCashfreeOrder({ orderId })
        .then(() => {
          toast.success('Payment confirmed — your rent is updated');
          fetchData({ refresh: true });
          router.replace('/(app)/payments');
        })
        .catch(e => {
          toast.error(getErrorMessage(e));
          router.replace('/(app)/payments');
        });
    }
  }, [params.cf_order_id, toast, router]);

  const fetchData = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedPaymentProofs({})) setLoading(true);
      setError(null);
      try {
        const [proofRes, rentRes, payInfoRes] = await Promise.allSettled([
          tenantService.getPaymentProofs({}, { bypassCache: refresh }),
          tenantService.getMyRents({ page: 1, limit: 24 }, { bypassCache: refresh }),
          tenantService.getPaymentInfo(),
        ]);
        if (proofRes.status === 'fulfilled') setProofs(Array.isArray(proofRes.value) ? proofRes.value : []);
        else throw proofRes.reason;
        if (rentRes.status === 'fulfilled') {
          const payload = rentRes.value;
          setRents(Array.isArray(payload) ? payload : payload?.rents || []);
        } else throw rentRes.reason;
        if (payInfoRes.status === 'fulfilled') {
          setPayInfo(payInfoRes.value?.data || payInfoRes.value || null);
        } else throw payInfoRes.reason;
      } catch (e) {
        setError(getErrorMessage(e));
        if (!tenantService.getCachedPaymentProofs({})) {
          toast.error(getErrorMessage(e));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setPayInfoLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filter with URL param
  useEffect(() => {
    if (params.filter && ['all','pending','approved','rejected'].includes(params.filter)) {
      setFilter(params.filter);
    }
  }, [params.filter]);

  const allTransactions = useMemo(() => buildTransactions(proofs, rents), [proofs, rents]);

  const stats = useMemo(() => {
    let paid = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    let approved = 0;
    let rejected = 0;
    allTransactions.forEach((tx) => {
      if (['paid', 'approved'].includes(tx.status)) { // web: approved || paid only
        paid += tx.amount || 0;
        approved += 1;
      } else if (tx.status === 'partial') {
        // web: partial is NOT in approved filter
        // but amount still counts as paid for totals
        paid += tx.amount || 0;
      } else if (tx.status === 'pending') {
        pendingAmount += tx.amount || 0;
        pendingCount += 1;
      } else if (tx.status === 'rejected') {
        rejected += 1;
      }
    });
    return { paid, pendingAmount, pendingCount, approved, rejected };
  }, [allTransactions]);

  const filtered = useMemo(() => {
    if (filter === 'all') return allTransactions;
    if (filter === 'pending') return allTransactions.filter((t) => t.status === 'pending');
    if (filter === 'approved') return allTransactions.filter((t) => ['approved', 'paid'].includes(t.status)); // web exact: approved || paid ONLY
    if (filter === 'rejected') return allTransactions.filter((t) => t.status === 'rejected');
    return allTransactions;
  }, [allTransactions, filter]);

  const filterOptions = useMemo(() => [
    { value: 'all', label: `All (${allTransactions.length})` },
    { value: 'pending', label: `Pending (${stats.pendingCount})` },
    { value: 'approved', label: `Approved (${stats.approved})` },
    { value: 'rejected', label: `Rejected (${stats.rejected})` },
  ], [allTransactions.length, stats]);

  const grouped = useMemo(() => {
    const known = new Set(CATEGORY_GROUPS.map((g) => g.key));
    return CATEGORY_GROUPS.map((group) => ({
      ...group,
      items: filtered.filter((tx) => (known.has(tx.category) ? tx.category : 'other') === group.key),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  if (loading && allTransactions.length === 0) {
    return (
      <Screen scroll={false}>
        <TenantPageHeader
          title="Transactions"
          subtitle="Your complete payment history with approval status"
          icon={Receipt}
          iconTone="blue"
          right={<Button variant="secondary" size="sm" onPress={() => fetchData({ refresh: true })}><RefreshCw size={14} /> Refresh</Button>}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
          <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
            Loading your transactions…
          </Text>
        </View>
        <CardSkeleton count={2} />
      </Screen>
    );
  }

  const handleRefresh = () => fetchData({ refresh: true });

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <TenantPageHeader
        title="Transactions"
        subtitle="Your complete payment history with approval status"
        icon={Receipt}
        iconTone="blue"
        right={
          <Button variant="secondary" size="sm" onPress={handleRefresh} style={{ marginLeft: 8 }}>
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      <View style={styles.statRow}>
        <StatCard icon={TrendingUp} label="Total Paid" value={formatCurrency(stats.paid)} color={COLORS.success} style={styles.statCard} />
        <StatCard
          icon={Clock}
          label="Approval in Progress"
          value={formatCurrency(stats.pendingAmount)}
          color={stats.pendingAmount > 0 ? COLORS.warning : COLORS.gray400}
          style={styles.statCard}
        />
      </View>
      <View style={styles.statRow}>
        <StatCard icon={ShieldCheck} label="Approved" value={stats.approved} color={COLORS.info} style={styles.statCard} />
        <StatCard
          icon={ShieldX}
          label="Rejected"
          value={stats.rejected}
          color={stats.rejected > 0 ? COLORS.danger : COLORS.gray400}
          style={styles.statCard}
        />
      </View>

      {stats.rejected > 0 && (
        <Card style={[styles.rejectBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }}>
            <MessageSquare size={20} color={COLORS.danger} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rejectBannerTitle, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
                {stats.rejected} Rejected Transaction{stats.rejected > 1 ? 's' : ''} Awaiting Clarification
              </Text>
              <Text style={[styles.rejectBannerText, { color: isDark ? '#f87171' : '#b91c1c' }]}>
                Instead of submitting a duplicate payment, click on the rejected transaction to chat directly with your owner, clarify details, or upload a new payment screenshot. The owner can approve it right away.
              </Text>
              {filter !== 'rejected' && (
                <Button
                  title="Filter Rejected"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push('/payments?filter=rejected')}
                  style={{ alignSelf: 'flex-start', marginTop: SPACING.sm }}
                />
              )}
            </View>
          </View>
        </Card>
      )}

      {/* ── Owner Payment Options (UPI & Bank Accounts) ── */}
      <PaymentMethodsCard info={payInfo} loading={payInfoLoading} onPreviewQr={setPreviewQr} />

      {allTransactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          message="Your rent payments and proof submissions will appear here."
          action="Pay Rent"
          onAction={() => router.push('/rent')}
        />
      ) : (
        <>
          {/* Transaction History Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <Text style={styles.sectionSub}>Every rent payment and proof submission, with full details</Text>
          </View>

          <SegmentedControl options={filterOptions} value={filter} onChange={setFilter} style={{ marginVertical: SPACING.md }} />

          {filtered.length === 0 ? (
            <EmptyState icon={Receipt} title="Nothing here" message={`No transactions match the "${filter}" filter.`} />
          ) : (
            grouped.map((group) => {
              const approvedTotal = group.items
                .filter((tx) => ['approved', 'paid'].includes(tx.status))
                .reduce((s, tx) => s + (tx.amount || 0), 0);
              const pendingTotal = group.items
                .filter((tx) => tx.status === 'pending')
                .reduce((s, tx) => s + (tx.amount || 0), 0);
              return (
                <View key={group.key} style={styles.group}>
                  <View style={styles.groupHead}>
                    <View style={[styles.groupIcon, { backgroundColor: `${group.color}15` }]}>
                      <group.icon size={15} color={group.color} />
                    </View>
                    <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>{group.label}</Text>
                    <Text style={[styles.groupCount, { color: colors.textTertiary }]}>{group.items.length}</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.groupApproved}>Approved {formatCurrency(approvedTotal)}</Text>
                      {pendingTotal > 0 && <Text style={styles.groupPending}>Pending {formatCurrency(pendingTotal)}</Text>}
                    </View>
                  </View>
                  {group.items.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} onPress={() => setSelected(tx)} />
                  ))}
                </View>
              );
            })
          )}
        </>
      )}

      <TransactionDetail
        tx={selected}
        onClose={() => setSelected(null)}
        onReplySuccess={() => {
          fetchData({ refresh: true });
          setSelected(null);
        }}
      />

      {/* QR Code Zoom Preview */}
      <ModalSheet visible={!!previewQr} onClose={() => setPreviewQr(null)} title={previewQr?.name || 'UPI QR Code'}>
        {previewQr && (
          <View style={{ alignItems: 'center', paddingVertical: SPACING.md }}>
            <Image
              source={{ uri: resolveMediaUrl(previewQr.url) }}
              style={{ width: 260, height: 260, borderRadius: BORDER_RADIUS.md, backgroundColor: '#ffffff' }}
              resizeMode="contain"
            />
            <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: colors.textPrimary }}>
              {previewQr.name || 'Scan to Pay'}
            </Text>
            {previewQr.upiId ? (
              <Text style={{ marginTop: 4, fontSize: FONT_SIZES.sm, color: colors.textSecondary }}>
                UPI ID: {previewQr.upiId}
              </Text>
            ) : null}
          </View>
        )}
      </ModalSheet>

      {error && (
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load transactions"
          message={error}
          action="Retry"
          onAction={handleRefresh}
        />
      )}
    </Screen>
  );
}

function TransactionRow({ tx, onPress }) {
  const { colors, isDark } = useTheme();
  const isProof = tx.kind === 'proof';
  const isPending = tx.status === 'pending';
  const isApproved = ['approved', 'paid'].includes(tx.status); // web: partial not in approved
  const isRejected = tx.status === 'rejected';

  const tone = isPending ? COLORS.warning : isApproved ? COLORS.success : isRejected ? COLORS.danger : COLORS.gray500;
  const StatusIcon = isProof ? (isPending ? Clock : isApproved ? CheckCircle : XCircle) : isApproved ? CheckCircle : Clock;
  const monthLabel = tx.rentMonth && tx.rentYear ? formatMonthYear(tx.rentMonth, tx.rentYear) : null;

  return (
    <Card onPress={onPress} style={styles.txCard}>
      <View style={styles.txTop}>
        <View style={[styles.txIcon, { backgroundColor: `${tone}15` }]}>
          {isProof ? <StatusIcon size={20} color={tone} /> : <IndianRupee size={20} color={tone} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.txTitleRow}>
            <Text style={[styles.txTitle, { color: colors.textPrimary }]}>{isProof ? 'Payment Proof' : 'Rent Payment'}</Text>
            <StatusBadge status={tx.status} />
          </View>
          <Text style={[styles.txMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            {monthLabel ? `${monthLabel} • ` : ''}
            {tx.reference && tx.reference !== '—' ? `[${tx.reference}] • ` : ''}
            {tx.method} • {formatDateTime(tx.date)}
          </Text>
          {!!tx.notes ? (
            <Text style={[styles.txNotes, { color: colors.textSecondary }]} numberOfLines={2}>
              Note: {tx.notes}
            </Text>
          ) : null}
          {!!tx.rejectionReason ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
              <Text style={styles.txRejected} numberOfLines={1}>
                Rejected: {tx.rejectionReason}
              </Text>
              <View style={[styles.chatPill, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff' }]}>
                <MessageSquare size={10} color={isDark ? '#93c5fd' : '#2563eb'} />
                <Text style={[styles.chatPillText, { color: isDark ? '#93c5fd' : '#2563eb' }]}>Chat / Clarify</Text>
              </View>
            </View>
          ) : tx.conversation && tx.conversation.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <MessageSquare size={12} color={isDark ? '#93c5fd' : '#2563eb'} />
              <Text style={[styles.txRef, { color: isDark ? '#93c5fd' : '#2563eb' }]}>
                {tx.conversation.length} message{tx.conversation.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.txAmount, { color: isApproved ? COLORS.success : isPending ? COLORS.warning : isRejected ? COLORS.danger : colors.textPrimary }]}>
            {formatCurrency(tx.amount)}
          </Text>
          {tx.rentAmount && tx.amount !== tx.rentAmount ? (
            <Text style={[styles.txOf, { color: colors.textTertiary }]}>of {formatCurrency(tx.rentAmount)}</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function TransactionDetail({ tx, onClose, onReplySuccess }) {
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const [replyMsg, setReplyMsg] = useState('');
  const [replyShot, setReplyShot] = useState('');
  const [replying, setReplying] = useState(false);
  const [conversation, setConversation] = useState([]);

  useEffect(() => {
    setReplyMsg('');
    setReplyShot('');
    if (tx?.conversation) {
      setConversation(tx.conversation);
    }
  }, [tx?.id]);

  if (!tx) {
    return <ModalSheet visible={false} onClose={onClose} title="Transaction" children={null} />;
  }
  const isProof = tx.kind === 'proof';
  const verifiedByName =
    tx.verifiedBy?.name || tx.verifiedBy?.firstName || (typeof tx.verifiedBy === 'string' ? tx.verifiedBy : null);
  const monthLabel = tx.rentMonth && tx.rentYear ? formatMonthYear(tx.rentMonth, tx.rentYear) : null;
  const screenshot = resolveMediaUrl(tx.screenshot);
  const statusLabel = STATUS_LABELS[tx.status] || tx.status;
  const showThread = isProof && (tx.status === 'rejected' || (tx.conversation && tx.conversation.length > 0));

  const handleSendReply = async () => {
    if (!replyMsg.trim() && !replyShot) {
      toast.error('Please enter a message or attach a screenshot');
      return;
    }
    setReplying(true);
    try {
      // Match web: multipart FormData with message + imageUrl
      const formData = new FormData();
      formData.append('message', replyMsg.trim());
      if (replyShot) {
        formData.append('imageUrl', replyShot);
      }
      await api.post(`/payment-proofs/${tx.proofId}/reply`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Optimistic append
      const newMsg = {
        role: 'tenant',
        message: replyMsg.trim(),
        imageUrl: replyShot || undefined,
        createdAt: new Date().toISOString(),
      };
      setConversation(prev => [...prev, newMsg]);
      toast.success('Clarification sent to owner');
      setReplyMsg('');
      setReplyShot('');
      // Keep modal open, refetch later
      if (onReplySuccess) onReplySuccess();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setReplying(false);
    }
  };

  const handleViewProof = (url) => {
    if (url) Linking.openURL(resolveMediaUrl(url));
  };

  const handleOpenScreenshot = (url) => {
    if (url) Linking.openURL(resolveMediaUrl(url));
  };

  return (
    <ModalSheet visible={!!tx} onClose={onClose} title={isProof ? 'Payment Proof Details' : 'Rent Payment Details'} actions={[{ label: 'Close', variant: 'secondary', onPress: onClose }]}>
      <View style={[styles.detailBanner, { backgroundColor: `${statusColorOf(tx.status)}12` }]}>
        <View style={styles.detailBannerRow}>
          <View>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
            <Text style={[styles.detailStatus, { color: statusColorOf(tx.status) }]}>{statusLabel}</Text>
            {tx.status === 'pending' && <Text style={[styles.detailHint, { color: colors.textSecondary }]}>Owner/manager is verifying this payment</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount</Text>
            <Text style={[styles.detailAmount, { color: colors.textPrimary }]}>{formatCurrency(tx.amount)}</Text>
          </View>
        </View>
      </View>

      <Divider style={{ marginVertical: SPACING.md }} />

      <KeyValue label="Type" value={isProof ? 'Payment Proof' : 'Rent Payment'} />
      {monthLabel ? (
        <View style={styles.rentPeriodRow}>
          <KeyValue label="Rent Period" value={monthLabel} />
          {tx.rentAmount ? <KeyValue label="Rent" value={formatCurrency(tx.rentAmount)} /> : null}
        </View>
      ) : null}
      <KeyValue label="Payment Method" value={tx.method} />
      <KeyValue label="Reference / UTR" value={tx.reference} />
      <KeyValue label={isProof ? 'Submitted At' : 'Paid At'} value={formatDateTime(tx.date)} />
      {tx.verifiedAt ? <KeyValue label="Verified At" value={formatDateTime(tx.verifiedAt)} /> : null}
      {verifiedByName ? <KeyValue label="Verified By" value={verifiedByName} /> : null}

      {isProof && Array.isArray(tx.transactions) && tx.transactions.length > 0 ? (
        <View style={{ marginTop: SPACING.md }}>
          <Text style={[styles.subHeading, { color: colors.textTertiary }]}>Payment Breakdown ({tx.transactions.length} transaction{tx.transactions.length !== 1 ? 's' : ''})</Text>
          {tx.transactions.map((t, i) => (
            <View key={i} style={[styles.breakdownRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.breakdownTitle, { color: colors.textPrimary }]}>
                  #{i + 1} · {METHOD_LABELS[t.method] || t.method || '—'}
                </Text>
                <Text style={[styles.breakdownRef, { color: colors.textTertiary }]} numberOfLines={1}>
                  {t.transactionId || 'No reference'}
                  {t.paidAt ? ` · ${formatDateTime(t.paidAt)}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.breakdownAmount, { color: colors.textPrimary }]}>{formatCurrency(t.amount)}</Text>
                {t.screenshotUrl && (
                  <TouchableOpacity onPress={() => handleViewProof(t.screenshotUrl)} style={styles.viewProofBtn}>
                    <Text style={styles.viewProofBtnText}>View proof</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          {/* Total row */}
          <View style={styles.breakdownTotal}>
            <Text style={styles.breakdownTotalLabel}>Total</Text>
            <Text style={styles.breakdownTotalAmount}>{formatCurrency(tx.transactions.reduce((s, t) => s + (t.amount || 0), 0))}</Text>
          </View>
        </View>
      ) : null}

      {!!tx.notes ? (
        <View style={[styles.noteBox, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.subHeading, { color: colors.textTertiary }]}>Note</Text>
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>{tx.notes}</Text>
        </View>
      ) : null}

      {!!tx.rejectionReason ? (
        <View style={styles.rejectBox}>
          <View style={styles.rejectHead}>
            <MessageSquareWarning size={15} color={COLORS.danger} />
            <Text style={styles.rejectTitle}>Owner rejection reason:</Text>
          </View>
          <Text style={styles.rejectText}>{tx.rejectionReason}</Text>
          {tx.verifiedAt ? <Text style={styles.rejectDate}>Rejected on {formatDateTime(tx.verifiedAt)}</Text> : null}
        </View>
      ) : null}

      {screenshot ? (
        <View style={{ marginTop: SPACING.md }}>
          <Text style={[styles.subHeading, { color: colors.textTertiary }]}>Payment Screenshot</Text>
          <TouchableOpacity onPress={() => handleOpenScreenshot(tx.screenshot)} activeOpacity={0.9}>
            <Image source={{ uri: screenshot }} style={styles.screenshot} resizeMode="contain" />
          </TouchableOpacity>
          <Text style={styles.screenshotCaption}>Click image to open in new tab</Text>
        </View>
      ) : isProof ? (
        <View style={[styles.noShot, { borderColor: colors.border }]}>
          <ImageIcon size={26} color={colors.textTertiary} />
          <Text style={[styles.noShotText, { color: colors.textTertiary }]}>No screenshot was uploaded with this payment proof</Text>
        </View>
      ) : null}

      {/* Conversation Thread */}
      {showThread && (
        <View style={{ marginTop: SPACING.lg }}>
          <View style={styles.threadHeader}>
            <Text style={[styles.subHeading, { color: colors.textTertiary }]}>Clarifications & Discussion with Owner</Text>
            {tx.status === 'rejected' && (
              <View style={styles.awaitingPill}>
                <Text style={styles.awaitingPillText}>Awaiting Clarification</Text>
              </View>
            )}
          </View>
          {(tx.status === 'rejected' || conversation.length > 0) && (
            <Text style={styles.threadExplanation}>
              {tx.status === 'rejected'
                ? 'Send your explanation or attach an updated payment screenshot below. The owner can review and directly approve this transaction, avoiding duplicate entries.'
                : 'Discussion history between you and the owner for this payment proof.'
              }
            </Text>
          )}
          {conversation.length === 0 ? (
            <Text style={styles.emptyThread}>No replies yet</Text>
          ) : (
            conversation.map((msg, i) => {
              const isMe = msg.role === 'tenant' || msg.senderRole === 'tenant' || msg.byRole === 'tenant';
              const roleLabel = msg.role || msg.senderRole || msg.byRole || 'owner';
              const roleColor = roleLabel === 'tenant' ? COLORS.primary : roleLabel === 'owner' ? COLORS.danger : roleLabel === 'manager' ? COLORS.warning : colors.textSecondary;
              return (
                <View key={i} style={styles.chatBubbleWrapper}>
                  <View style={[styles.chatBubble, isMe ? styles.chatMe : styles.chatThem, { backgroundColor: isMe ? (isDark ? '#1e3a8a' : '#dbeafe') : (isDark ? colors.cardSecondary : COLORS.gray100) }]}>
                    <View style={styles.chatHeader}>
                      <View style={styles.chatAuthorRow}>
                        <Text style={[{ color: isMe ? (isDark ? '#93c5fd' : '#1d4ed8') : colors.textSecondary }, styles.chatAuthor]}>
                          {isMe ? 'You' : (msg.senderName || msg.byName || msg.name || 'Owner/Manager')}
                        </Text>
                        <View style={[styles.roleBadge, { backgroundColor: `${roleColor}20`, borderColor: roleColor }]}>
                          <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}</Text>
                        </View>
                      </View>
                      <Text style={[styles.chatTime, { color: colors.textTertiary }]}>{formatDateTime(msg.createdAt)}</Text>
                    </View>
                    {!!msg.message && <Text style={[styles.chatText, { color: colors.textPrimary }]}>{msg.message}</Text>}
                    {!!msg.imageUrl && (
                      <TouchableOpacity onPress={() => handleOpenScreenshot(msg.imageUrl)} style={styles.chatImageWrapper} activeOpacity={0.9}>
                        <Image source={{ uri: resolveMediaUrl(msg.imageUrl) }} style={styles.chatImage} resizeMode="contain" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Clarification / Reply Box */}
      {isProof && (tx.status === 'rejected' || tx.status === 'pending') && (
        <View style={[styles.replyBox, { borderColor: colors.border, backgroundColor: isDark ? colors.cardSecondary : COLORS.gray50 }]}>
          <Text style={[styles.replyBoxTitle, { color: colors.textPrimary }]}>Chat / Clarify with Owner</Text>
          <Text style={[styles.replyBoxSub, { color: colors.textSecondary }]}>
            Send your explanation or attach an updated payment screenshot below. The owner can review and directly approve this transaction, avoiding duplicate entries.
          </Text>
          <TextField
            label="Message"
            value={replyMsg}
            onChangeText={setReplyMsg}
            placeholder="Write a reply..."
            multiline
          />
          <ImageKitUploader
            folder="/chat"
            label="Screenshot (Optional)"
            value={replyShot}
            onChange={setReplyShot}
            helperText="Attach a corrected payment screenshot if needed"
          />
          <Button
            title="Send"
            onPress={handleSendReply}
            loading={replying}
            style={{ marginTop: SPACING.sm }}
          />
        </View>
      )}
    </ModalSheet>
  );
}

function PaymentMethodsCard({ info, loading, onPreviewQr }) {
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key, label) => {
    setCopiedKey(key);
    toast.success(`${label || 'Copied'}: ${text}`);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  if (loading) {
    return (
      <Card style={{ marginBottom: SPACING.md, padding: SPACING.md }}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={{ textAlign: 'center', fontSize: FONT_SIZES.xs, color: colors.textTertiary, marginTop: SPACING.xs }}>
          Loading payment options...
        </Text>
      </Card>
    );
  }

  const upiAccounts = info?.upiAccounts || [];
  const bankAccounts = info?.bankAccounts || [];
  const instructions = info?.paymentInstructions || '';
  const hasAny = upiAccounts.length > 0 || bankAccounts.length > 0 || !!instructions;

  return (
    <Card style={styles.payOptionsCard}>
      <View style={styles.payOptionsHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.payOptionsTitle, { color: colors.textPrimary }]}>Payment Options</Text>
          <Text style={[styles.payOptionsSubtitle, { color: colors.textSecondary }]}>Pay to any account below</Text>
        </View>
      </View>

      {!hasAny ? (
        <Text style={[styles.noPayMethodsText, { color: colors.textSecondary }]}>
          No payment methods have been shared yet. Please contact your property manager.
        </Text>
      ) : (
        <View style={{ gap: SPACING.sm, marginTop: SPACING.sm }}>
          {upiAccounts.map((u, idx) => {
            const qrUri = u.qrUrl ? resolveMediaUrl(u.qrUrl) : null;
            const copyKey = `upi-${idx}`;
            const isCopied = copiedKey === copyKey;
            return (
              <View
                key={copyKey}
                style={[styles.payMethodRow, { backgroundColor: isDark ? colors.cardSecondary : '#f8fafc', borderColor: colors.border }]}
              >
                {qrUri ? (
                  <TouchableOpacity
                    onPress={() => onPreviewQr?.({ url: u.qrUrl, name: u.upiName, upiId: u.upiId })}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: qrUri }} style={styles.qrThumb} resizeMode="cover" />
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.qrPlaceholder, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
                    <QrCode size={22} color={colors.textTertiary} />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={[styles.methodName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {u.upiName || 'UPI'}
                  </Text>
                  <Text style={[styles.methodSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {u.upiId}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleCopy(u.upiId, copyKey, 'UPI ID')}
                  style={[styles.copyPill, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff', borderColor: isDark ? 'rgba(37, 99, 235, 0.4)' : '#bfdbfe' }]}
                >
                  {isCopied ? <Check size={12} color="#2563eb" /> : <Copy size={12} color="#2563eb" />}
                  <Text style={[styles.copyPillText, { color: isDark ? '#93c5fd' : '#2563eb' }]}>
                    {isCopied ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {bankAccounts.map((b, idx) => {
            const copyKey = `bank-${idx}`;
            const isCopied = copiedKey === copyKey;
            const sub = [b.bankName, b.accountType === 'current' ? 'Current Account' : 'Savings Account']
              .filter(Boolean)
              .join(' • ');
            return (
              <View
                key={copyKey}
                style={[styles.bankCard, { backgroundColor: isDark ? colors.cardSecondary : '#f8fafc', borderColor: colors.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.methodName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {b.accountHolderName || 'Bank Transfer'}
                    </Text>
                    {sub ? (
                      <Text style={[styles.methodSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {sub}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCopy(b.accountNumber, copyKey, 'Account Number')}
                    style={[styles.copyPill, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff', borderColor: isDark ? 'rgba(37, 99, 235, 0.4)' : '#bfdbfe' }]}
                  >
                    {isCopied ? <Check size={12} color="#2563eb" /> : <Copy size={12} color="#2563eb" />}
                    <Text style={[styles.copyPillText, { color: isDark ? '#93c5fd' : '#2563eb' }]}>
                      {isCopied ? 'Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.bankGrid}>
                  <View style={[styles.bankFieldBox, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
                    <Text style={[styles.bankFieldLabel, { color: colors.textTertiary }]}>ACCOUNT NUMBER</Text>
                    <Text style={[styles.bankFieldValue, { color: colors.textPrimary }]} numberOfLines={1}>
                      {b.accountNumber}
                    </Text>
                  </View>
                  <View style={[styles.bankFieldBox, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
                    <Text style={[styles.bankFieldLabel, { color: colors.textTertiary }]}>IFSC</Text>
                    <Text style={[styles.bankFieldValue, { color: colors.textPrimary }]} numberOfLines={1}>
                      {b.ifsc}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {instructions ? (
            <View style={[styles.instructionsBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb', borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fef3c7' }]}>
              <Info size={14} color="#d97706" style={{ marginTop: 2 }} />
              <Text style={[styles.instructionsText, { color: isDark ? '#fcd34d' : '#92400e' }]}>
                <Text style={{ fontWeight: 'bold' }}>Instructions: </Text>
                {instructions}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

function statusColorOf(status) {
  if (status === 'pending') return COLORS.warning;
  if (['approved', 'paid', 'partial'].includes(status)) return COLORS.success;
  if (status === 'rejected') return COLORS.danger;
  return COLORS.gray500;
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  statCard: { flex: 1 },
  group: { marginBottom: SPACING.lg },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  groupIcon: { width: 28, height: 28, borderRadius: BORDER_RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  groupCount: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary },
  groupApproved: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.success },
  groupPending: { fontSize: FONT_SIZES.xs, color: COLORS.warning, marginTop: 1 },
  txCard: { marginBottom: SPACING.sm },
  txTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  txIcon: { width: 44, height: 44, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  txTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  txTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary },
  txMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  txRef: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: 2 },
  txRejected: { fontSize: FONT_SIZES.xs, color: COLORS.danger, marginTop: 2 },
  txAmount: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold },
  txOf: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: 2 },
  detailBanner: { borderRadius: BORDER_RADIUS.md, padding: SPACING.md },
  detailBannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailLabel: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textSecondary, textTransform: 'uppercase' },
  detailStatus: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, marginTop: 2 },
  detailHint: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  detailAmount: { fontSize: FONT_SIZES.xxl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary, marginTop: 2 },
  subHeading: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  breakdownTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary },
  breakdownRef: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: 2 },
  breakdownAmount: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  noteBox: { backgroundColor: COLORS.gray50, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginTop: SPACING.md },
  noteText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  rejectBox: {
    backgroundColor: `${COLORS.danger}0F`,
    borderWidth: 1,
    borderColor: `${COLORS.danger}33`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.md,
  },
  rejectHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rejectTitle: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.bold, color: COLORS.danger, textTransform: 'uppercase' },
  rejectText: { fontSize: FONT_SIZES.sm, color: COLORS.dangerDark },
  rejectDate: { fontSize: FONT_SIZES.xs, color: COLORS.danger, marginTop: 4 },
  screenshot: {
    width: '100%',
    height: 220,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray100,
  },
  noShot: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  noShotText: { fontSize: FONT_SIZES.sm, color: COLORS.textTertiary, marginTop: SPACING.sm, textAlign: 'center' },
  rejectBanner: { marginBottom: SPACING.md, borderWidth: 1, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md },
  rejectBannerTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, marginBottom: 2 },
  rejectBannerText: { fontSize: FONT_SIZES.xs, lineHeight: 18 },
  chatPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chatPillText: { fontSize: 10, fontWeight: FONT_WEIGHTS.bold },
  chatBubble: { padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.xs },
  chatMe: { alignSelf: 'flex-end', maxWidth: '85%' },
  chatThem: { alignSelf: 'flex-start', maxWidth: '85%' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm, marginBottom: 2 },
  chatAuthor: { fontSize: 10, fontWeight: FONT_WEIGHTS.bold },
  chatTime: { fontSize: 9 },
  chatText: { fontSize: FONT_SIZES.xs, lineHeight: 17 },
  chatImage: { width: 140, height: 140, borderRadius: BORDER_RADIUS.sm, marginTop: 4 },
  replyBox: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  replyBoxTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, marginBottom: 2 },
  replyBoxSub: { fontSize: FONT_SIZES.xs, marginBottom: SPACING.sm },
  payOptionsCard: { marginBottom: SPACING.md },
  payOptionsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  payOptionsTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold },
  payOptionsSubtitle: { fontSize: FONT_SIZES.xs, marginTop: 2 },
  noPayMethodsText: { fontSize: FONT_SIZES.xs, lineHeight: 18, marginTop: SPACING.xs },
  payMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  qrThumb: { width: 52, height: 52, borderRadius: BORDER_RADIUS.sm, backgroundColor: '#ffffff' },
  qrPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodName: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold },
  methodSub: { fontSize: FONT_SIZES.xs, marginTop: 2 },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  copyPillText: { fontSize: 11, fontWeight: FONT_WEIGHTS.bold },
  bankCard: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  bankGrid: { flexDirection: 'row', gap: SPACING.xs },
  bankFieldBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  bankFieldLabel: { fontSize: 9, fontWeight: FONT_WEIGHTS.bold, letterSpacing: 0.5 },
  bankFieldValue: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.bold, marginTop: 2 },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  instructionsText: { flex: 1, fontSize: 11, lineHeight: 16 },
  // New styles for web parity
  sectionHeader: { marginTop: SPACING.lg, marginBottom: SPACING.md, paddingHorizontal: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  sectionSub: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  txNotes: { fontSize: FONT_SIZES.xs, marginTop: 2 },
  rentPeriodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  viewProofBtn: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#eff6ff', borderRadius: 4 },
  viewProofBtnText: { fontSize: 10, fontWeight: '600', color: '#2563eb' },
  breakdownTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  breakdownTotalLabel: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  breakdownTotalAmount: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  threadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  awaitingPill: { backgroundColor: '#fffbeb', borderRadius: BORDER_RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  awaitingPillText: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: '#b45309' },
  threadExplanation: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: SPACING.md, lineHeight: 18 },
  emptyThread: { textAlign: 'center', color: COLORS.textTertiary, paddingVertical: SPACING.md },
  chatBubbleWrapper: { marginBottom: SPACING.xs },
  chatAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  roleBadgeText: { fontSize: 8, fontWeight: '700' },
  chatImageWrapper: { marginTop: 4 },
  screenshotCaption: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, textAlign: 'center', marginTop: SPACING.xs },
});
