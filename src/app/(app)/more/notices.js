import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Bell, Megaphone } from 'lucide-react-native';
import { tenantService } from '../../../services/tenantService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage } from '../../../lib/normalize';
import { formatDate } from '../../../lib/format';
import {
  Screen, TenantPageHeader, Card, EmptyState, LoadingState, CardSkeleton, SegmentedControl, Badge,
  PantroLoader,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'important', label: 'Important' },
];

const isImportant = (n) => n.priority === 'important' || n.important;

export default function NoticesScreen() {
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const cachedNotices = tenantService.getCachedNotices({ page: 1, limit: 50 });
  const [notices, setNotices] = useState(cachedNotices || []);
  const [loading, setLoading] = useState(!cachedNotices);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchNotices = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (!tenantService.getCachedNotices({ page: 1, limit: 50 })) setLoading(true);
      try {
        const res = await tenantService.getMyNotices({ page: 1, limit: 50 }, { bypassCache: refresh });
        if (Array.isArray(res)) setNotices(res);
      } catch (e) {
        if (!tenantService.getCachedNotices({ page: 1, limit: 50 })) {
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
    fetchNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importantCount = useMemo(() => notices.filter(isImportant).length, [notices]);
  const filtered = filter === 'all' ? notices : notices.filter(isImportant);

  if (loading && notices.length === 0) {
    return (
      <Screen>
        <TenantPageHeader title="Notices" subtitle="Important updates from management" icon={Megaphone} iconTone="amber" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
          <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
            Loading notices…
          </Text>
        </View>
        <CardSkeleton count={3} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => fetchNotices({ refresh: true })}>
      <TenantPageHeader title="Notices" subtitle="Important updates from management" icon={Megaphone} iconTone="amber" />

      {notices.length === 0 ? (
        <EmptyState icon={Bell} title="No notices" message="No notices for you yet. Check back later." />
      ) : (
        <>
          <SegmentedControl
            options={[
              { value: 'all', label: `All (${notices.length})` },
              { value: 'important', label: `Important (${importantCount})` },
            ]}
            value={filter}
            onChange={setFilter}
            style={{ marginBottom: SPACING.md }}
          />

          {filtered.length === 0 ? (
            <EmptyState icon={Bell} title="No important notices" message="No important notices at this time." />
          ) : (
            filtered.map((n) => <NoticeItem key={n._id || n.id} notice={n} />)
          )}
        </>
      )}
    </Screen>
  );
}

function NoticeItem({ notice }) {
  const { colors, isDark } = useTheme();
  const important = isImportant(notice);
  const Icon = important ? Megaphone : Bell;
  const color = important ? COLORS.warning : COLORS.secondary;
  return (
    <Card
      style={[
        styles.card,
        important && {
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : `${COLORS.warning}0F`,
          borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : `${COLORS.warning}40`,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${color}15` }]}>
          <Icon size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
              {notice.title}
            </Text>
            {important && <Badge label="IMPORTANT" color={COLORS.warning} />}
          </View>
          {!!(notice.message || notice.description) && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{notice.message || notice.description}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textTertiary }]}>{formatDate(notice.createdAt)}</Text>
            {!!notice.audience && (
              <>
                <Text style={[styles.meta, { color: colors.textTertiary }]}>•</Text>
                <Text style={[styles.meta, { color: colors.textTertiary, textTransform: 'capitalize' }]}>{notice.audience}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.md },
  icon: { width: 38, height: 38, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  title: { flexShrink: 1, fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semibold, color: COLORS.textPrimary },
  message: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  meta: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary },
});
