import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import {
  DoorOpen, BedDouble, History as HistoryIcon, MoveRight, RefreshCw,
  IndianRupee, AlertTriangle, Send, Home, Building2, Calendar,
} from 'lucide-react-native';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import { formatCurrency, formatDate, formatDateTime, formatBedNumber } from '../../../lib/format';
import {
  Screen, TenantPageHeader, Card, Button, Badge, TextField, SelectField, ModalSheet,
  Divider, EmptyState, CardSkeleton, PantroLoader,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

const ROOM_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'triple', label: 'Triple' },
  { value: 'four', label: 'Four' },
];

const REQUEST_STATUS = {
  pending: { label: 'Pending', color: COLORS.warning },
  approved: { label: 'Approved', color: COLORS.success },
  rejected: { label: 'Rejected', color: COLORS.danger },
  cancelled: { label: 'Cancelled', color: COLORS.gray500 },
};

// Timeline icon colors match the web timelineMeta hues exactly.
const TIMELINE_META = {
  move_in: { icon: MoveRight, color: '#2563eb' },
  re_admission: { icon: RefreshCw, color: '#059669' },
  move_out: { icon: MoveRight, color: '#ef4444' },
  room_change: { icon: DoorOpen, color: '#4f46e5' },
  rent_change: { icon: IndianRupee, color: '#d97706' },
  notice_period: { icon: AlertTriangle, color: '#f97316' },
};

// Tinted icon-box tones used by the web InfoTile (light / dark pairs).
const INFO_TONES = {
  blue: { bg: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.25)', color: '#2563eb', colorDark: '#60a5fa' },
  emerald: { bg: 'rgba(16, 185, 129, 0.10)', border: 'rgba(16, 185, 129, 0.25)', color: '#059669', colorDark: '#34d399' },
  violet: { bg: 'rgba(139, 92, 246, 0.10)', border: 'rgba(139, 92, 246, 0.25)', color: '#7c3aed', colorDark: '#a78bfa' },
  teal: { bg: 'rgba(20, 184, 166, 0.10)', border: 'rgba(20, 184, 166, 0.25)', color: '#0d9488', colorDark: '#2dd4bf' },
  cyan: { bg: 'rgba(6, 182, 212, 0.10)', border: 'rgba(6, 182, 212, 0.25)', color: '#0891b2', colorDark: '#22d3ee' },
};

export default function RoomScreen() {
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const cachedProf = tenantService.getCachedProfile();
  const cachedReqs = tenantService.getCachedRoomChangeRequests();
  const cachedHist = tenantService.getCachedHistory();
  const initialTimeline = Array.isArray(cachedHist) ? cachedHist : Array.isArray(cachedHist?.data) ? cachedHist.data : [];

  const [profile, setProfile] = useState(cachedProf);
  const [requests, setRequests] = useState(cachedReqs || []);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [loading, setLoading] = useState(!cachedProf);
  const [refreshing, setRefreshing] = useState(false);

  const [requestOpen, setRequestOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [preferredRoomType, setPreferredRoomType] = useState('');

  const fetchAll = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedProfile()) setLoading(true);
      try {
        const [profRes, reqRes, histRes] = await Promise.allSettled([
          tenantService.getProfile({ bypassCache: refresh }),
          tenantService.getRoomChangeRequests({}, { bypassCache: refresh }),
          tenantService.getHistory({ bypassCache: refresh }),
        ]);
        if (profRes.status === 'fulfilled') setProfile(profRes.value);
        if (reqRes.status === 'fulfilled') setRequests(Array.isArray(reqRes.value) ? reqRes.value : []);
        if (histRes.status === 'fulfilled') {
          const h = histRes.value;
          setTimeline(Array.isArray(h) ? h : Array.isArray(h?.data) ? h.data : []);
        }
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
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      await tenantService.createRoomChangeRequest({
        reason: reason.trim(),
        preferredRoomType: preferredRoomType || undefined,
      });
      toast.success('Room change request submitted!');
      setReason('');
      setPreferredRoomType('');
      setRequestOpen(false);
      fetchAll({ refresh: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !profile) {
    return (
      <Screen>
        <TenantPageHeader title="Room" icon={BedDouble} iconTone="violet" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
          <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
            Loading your room details…
          </Text>
        </View>
        <CardSkeleton count={2} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <TenantPageHeader title="Room" icon={BedDouble} iconTone="violet" />
        <EmptyState icon={Home} tone="violet" title="No room assigned" message="Your room details are not available right now." />
      </Screen>
    );
  }

  const room = typeof profile.roomId === 'object' ? profile.roomId : null;
  const property = typeof profile.propertyId === 'object' ? profile.propertyId : null;
  const bed = typeof profile.bedId === 'object' ? profile.bedId : null;
  const isRk = room?.type === 'RK' || room?.sharingType === 'RK' || ['RK', 'Flat'].includes(property?.type);
  const hasPending = requests.some((r) => r.status === 'pending');
  const canRequest = profile.status === 'active' && !hasPending;

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchAll({ refresh: true })}>
      <TenantPageHeader
        title="Room"
        subtitle="Your room and room change requests"
        icon={BedDouble}
        iconTone="violet"
      />

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.headLeft}>
            <DoorOpen size={18} color="#7c3aed" />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Current Room</Text>
          </View>
          <Badge
            label={(profile.status || 'active').replace('_', ' ')}
            color={profile.status === 'active' ? COLORS.success : profile.status === 'notice_period' ? COLORS.warning : COLORS.gray500}
            textStyle={{ textTransform: 'capitalize' }}
          />
        </View>

        <View style={styles.grid}>
          <InfoTile icon={Building2} tone="blue" label="Property" value={property?.name} />
          <InfoTile icon={IndianRupee} tone="emerald" label="Monthly Rent" value={formatCurrency(profile.monthlyRent)} />
          <InfoTile
            icon={DoorOpen}
            tone="violet"
            label="Room"
            value={room?.roomNumber ? `${room.roomNumber} (${isRk ? 'Shared' : (room.sharingType || room.type || '—')})` : null}
          />
          <InfoTile icon={BedDouble} tone="teal" label="Bed">
            {isRk ? (
              'Shared'
            ) : (
              <View style={styles.tileBedRow}>
                <BedDouble size={13} color={COLORS.gray400} />
                <Text style={[styles.tileValue, { color: colors.textPrimary, marginTop: 0 }]}>
                  {formatBedNumber(bed?.bedNumber, room?.roomNumber) || '—'}
                </Text>
              </View>
            )}
          </InfoTile>
          <InfoTile icon={Calendar} tone="cyan" label="Move In Date" value={formatDate(profile.moveInDate)} />
        </View>

        {canRequest && (
          <>
            <Divider style={{ marginVertical: SPACING.md }} />
            <Button title="Request Room Change" icon={DoorOpen} onPress={() => setRequestOpen(true)} />
          </>
        )}
        {profile.status === 'active' && hasPending && (
          <>
            <Divider style={{ marginVertical: SPACING.md }} />
            <Text style={styles.noteWarn}>
              You already have a pending room change request. Wait for your owner to review it.
            </Text>
          </>
        )}
        {profile.status !== 'active' && (
          <>
            <Divider style={{ marginVertical: SPACING.md }} />
            <Text style={[styles.noteMuted, { color: colors.textSecondary }]}>Room changes can only be requested for an active tenancy.</Text>
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.headLeft}>
            <MoveRight size={18} color="#4f46e5" />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>My Requests</Text>
          </View>
          <Text style={[styles.count, { color: colors.textTertiary }]}>
            {`${requests.length} request${requests.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        {requests.length === 0 ? (
          <Text style={[styles.noteMuted, { color: colors.textSecondary }]}>No room change requests yet.</Text>
        ) : (
          requests.map((r) => {
            const meta = REQUEST_STATUS[r.status] || REQUEST_STATUS.pending;
            const metaParts = [formatDate(r.createdAt)];
            if (r.fromRoomId?.roomNumber) metaParts.push(`• From ${r.fromRoomId.roomNumber}`);
            if (r.preferredRoomType) metaParts.push(`• Preferred: ${r.preferredRoomType}`);
            if (r.toRoomId?.roomNumber) metaParts.push(`• To ${r.toRoomId.roomNumber} / ${r.toBedId?.bedNumber || '—'}`);
            if (r.newMonthlyRent) metaParts.push(`• ${formatCurrency(r.newMonthlyRent)}/mo`);
            if (r.effectiveDate) metaParts.push(`• From ${formatDate(r.effectiveDate)}`);
            return (
              <View key={r._id || r.id} style={[styles.request, { borderLeftColor: meta.color, borderColor: colors.border, backgroundColor: isDark ? colors.cardSecondary : 'transparent' }]}>
                <View style={styles.requestHead}>
                  <Text style={[styles.requestStatus, { color: colors.textPrimary }]}>{(r.status || 'pending')} request</Text>
                  <Badge label={meta.label} color={meta.color} />
                </View>
                <Text style={[styles.requestMeta, { color: colors.textSecondary }]}>{metaParts.join(' ')}</Text>
                {!!r.reason && <Text style={[styles.requestReason, { color: colors.textSecondary }]}>{r.reason}</Text>}
                {!!r.rejectionReason && <Text style={styles.requestRejected}>Rejected: {r.rejectionReason}</Text>}
              </View>
            );
          })
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>History</Text>
          <Text style={[styles.count, { color: colors.textTertiary }]}>
            {`${timeline.length} event${timeline.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        {timeline.length === 0 ? (
          <Text style={[styles.noteMuted, { color: colors.textSecondary }]}>Your stay timeline will appear here.</Text>
        ) : (
          timeline.map((ev, i) => {
            const meta = TIMELINE_META[ev.event] || { icon: HistoryIcon, color: COLORS.gray500 };
            const Icon = meta.icon;
            return (
              <View key={ev._id || ev.id || i} style={styles.timelineRow}>
                <View style={[styles.timelineDot, { borderColor: meta.color }]}>
                  <Icon size={12} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>{(ev.title || ev.event || '').replace(/_/g, ' ')}</Text>
                  {!!ev.description && <Text style={[styles.timelineDesc, { color: colors.textSecondary }]}>{ev.description}</Text>}
                  <Text style={[styles.timelineDate, { color: colors.textTertiary }]}>{formatDateTime(ev.date)}</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>

      <ModalSheet
        visible={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request Room Change"
        actions={[
          <Button key="cancel" title="Cancel" variant="light" onPress={() => setRequestOpen(false)} style={{ flex: 1 }} />,
          <Button key="submit" title="Submit Request" icon={Send} onPress={submit} loading={submitting} style={{ flex: 1 }} />,
        ]}
      >
        <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
          Tell your owner why you would like to move. They will review your request and choose a new room for you.
        </Text>
        <TextField
          label="Reason (optional)"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. prefer a quieter room, need an attached bathroom..."
          multiline
          style={{ marginTop: SPACING.md }}
        />
        <SelectField
          label="Preferred Room Type (optional)"
          value={preferredRoomType}
          options={ROOM_TYPES}
          onSelect={setPreferredRoomType}
          placeholder="No preference"
        />
      </ModalSheet>
    </Screen>
  );
}

// Sleek glass tile used for the room info grid (mirrors the web InfoTile).
function InfoTile({ icon: Icon, tone = 'blue', label, value, children }) {
  const { colors, isDark } = useTheme();
  const t = INFO_TONES[tone] || INFO_TONES.blue;
  return (
    <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.tileIcon, { backgroundColor: t.bg, borderColor: t.border }]}>
        <Icon size={18} color={isDark ? t.colorDark : t.color} />
      </View>
      <View style={styles.tileBody}>
        <Text style={[styles.tileLabel, { color: colors.textTertiary }]}>{label}</Text>
        {children || (
          <Text style={[styles.tileValue, { color: colors.textPrimary }]}>{value || '—'}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textPrimary },
  cardSub: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 19 },
  count: { fontSize: FONT_SIZES.sm, color: COLORS.textTertiary },
  grid: { marginTop: SPACING.sm, gap: 12 },
  tile: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileBody: { flex: 1, minWidth: 0 },
  tileLabel: { fontSize: 11, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.9 },
  tileValue: { fontSize: 13.5, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary, marginTop: 2 },
  tileBedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  noteWarn: { fontSize: FONT_SIZES.sm, color: COLORS.warning },
  noteMuted: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  request: { borderLeftWidth: 4, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.borderLight, padding: SPACING.sm, marginBottom: SPACING.sm },
  requestHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  requestStatus: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary, textTransform: 'capitalize' },
  requestMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 17 },
  requestReason: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  requestRejected: { fontSize: FONT_SIZES.sm, color: COLORS.danger, marginTop: 4 },
  timelineRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  timelineDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  timelineTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary, textTransform: 'capitalize' },
  timelineDesc: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  timelineDate: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: 2 },
});
