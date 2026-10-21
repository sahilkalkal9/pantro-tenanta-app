import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, CheckCircle, MessageSquare, X } from 'lucide-react-native';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import { formatDateTime } from '../../../lib/format';
import { resolveMediaUrl } from '../../../lib/api';
import {
  Screen, Header, Card, Button, Badge, Divider, EmptyState, ConfirmModal,
  TenantPageHeader, Skeleton,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

const CATEGORY_EMOJI = {
  Electricity: '⚡', Water: '💧', Food: '🍽️', Cleaning: '🧹', WiFi: '📶',
  Room: '🛏️', Bathroom: '🚿', Security: '🔒', Furniture: '🪑', Other: '📋',
};

const STATUS_STEPS = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_META = {
  open: { label: 'Open' },
  in_progress: { label: 'In Progress' },
  resolved: { label: 'Resolved' },
  closed: { label: 'Closed' },
};

// Per-priority pill styles from the web panel (border/bg/text colors).
const priorityPillColors = (priority, isDark) => {
  const map = {
    urgent: { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.25)', text: isDark ? '#fda4af' : '#be123c' },
    high: { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.25)', text: isDark ? '#fcd34d' : '#b45309' },
    medium: { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.25)', text: isDark ? '#7dd3fc' : '#0369a1' },
  };
  return map[priority] || {
    bg: 'rgba(100, 116, 139, 0.1)',
    border: 'rgba(100, 116, 139, 0.2)',
    text: isDark ? '#cbd5e1' : '#475569',
  };
};

export default function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams();
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const cachedList =
    tenantService.getCachedComplaints({ page: 1, limit: 10 }) ||
    tenantService.getCachedComplaints({}) ||
    tenantService.getCachedComplaints({ page: 1, limit: 200 }) || [];
  const cachedMatch = Array.isArray(cachedList)
    ? cachedList.find((c) => String(c._id || c.id) === String(id))
    : null;

  const [complaint, setComplaint] = useState(cachedMatch);
  const [loading, setLoading] = useState(!cachedMatch);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchComplaint = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!cachedMatch) setLoading(true);
      setError('');
      try {
        const res = await tenantService.getComplaintById(id);
        setComplaint(res);
      } catch (e) {
        if (!cachedMatch) {
          setError(getErrorMessage(e));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, cachedMatch]
  );

  useEffect(() => {
    fetchComplaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleClose = async () => {
    setClosing(true);
    try {
      await tenantService.updateComplaintStatus(id, 'closed');
      toast.success('Complaint marked as closed');
      setConfirmClose(false);
      fetchComplaint({ refresh: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setClosing(false);
    }
  };

  if (loading && !complaint) {
    // Matches the web pulse card: header + skeleton lines (not a full-screen loader).
    return (
      <Screen>
        <TenantPageHeader title="Complaint Details" icon={MessageSquare} iconTone="amber" />
        <Card>
          <View style={styles.skeletonStack}>
            <Skeleton variant="text" style={{ width: '66%', height: 24, borderRadius: 6 }} />
            <Skeleton variant="text" style={{ width: '25%', height: 12 }} />
            <Skeleton variant="text" style={{ height: 16 }} />
            <Skeleton variant="text" style={{ width: '75%', height: 16 }} />
          </View>
        </Card>
      </Screen>
    );
  }

  if (error && !complaint) {
    return (
      <Screen>
        <TenantPageHeader title="Complaint Details" icon={MessageSquare} iconTone="amber" />
        <EmptyState
          icon={AlertTriangle}
          title={error ? 'Failed to load complaint' : 'Complaint not found'}
          message={error || 'There is nothing to show here yet.'}
        />
      </Screen>
    );
  }

  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === complaint?.status);
  const meta = STATUS_META[complaint?.status] || STATUS_META.open;
  const canClose = complaint?.status !== 'closed' && complaint?.status !== 'resolved';
  const pill = priorityPillColors(complaint?.priority, isDark);

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchComplaint({ refresh: true })}>
      <TenantPageHeader title="Complaint Details" icon={MessageSquare} iconTone="amber" />

      <Card>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.categoryTile,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : COLORS.gray200,
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : COLORS.white,
              },
            ]}
          >
            <Text style={styles.categoryEmoji}>{CATEGORY_EMOJI[complaint.category] || '📋'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleTop}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                {complaint.title}
              </Text>
              {/* Web Badge falls back to the slate/default variant for complaint statuses */}
              <Badge
                label={meta.label}
                color={isDark ? '#cbd5e1' : '#334155'}
                bg="rgba(100, 116, 139, 0.12)"
              />
            </View>
            <Text style={[styles.category, { color: colors.textSecondary }]}>{complaint.category || 'General'}</Text>
          </View>
        </View>

        {!!complaint.priority && (
          <View
            style={[
              styles.priorityPill,
              { backgroundColor: pill.bg, borderColor: pill.border },
            ]}
          >
            <Text style={[styles.priorityText, { color: pill.text }]}>
              {complaint.priority.toUpperCase()} PRIORITY
            </Text>
          </View>
        )}

        {!!complaint.description && (
          <Text style={[styles.description, { color: isDark ? '#cbd5e1' : COLORS.gray700 }]}>{complaint.description}</Text>
        )}

        {Array.isArray(complaint.images) && complaint.images.length > 0 && (
          <View style={{ marginTop: SPACING.md }}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: SPACING.xs }]}>
              Attached Photos ({complaint.images.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
              {complaint.images.map((img, idx) => {
                const url = resolveMediaUrl(img);
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.85}
                    onPress={() => setSelectedImage(url)}
                    style={[styles.imageThumbWrap, { borderColor: isDark ? colors.borderStrong : COLORS.gray200 }]}
                  >
                    <Image source={{ uri: url }} style={styles.imageThumb} resizeMode="cover" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Text style={[styles.raisedOn, { color: colors.textTertiary }]}>
          Raised on {formatDateTime(complaint.createdAt)}
          {complaint.updatedAt && complaint.updatedAt !== complaint.createdAt
            ? ` · Updated ${formatDateTime(complaint.updatedAt)}`
            : ''}
        </Text>

        <Divider style={{ marginVertical: SPACING.md }} />

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Status Timeline</Text>
        <View style={styles.timeline}>
          {STATUS_STEPS.map((step, idx) => {
            const isActive = currentIdx >= 0 && idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <View key={step.key} style={styles.timelineItem}>
                {/* Web uses a blue→indigo gradient; approximated with the gradient start color (no extra deps). */}
                <View
                  style={[
                    styles.timelineBar,
                    {
                      backgroundColor: isActive
                        ? COLORS.infoLight
                        : isDark
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(15,23,42,0.08)',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.timelineLabel,
                    isCurrent
                      ? { color: isDark ? '#60a5fa' : '#2563eb', fontWeight: FONT_WEIGHTS.bold }
                      : isActive
                      ? { color: colors.textSecondary, fontWeight: FONT_WEIGHTS.medium }
                      : { color: colors.textTertiary, fontWeight: FONT_WEIGHTS.medium },
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {!!complaint.resolutionNote && (
          <View style={styles.resolutionBox}>
            <CheckCircle size={14} color={COLORS.success} />
            <Text style={styles.resolutionText}>{complaint.resolutionNote}</Text>
          </View>
        )}

        {Array.isArray(complaint.replies) && complaint.replies.length > 0 && (
          <>
            <Divider style={{ marginVertical: SPACING.md }} />
            <View style={styles.repliesHeader}>
              <MessageSquare size={16} color={colors.textSecondary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Replies ({complaint.replies.length})</Text>
            </View>
            {complaint.replies.map((reply, i) => (
              <View
                key={i}
                style={[
                  styles.reply,
                  { backgroundColor: isDark ? colors.cardSecondary : COLORS.gray50, borderColor: colors.border },
                ]}
              >
                <View style={styles.replyHead}>
                  <Text style={[styles.replyBy, { color: colors.textSecondary }]}>
                    {reply.byName || reply.by || reply.author || reply.byRole || 'Staff'}
                  </Text>
                  <Text style={[styles.replyDate, { color: colors.textTertiary }]}>{formatDateTime(reply.createdAt)}</Text>
                </View>
                <Text style={[styles.replyMessage, { color: colors.textPrimary }]}>{reply.message || reply.text}</Text>
              </View>
            ))}
          </>
        )}

        {canClose && (
          <View style={[styles.closeRow, { borderTopColor: colors.border }]}>
            <Button
              title="Mark as Closed"
              variant="danger"
              size="sm"
              icon={CheckCircle}
              onPress={() => setConfirmClose(true)}
              style={{ alignSelf: 'flex-end' }}
            />
          </View>
        )}
      </Card>

      <ConfirmModal
        visible={confirmClose}
        title="Mark as Closed?"
        message="Mark this complaint as closed?"
        confirmLabel="Mark as Closed"
        onConfirm={handleClose}
        onCancel={() => setConfirmClose(false)}
        destructive
        loading={closing}
      />

      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedImage(null)}>
            <X size={24} color={COLORS.white} />
          </TouchableOpacity>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeletonStack: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  categoryTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: { fontSize: 24, lineHeight: 28 },
  titleTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  title: { flex: 1, fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary, letterSpacing: -0.3, lineHeight: 22 },
  category: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4 },
  priorityPill: {
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 14,
  },
  priorityText: { fontSize: 11, fontWeight: FONT_WEIGHTS.semibold, letterSpacing: 0.88 },
  description: { fontSize: 13, marginTop: SPACING.md, lineHeight: 20, whiteSpace: 'pre-wrap' },
  imageThumbWrap: { width: 84, height: 84, borderRadius: BORDER_RADIUS.md, borderWidth: 1, overflow: 'hidden' },
  imageThumb: { width: '100%', height: '100%' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  fullImage: { width: '92%', height: '80%' },
  raisedOn: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: SPACING.md },
  sectionTitle: { fontSize: 15, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary, letterSpacing: -0.15 },
  timeline: { flexDirection: 'row', gap: 6, marginTop: 14 },
  timelineItem: { flex: 1 },
  timelineBar: { height: 6, borderRadius: 3 },
  timelineLabel: { fontSize: 10, marginTop: 6, textAlign: 'center' },
  resolutionBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: `${COLORS.success}12`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  resolutionText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.success },
  repliesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  reply: {
    backgroundColor: COLORS.gray50,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: SPACING.sm,
  },
  replyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  replyBy: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textSecondary },
  replyDate: { fontSize: 10, color: COLORS.textTertiary },
  replyMessage: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 19 },
  closeRow: {
    borderTopWidth: 1,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    alignItems: 'flex-end',
  },
});
