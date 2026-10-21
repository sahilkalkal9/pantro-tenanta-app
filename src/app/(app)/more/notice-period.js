import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import {
  LogOut, Clock, CheckCircle2, XCircle, Send, MessageSquareWarning, HandCoins, ImageUp,
} from 'lucide-react-native';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import { resolveMediaUrl } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/format';
import {
  Screen, TenantPageHeader, Card, Button, Badge, TextField, Divider, KeyValue,
  EmptyState, LoadingState, CardSkeleton, ConfirmModal, PantroLoader,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

const STATUS_META = {
  pending: { label: 'Pending', color: COLORS.warning },
  approved: { label: 'Approved', color: COLORS.success },
  rejected: { label: 'Rejected', color: COLORS.danger },
  cancelled: { label: 'Cancelled', color: COLORS.gray500 },
};

export default function NoticePeriodScreen() {
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const cachedReqs = tenantService.getCachedNoticePeriod();
  const [requests, setRequests] = useState(cachedReqs || []);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(!cachedReqs);
  const [refreshing, setRefreshing] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const fetchAll = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedNoticePeriod()) setLoading(true);
      try {
        const [reqRes, refundRes] = await Promise.allSettled([
          tenantService.getMyNoticePeriodRequests({ bypassCache: refresh }),
          tenantService.getPendingRefundConfirmations(),
        ]);
        if (reqRes.status === 'fulfilled') setRequests(Array.isArray(reqRes.value) ? reqRes.value : []);
        if (refundRes.status === 'fulfilled') setRefunds(Array.isArray(refundRes.value) ? refundRes.value : []);
      } catch (e) {
        if (!tenantService.getCachedNoticePeriod()) {
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
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      await tenantService.submitNoticePeriodRequest({ reason: reason.trim() });
      toast.success('Notice request submitted');
      setReason('');
      fetchAll({ refresh: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRefund = async () => {
    if (!confirmTarget) return;
    setConfirming(true);
    try {
      await tenantService.confirmRefund(confirmTarget._id || confirmTarget.id);
      toast.success('Refund confirmed — thank you for your stay!');
      setConfirmTarget(null);
      fetchAll({ refresh: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setConfirming(false);
    }
  };

  if (loading && requests.length === 0) {
    return (
      <Screen>
        <TenantPageHeader title="Notice Period" subtitle="Submit a request to vacate" icon={LogOut} iconTone="rose" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
          <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
            Loading notice requests…
          </Text>
        </View>
        <CardSkeleton count={2} />
      </Screen>
    );
  }

  const latest = requests[0] || null;
  const canSubmit = !latest || ['rejected', 'cancelled'].includes(latest.status);

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchAll({ refresh: true })}>
      <TenantPageHeader title="Notice Period" subtitle="Submit a request to vacate" icon={LogOut} iconTone="rose" />

      {refunds.map((ref) => (
        <Card key={ref._id || ref.id} style={[styles.refundCard, { borderLeftColor: COLORS.success }]}>
          <View style={styles.refundRow}>
            <HandCoins size={24} color={COLORS.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Refund Proof Received</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                Owner has submitted proof of your {formatCurrency(Number(ref.refundAmount) || 0)} security deposit refund.
              </Text>
              {!!ref.refundTransactionId && (
                <KeyValue label="Transaction" value={ref.refundTransactionId} />
              )}
              {!!ref.refundProofUrl && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(resolveMediaUrl(ref.refundProofUrl))}
                  style={styles.refundProofLink}
                  activeOpacity={0.8}
                >
                  <ImageUp size={14} color="#2563eb" />
                  <Text style={styles.refundProofText}>View Refund Proof</Text>
                </TouchableOpacity>
              )}
              {!!ref.refundSubmittedAt && (
                <Text style={[styles.smallMuted, { color: colors.textTertiary }]}>Submitted on {formatDate(ref.refundSubmittedAt)}</Text>
              )}
              <Button
                title="Confirm — I Received the Refund"
                icon={CheckCircle2}
                size="sm"
                style={{ marginTop: SPACING.sm }}
                onPress={() => setConfirmTarget(ref)}
              />
            </View>
          </View>
        </Card>
      ))}

      {latest ? (
        <Card style={[styles.card, { borderLeftWidth: 4, borderLeftColor: (STATUS_META[latest.status] || {}).color || COLORS.gray400 }]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Current Request</Text>
            <Badge label={(STATUS_META[latest.status] || { label: latest.status }).label} color={(STATUS_META[latest.status] || {}).color} />
          </View>
          <KeyValue label="Submitted" value={formatDate(latest.createdAt)} />
          {!!latest.noticeEndDate && <KeyValue label="Notice End" value={formatDate(latest.noticeEndDate)} />}
          {Number(latest.refundAmount) > 0 && (
            <KeyValue label="Deposit Refund" value={formatCurrency(Number(latest.refundAmount))} valueColor={COLORS.success} />
          )}
          {!!latest.reason && <Text style={[styles.reason, { color: colors.textSecondary }]}>Reason: {latest.reason}</Text>}
          {!!latest.rejectionReason && <Text style={styles.rejected}>Rejected: {latest.rejectionReason}</Text>}
          {!!latest.approvedAt && <Text style={styles.approved}>Approved on {formatDate(latest.approvedAt)}</Text>}
          {!!latest.refundConfirmed && (
            <Text style={styles.approved}>Refund confirmed on {formatDate(latest.refundConfirmedAt)}</Text>
          )}
        </Card>
      ) : (
        <EmptyState
          icon={LogOut}
          title="No notice submitted"
          message="You haven't submitted any notice period request yet."
        />
      )}

      {canSubmit && (
        <Card style={styles.card}>
          <View style={styles.formHead}>
            <MessageSquareWarning size={18} color={colors.textSecondary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Submit Notice Request</Text>
          </View>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Once approved, your security deposit will be refunded.</Text>
          <Divider style={{ marginVertical: SPACING.md }} />
          <TextField
            label="Reason for leaving (optional)"
            value={reason}
            onChangeText={setReason}
            placeholder="Tell your owner why you're leaving..."
            multiline
          />
          <Button title="Submit Notice Request" icon={Send} onPress={submit} loading={submitting} fullWidth />
        </Card>
      )}

      {latest?.status === 'approved' && !latest.refundConfirmed && (
        <View style={[styles.banner, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : `${COLORS.warning}12`, borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : `${COLORS.warning}40` }]}>
          <Clock size={20} color={COLORS.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: COLORS.warning }]}>Notice Approved — Awaiting Refund</Text>
            <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
              Your notice has been approved. Waiting for the owner to submit refund proof.
            </Text>
          </View>
        </View>
      )}

      {latest?.refundConfirmed && (
        <View style={[styles.banner, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : `${COLORS.success}12`, borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : `${COLORS.success}40` }]}>
          <CheckCircle2 size={20} color={COLORS.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: COLORS.success }]}>All Done!</Text>
            <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
              Refund confirmed and your account has been deactivated. Thank you for your stay!
            </Text>
          </View>
        </View>
      )}

      {latest?.status === 'rejected' && (
        <View style={[styles.banner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : `${COLORS.danger}0F`, borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : `${COLORS.danger}40` }]}>
          <XCircle size={20} color={COLORS.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: COLORS.danger }]}>Notice Rejected</Text>
            <Text style={[styles.bannerText, { color: colors.textSecondary }]}>Your notice request was rejected. You can submit a new request.</Text>
          </View>
        </View>
      )}

      <ConfirmModal
        visible={!!confirmTarget}
        title="Confirm Refund Received?"
        message="Confirm that you have received your security deposit refund. This will deactivate your account."
        confirmLabel="Yes, I received it"
        onConfirm={confirmRefund}
        onCancel={() => setConfirmTarget(null)}
        loading={confirming}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  cardSub: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  refundCard: { borderLeftWidth: 4, marginBottom: SPACING.md },
  refundRow: { flexDirection: 'row', gap: SPACING.md },
  smallMuted: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: SPACING.xs },
  reason: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
  rejected: { fontSize: FONT_SIZES.sm, color: COLORS.danger, marginTop: SPACING.sm },
  approved: { fontSize: FONT_SIZES.sm, color: COLORS.success, marginTop: SPACING.sm },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  banner: {
    flexDirection: 'row',
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  bannerTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold },
  bannerText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  refundProofLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
    paddingVertical: 4,
  },
  refundProofText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
});
