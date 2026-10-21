import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell, AlertCircle } from 'lucide-react-native';
import { formatDate } from '../../lib/format';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, SHADOWS } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';

export default function NoticeCard({ notice, onClick, style }) {
  const { colors, isDark } = useTheme();
  if (!notice) return null;

  const isImportant = notice.priority === 'important' || notice.important;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        isImportant && (isDark ? styles.cardImportantDark : styles.cardImportant),
        style,
      ]}
      onPress={() => onClick?.(notice)}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconTile,
            isDark && styles.iconTileDark,
            isImportant && (isDark ? styles.iconTileImportantDark : styles.iconTileImportant),
          ]}
        >
          {isImportant ? (
            <AlertCircle size={16} color="#d97706" />
          ) : (
            <Bell size={16} color={isDark ? '#94a3b8' : '#64748b'} />
          )}
        </View>

        <View style={styles.contentCol}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {notice.title}
            </Text>
            {isImportant && (
              <View style={[styles.importantPill, isDark && styles.importantPillDark]}>
                <Text style={[styles.importantText, isDark && { color: '#fbbf24' }]}>IMPORTANT</Text>
              </View>
            )}
          </View>

          <Text style={[styles.messageText, { color: isDark ? colors.textSecondary : '#475569' }]}>
            {notice.message || notice.description}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatDate(notice.createdAt)}</Text>
            {notice.audience ? (
              <>
                <Text style={[styles.metaDot, { color: colors.textTertiary }]}>•</Text>
                <Text style={[styles.metaAudience, { color: colors.textSecondary }]}>{notice.audience}</Text>
              </>
            ) : null}
          </View>
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
  cardImportant: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  cardImportantDark: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconTileImportant: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  iconTileImportantDark: {
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    borderColor: 'rgba(217, 119, 6, 0.4)',
  },
  importantPillDark: {
    backgroundColor: 'rgba(217, 119, 6, 0.25)',
    borderColor: 'rgba(217, 119, 6, 0.45)',
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
    flex: 1,
  },
  importantPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  importantText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.6,
  },
  messageText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  metaDot: {
    fontSize: 11,
    color: '#94a3b8',
  },
  metaAudience: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'capitalize',
  },
});
