import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import {
  CreditCard,
  Wallet,
  Info,
  CheckCircle,
  FileText,
  Zap,
  Lightbulb,
  Home,
  Building2,
  MessageSquare,
  Check,
} from 'lucide-react-native';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import { formatCurrency, formatDateTime } from '../../../lib/format';
import { resolveMediaUrl } from '../../../lib/api';
import {
  Screen,
  TenantPageHeader,
  Card,
  Button,
  ModalSheet,
  TextField,
  EmptyState,
  CardSkeleton,
  ImageKitUploader,
} from '../../../components';
import PaymentSheet from '../../../components/tenants/PaymentSheet';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TYPE_META = {
  rent: { label: 'Rent', icon: Home, color: '#2563eb' },
  deposit: { label: 'Security Deposit', icon: Building2, color: '#10b981' },
  fine: { label: 'Fine', icon: Zap, color: '#ef4444' },
  electricity: { label: 'Electricity', icon: Lightbulb, color: '#f59e0b' },
  custom: { label: 'Charge', icon: FileText, color: '#8b5cf6' },
};

function parseDuesData(d, pRes) {
  const pList = Array.isArray(pRes) ? pRes : pRes?.data || pRes?.proofs || [];
  const rejectedProofs = pList.filter((p) => p.status === 'rejected');
  const list = [];

  const rents = Array.isArray(d?.unpaidRents) ? d.unpaidRents : [];
  const missing = Array.isArray(d?.missingRents) ? d.missingRents : [];
  [...rents, ...missing].forEach((r) => {
    const pending = Number(r.pendingAmount ?? r.rentAmount ?? 0);
    if (pending <= 0) return;
    list.push({
      id: r._id || `rent-${r.year}-${r.month}`,
      type: 'rent',
      rentId: r._id,
      title: `Rent — ${MONTHS[r.month] || r.month} ${r.year}`,
      subtitle: r.isMissing ? 'Month not yet billed' : (r.status || 'unpaid').replace('_', ' '),
      amount: pending,
      rentAmount: Number(r.rentAmount) || 0,
      lateFee: Number(r.lateFeeAccrued) || 0,
      month: r.month,
      year: r.year,
      hasRejectedProof: !!r.hasRejectedProof,
      rejectedProofId: r.rejectedProofId || null,
      rejectionReason: r.rejectionReason || null,
      clarificationStatus: r.clarificationStatus || null,
      conversation: r.conversation || [],
    });
  });

  const depositPending = Math.max(0, Number(d?.unpaidSecurityDeposit) || 0);
  if (depositPending > 0) {
    const depRej = d?.depositRejectedInfo;
    list.push({
      id: 'security-deposit',
      type: 'deposit',
      title: 'Security Deposit',
      subtitle: `${formatCurrency(Number(d?.collectedSecurityDeposit) || 0)} collected of ${formatCurrency(
        Number(d?.expectedSecurityDeposit) || 0
      )}`,
      amount: depositPending,
      rentAmount: 0,
      lateFee: 0,
      hasRejectedProof: !!depRej?.hasRejectedProof,
      rejectedProofId: depRej?.rejectedProofId || null,
      rejectionReason: depRej?.rejectionReason || null,
      clarificationStatus: depRej?.clarificationStatus || null,
      conversation: depRej?.conversation || [],
    });
  }

  const penalties = Array.isArray(d?.payments) ? d.payments : [];
  penalties.forEach((p) => {
    if (p.status !== 'pending' && p.status !== 'rejected') return;
    list.push({
      id: p._id || p.id,
      type: p.type || 'custom',
      paymentId: p._id || p.id,
      title: p.title || p.type || 'Charge',
      subtitle: p.status === 'rejected' ? 'Payment rejected' : 'Penalty / charge',
      amount: Number(p.amount) || 0,
      rentAmount: 0,
      lateFee: 0,
      hasRejectedProof: p.status === 'rejected' || !!p.hasRejectedProof,
      rejectedProofId: p.rejectedProofId || p._id || p.id,
      rejectionReason: p.rejectionReason || null,
      clarificationStatus: p.clarificationStatus || null,
      conversation: p.conversation || [],
    });
  });

  return { list, rejectedProofs };
}

export default function DuesScreen() {
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const cachedD = tenantService.getCachedDues();
  const cachedP = tenantService.getCachedPaymentProofs({ limit: 50 });
  const initialData = useMemo(() => parseDuesData(cachedD, cachedP), []);

  const [dues, setDues] = useState(initialData.list);
  const [rejectedProofsList, setRejectedProofsList] = useState(initialData.rejectedProofs);
  const [loading, setLoading] = useState(!cachedD && initialData.list.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState([]);

  // Payment State — everything happens inside the shared PaymentSheet.
  const [payOpen, setPayOpen] = useState(false);

  // Clarification State
  const [clarificationTarget, setClarificationTarget] = useState(null);
  const [clarificationMsg, setClarificationMsg] = useState('');
  const [clarificationShot, setClarificationShot] = useState('');
  const [clarificationLoading, setClarificationLoading] = useState(false);

  const fetchDues = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedDues()) setLoading(true);
      try {
        const [d, pRes] = await Promise.all([
          tenantService.getMyDues({}, { bypassCache: refresh }),
          tenantService.getPaymentProofs({ limit: 50 }, { bypassCache: refresh }).catch(() => null),
        ]);
        const parsed = parseDuesData(d, pRes);
        setDues(parsed.list);
        setRejectedProofsList(parsed.rejectedProofs);
      } catch (e) {
        if (!tenantService.getCachedDues()) {
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
    fetchDues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(() => dues.reduce((s, d) => s + (d.amount || 0), 0), [dues]);
  const selectedTotal = useMemo(
    () => dues.filter((d) => selected.includes(d.id)).reduce((s, d) => s + (d.amount || 0), 0),
    [dues, selected]
  );

  const rejectedCount = useMemo(() => {
    const fromDues = dues.filter((d) => d.hasRejectedProof).length;
    return Math.max(fromDues, rejectedProofsList.length);
  }, [dues, rejectedProofsList]);

  const grouped = useMemo(
    () =>
      dues.reduce((acc, d) => {
        const key = d.type === 'rent' ? 'rent' : d.type === 'deposit' ? 'deposit' : 'penalty';
        if (!acc[key]) acc[key] = [];
        acc[key].push(d);
        return acc;
      }, {}),
    [dues]
  );

  const sections = [
    { key: 'rent', label: 'Rent', icon: Home, color: '#2563eb' },
    { key: 'deposit', label: 'Security Deposit', icon: Building2, color: '#10b981' },
    { key: 'penalty', label: 'Charges & Penalties', icon: FileText, color: '#8b5cf6' },
  ].filter((s) => (grouped[s.key] || []).length > 0);

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const buildItems = () =>
    dues
      .filter((d) => selected.includes(d.id))
      .map((d) => {
        if (d.type === 'rent') return { type: 'rent', rentId: d.rentId, month: d.month, year: d.year, amount: d.amount };
        if (d.type === 'deposit') return { type: 'deposit', amount: d.amount };
        return { type: 'penalty', paymentId: d.paymentId, amount: d.amount };
      });

  const openPay = () => {
    if (selected.length === 0) return;
    setPayOpen(true);
  };

  // The one configuration the shared PaymentSheet is opened with.
  const payConfig = useMemo(
    () => ({
      title: 'Pay Dues',
      summary: `${selected.length} due item${selected.length !== 1 ? 's' : ''} selected`,
      amount: selectedTotal,
      items: buildItems(),
      showOnline: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dues, selected]
  );

  // ── Clarification Flow ─────────────────────────────────
  const submitClarification = async () => {
    if (!clarificationMsg.trim() && !clarificationShot) {
      toast.error('Please enter a message or upload proof');
      return;
    }
    setClarificationLoading(true);
    try {
      await tenantService.replyPaymentProof(clarificationTarget.rejectedProofId, {
        message: clarificationMsg.trim(),
        screenshotUrl: clarificationShot || undefined,
      });
      toast.success('Clarification sent to owner. The owner will review and can directly approve this transaction.');
      setClarificationTarget(null);
      setClarificationMsg('');
      setClarificationShot('');
      fetchDues({ refresh: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setClarificationLoading(false);
    }
  };

  if (loading && dues.length === 0) {
    return (
      <Screen scroll={false}>
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <TenantPageHeader title="Dues" subtitle="Everything you need to pay" icon={Wallet} iconTone="rose" />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
              <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                Loading your dues…
              </Text>
            </View>
            <CardSkeleton count={3} />
          </ScrollView>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDues({ refresh: true })}
              tintColor={isDark ? '#f8fafc' : '#2563eb'}
              colors={['#2563eb']}
            />
          }
        >
          <TenantPageHeader title="Dues" subtitle="Everything you need to pay" icon={Wallet} iconTone="rose" />

          {/* ── Rejected Proofs Alert Banner ─────────────────── */}
          {rejectedCount > 0 && (
            <Card style={[styles.rejectBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }}>
                <MessageSquare size={18} color="#ef4444" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rejectBannerTitle, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
                    You have {rejectedCount} rejected payment{rejectedCount > 1 ? 's' : ''} awaiting clarification
                  </Text>
                  <Text style={[styles.rejectBannerText, { color: isDark ? '#f87171' : '#b91c1c' }]}>
                    Before submitting a duplicate payment, chat with your owner in Transactions to clarify details or upload a revised receipt.
                  </Text>
                  <Button
                    title="Review & Clarify"
                    size="sm"
                    variant="outline"
                    onPress={() => router.push('/payments')}
                    style={{ alignSelf: 'flex-start', marginTop: SPACING.sm }}
                  />
                </View>
              </View>
            </Card>
          )}

          {dues.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="All clear!"
              message="You have no pending dues right now."
              action="Go to Transactions"
              onAction={() => router.push('/payments')}
            />
          ) : (
            <>
              {/* ── Total Outstanding Banner ───────────────────── */}
              <View style={[styles.outstandingCard, { backgroundColor: total > 0 ? '#b91c1c' : '#059669' }]}>
                <View style={styles.outstandingBadge}>
                  <Text style={styles.outstandingBadgeText}>TOTAL OUTSTANDING</Text>
                </View>
                <Text style={styles.outstandingAmount}>{formatCurrency(total)}</Text>
                <Text style={styles.outstandingSub}>
                  {dues.length} pending item{dues.length !== 1 ? 's' : ''} • Settle via UPI or Cash
                </Text>
              </View>

              {/* ── Grouped Due Sections ───────────────────────── */}
              {sections.map((section) => {
                const items = grouped[section.key];
                return (
                  <View key={section.key} style={styles.sectionWrap}>
                    <View style={styles.sectionHeader}>
                      <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{section.label}</Text>
                      <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>({items.length})</Text>
                    </View>

                    {items.map((item) => {
                      const isSelected = selected.includes(item.id);
                      return (
                        <DueItem
                          key={item.id}
                          due={item}
                          selected={isSelected}
                          onToggle={() => toggle(item.id)}
                          onClarify={() => {
                            setClarificationTarget(item);
                            setClarificationMsg('');
                            setClarificationShot('');
                          }}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* ── Bottom Pay Bar ───────────────────────────────── */}
        {dues.length > 0 && (
          <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.bottomLabel, { color: colors.textSecondary }]}>
                {selected.length > 0 ? `${selected.length} items selected` : 'Select dues to pay'}
              </Text>
              <Text style={[styles.bottomAmount, { color: colors.textPrimary }]}>
                {formatCurrency(selectedTotal)}
              </Text>
            </View>
            <Button
              title="Pay Dues"
              icon={CreditCard}
              disabled={selected.length === 0}
              onPress={openPay}
              style={{ minWidth: 140 }}
            />
          </View>
        )}
      </View>

      {/* ── Payment Sheet (shared with Rent & Dashboard) ─── */}
      <PaymentSheet
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={() => {
          setSelected([]);
          fetchDues({ refresh: true });
        }}
        target={payConfig}
      />

      {/* ── Clarification Modal ──────────────────────────── */}
      <ModalSheet
        visible={!!clarificationTarget}
        onClose={() => setClarificationTarget(null)}
        title="Payment Clarification"
      >
        {clarificationTarget && (
          <View style={{ gap: SPACING.md }}>
            {clarificationTarget.rejectionReason && (
              <View style={[styles.rejectReasonBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca' }]}>
                <Text style={[styles.rejectReasonTitle, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
                  Owner Rejection Reason:
                </Text>
                <Text style={[styles.rejectReasonText, { color: isDark ? '#f87171' : '#b91c1c' }]}>
                  {clarificationTarget.rejectionReason}
                </Text>
              </View>
            )}

            {clarificationTarget.clarificationStatus === 'clarification_sent' && (
              <View style={[styles.clarifyStatusBanner, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff', borderColor: isDark ? 'rgba(37, 99, 235, 0.3)' : '#bfdbfe' }]}>
                <Info size={15} color="#2563eb" />
                <Text style={[styles.clarifyStatusText, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
                  Clarification sent · Awaiting owner review
                </Text>
              </View>
            )}

            <Text style={[styles.clarifyHint, { color: colors.textSecondary }]}>
              Clarify details or attach a revised screenshot. The owner can review and directly approve this transaction without requiring duplicate payment.
            </Text>

            {Array.isArray(clarificationTarget.conversation) && clarificationTarget.conversation.length > 0 && (
              <View style={{ gap: SPACING.xs, marginVertical: SPACING.xs }}>
                <Text style={[styles.subGroupHeading, { color: colors.textSecondary }]}>
                  Conversation History ({clarificationTarget.conversation.length})
                </Text>
                {clarificationTarget.conversation.map((msg, i) => {
                  const isMe = msg.senderRole === 'tenant' || msg.byRole === 'tenant';
                  return (
                    <View
                      key={i}
                      style={[
                        styles.chatBubble,
                        isMe ? styles.chatMe : styles.chatThem,
                        {
                          backgroundColor: isMe
                            ? (isDark ? '#1e3a8a' : '#dbeafe')
                            : (isDark ? colors.cardSecondary : COLORS.gray100),
                        },
                      ]}
                    >
                      <View style={styles.chatHeader}>
                        <Text style={[styles.chatSender, { color: isMe ? (isDark ? '#93c5fd' : '#1e40af') : colors.textPrimary }]}>
                          {isMe ? 'You' : msg.senderName || 'Owner'}
                        </Text>
                        {msg.createdAt ? (
                          <Text style={[styles.chatTime, { color: colors.textTertiary }]}>
                            {formatDateTime(msg.createdAt)}
                          </Text>
                        ) : null}
                      </View>
                      {msg.message ? (
                        <Text style={[styles.chatMsg, { color: colors.textPrimary }]}>{msg.message}</Text>
                      ) : null}
                      {msg.screenshotUrl ? (
                        <Image source={{ uri: resolveMediaUrl(msg.screenshotUrl) }} style={styles.chatScreenshot} resizeMode="contain" />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            <TextField
              label="Clarification Message"
              value={clarificationMsg}
              onChangeText={setClarificationMsg}
              placeholder="Type your explanation or transaction details..."
              multiline
            />

            <ImageKitUploader
              folder="/tenants/dues"
              label="Revised Screenshot (Optional)"
              value={clarificationShot}
              onChange={setClarificationShot}
              helperText="Upload corrected payment screenshot"
            />

            <Button
              title="Send Clarification to Owner"
              onPress={submitClarification}
              loading={clarificationLoading}
              fullWidth
            />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

function DueItem({ due, selected, onToggle, onClarify }) {
  const { colors, isDark } = useTheme();
  const meta = TYPE_META[due.type] || TYPE_META.custom;

  return (
    <Card
      onPress={onToggle}
      style={[
        styles.dueCard,
        selected && [styles.dueCardSelected, { borderColor: '#2563eb' }],
      ]}
    >
      <View style={styles.dueMainRow}>
        <View style={[styles.dueIcon, { backgroundColor: `${meta.color}15` }]}>
          <meta.icon size={20} color={meta.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.dueTitle, { color: colors.textPrimary }]}>{due.title}</Text>
          <Text style={[styles.dueSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {due.subtitle}
            {due.lateFee > 0 ? ` • Late fee ${formatCurrency(due.lateFee)}` : ''}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', marginRight: SPACING.sm }}>
          <Text style={[styles.dueAmount, { color: colors.textPrimary }]}>{formatCurrency(due.amount)}</Text>
          {due.rentAmount > 0 && due.amount !== due.rentAmount ? (
            <Text style={[styles.dueOf, { color: colors.textTertiary }]}>of {formatCurrency(due.rentAmount)}</Text>
          ) : null}
        </View>

        <View
          style={[
            styles.checkbox,
            { borderColor: isDark ? colors.borderStrong : COLORS.gray300 },
            selected && styles.checkboxOn,
          ]}
        >
          {selected && <Check size={14} color="#ffffff" strokeWidth={2.5} />}
        </View>
      </View>

      {/* Rejected Proof / Clarification Pill */}
      {due.hasRejectedProof && (
        <View style={[styles.dueRejectFooter, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', borderTopColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dueRejectTitle, { color: '#ef4444' }]}>
              {due.clarificationStatus === 'clarification_sent'
                ? 'Clarification sent • Awaiting review'
                : 'Clarification needed'}
            </Text>
            {due.rejectionReason && (
              <Text style={[styles.dueRejectReason, { color: colors.textSecondary }]} numberOfLines={1}>
                {due.rejectionReason}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.clarifyBtn}
            onPress={(e) => {
              e.stopPropagation();
              onClarify?.();
            }}
          >
            <Text style={styles.clarifyBtnText}>Clarify</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: 100 },
  rejectBanner: { marginBottom: SPACING.md, borderWidth: 1, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md },
  rejectBannerTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, marginBottom: 2 },
  rejectBannerText: { fontSize: FONT_SIZES.xs, lineHeight: 18 },
  outstandingCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  outstandingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: 6,
  },
  outstandingBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  outstandingAmount: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  outstandingSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 4,
  },
  sectionWrap: { marginBottom: SPACING.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold },
  sectionCount: { fontSize: FONT_SIZES.sm },
  dueCard: { marginBottom: SPACING.sm, padding: 0, overflow: 'hidden' },
  dueCardSelected: { borderWidth: 2 },
  dueMainRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
  dueIcon: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
  dueTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold },
  dueSub: { fontSize: FONT_SIZES.xs, marginTop: 2 },
  dueAmount: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold },
  dueOf: { fontSize: 10, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  dueRejectFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  dueRejectTitle: { fontSize: 11, fontWeight: '700' },
  dueRejectReason: { fontSize: 11, marginTop: 1 },
  clarifyBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clarifyBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderTopWidth: 1,
    elevation: 10,
  },
  bottomLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  bottomAmount: { fontSize: FONT_SIZES.lg, fontWeight: '800' },
  payHeaderBox: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  payHeaderLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  payHeaderAmount: { fontSize: 28, fontWeight: '800', marginVertical: 2 },
  payHeaderSub: { fontSize: 12 },
  promptText: { fontSize: FONT_SIZES.sm, fontWeight: '600', marginBottom: SPACING.sm },
  methodCardsRow: { flexDirection: 'row', gap: SPACING.sm },
  methodCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  methodIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  methodCardTitle: { fontSize: FONT_SIZES.md, fontWeight: '700' },
  methodCardSub: { fontSize: 10.5, textAlign: 'center', marginTop: 2 },
  infoBanner: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  infoBannerTitle: { fontSize: FONT_SIZES.xs, fontWeight: '700' },
  infoBannerText: { flex: 1, fontSize: 12, lineHeight: 17 },
  upiLoadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: SPACING.md },
  upiLoadingText: { fontSize: 12 },
  upiActionWrap: { marginBottom: SPACING.md },
  upiIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  upiIdText: { fontSize: 12 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyBtnText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
  backMethodBtn: { paddingVertical: SPACING.sm, alignItems: 'center' },
  backMethodText: { fontSize: 12, fontWeight: '600' },
  payeeSelectLabel: { fontSize: FONT_SIZES.xs, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  noPayeeText: { fontSize: 12, paddingVertical: SPACING.sm },
  payeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
  },
  payeeName: { fontSize: FONT_SIZES.sm, fontWeight: '700' },
  payeeRole: { fontSize: 11, marginTop: 2 },
  payeeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashOtpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  resendOtpText: { fontSize: 12, fontWeight: '700' },
  changePayeeText: { fontSize: 12 },
  rejectReasonBox: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm },
  rejectReasonTitle: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  rejectReasonText: { fontSize: 12, lineHeight: 17 },
  clarifyHint: { fontSize: 12, lineHeight: 18 },
  clarifyStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  clarifyStatusText: { fontSize: 12, fontWeight: '600' },
  subGroupHeading: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  chatBubble: { padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.xs },
  chatMe: { alignSelf: 'flex-end', maxWidth: '85%' },
  chatThem: { alignSelf: 'flex-start', maxWidth: '85%' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm, marginBottom: 2 },
  chatSender: { fontSize: 10, fontWeight: '700' },
  chatTime: { fontSize: 9 },
  chatMsg: { fontSize: 12, lineHeight: 17 },
  chatScreenshot: { width: 140, height: 140, borderRadius: BORDER_RADIUS.sm, marginTop: 4 },
});
