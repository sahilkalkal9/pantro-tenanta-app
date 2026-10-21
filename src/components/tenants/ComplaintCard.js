import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { formatDate } from '../../lib/format';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, SHADOWS } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';

const CATEGORY_ICONS = {
  Electricity: '⚡',
  Water: '💧',
  Food: '🍽️',
  Cleaning: '🧹',
  WiFi: '📶',
  Room: '🛏️',
  Bathroom: '🚿',
  Security: '🔒',
  Furniture: '🪑',
  Other: '📋',
};

const STATUS_THEMES = {
  open: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  in_progress: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  resolved: { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' },
  closed: { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' },
};

const DARK_STATUS_THEMES = {
  open: { bg: 'rgba(217, 119, 6, 0.18)', text: '#fbbf24', border: 'rgba(217, 119, 6, 0.35)' },
  in_progress: { bg: 'rgba(37, 99, 235, 0.18)', text: '#60a5fa', border: 'rgba(37, 99, 235, 0.35)' },
  resolved: { bg: 'rgba(5, 150, 105, 0.18)', text: '#34d399', border: 'rgba(5, 150, 105, 0.35)' },
  closed: { bg: 'rgba(255, 255, 255, 0.08)', text: '#94a3b8', border: 'rgba(255, 255, 255, 0.12)' },
};

export default function ComplaintCard({ complaint, onClick, style }) {
  const { colors, isDark } = useTheme();
  if (!complaint) return null;

  const status = complaint.status || 'open';
  const statusThemes = isDark ? DARK_STATUS_THEMES : STATUS_THEMES;
  const theme = statusThemes[status] || statusThemes.open;
  const emoji = CATEGORY_ICONS[complaint.category] || '📋';

  const priorityColor =
    complaint.priority === 'urgent'
      ? '#f43f5e'
      : complaint.priority === 'high'
      ? '#f59e0b'
      : complaint.priority === 'medium'
      ? '#3b82f6'
      : colors.textTertiary;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}
      onPress={() => onClick?.(complaint)}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconTile, { backgroundColor: colors.cardSecondary }]}>
          <Text style={styles.emojiText}>{emoji}</Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {complaint.title}
          </Text>
          <Text style={[styles.categorySub, { color: colors.textSecondary }]}>
            {complaint.category || 'General'}
          </Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Text style={[styles.statusText, { color: theme.text }]}>
            {String(status).replace('_', ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())}
          </Text>
        </View>
      </View>

      {complaint.description ? (
        <Text style={[styles.descText, { color: colors.textSecondary }]} numberOfLines={2}>
          {complaint.description}
        </Text>
      ) : null}

      <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.dateText, { color: colors.textTertiary }]}>{formatDate(complaint.createdAt)}</Text>
        <View style={styles.footerRight}>
          {complaint.priority ? (
            <Text style={[styles.priorityLabel, { color: priorityColor }]}>
              {complaint.priority}
            </Text>
          ) : null}
          <ChevronRight size={15} color={colors.textTertiary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 18,
  },
  infoCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  categorySub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  descText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginTop: 8,
    paddingLeft: 52,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 10,
    paddingTop: 8,
    paddingLeft: 52,
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
