import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Calendar, ArrowRight } from 'lucide-react-native';
import { formatCurrency, formatMonthYear } from '../../lib/format';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, SHADOWS } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';

const STATUS_THEMES = {
  paid: { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' },
  partial: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  unpaid: { bg: '#ffe4e6', text: '#e11d48', border: '#fecdd3' },
  overdue: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
};

const DARK_STATUS_THEMES = {
  paid: { bg: 'rgba(5, 150, 105, 0.18)', text: '#34d399', border: 'rgba(5, 150, 105, 0.35)' },
  partial: { bg: 'rgba(217, 119, 6, 0.18)', text: '#fbbf24', border: 'rgba(217, 119, 6, 0.35)' },
  unpaid: { bg: 'rgba(225, 29, 72, 0.18)', text: '#fb7185', border: 'rgba(225, 29, 72, 0.35)' },
  overdue: { bg: 'rgba(220, 38, 38, 0.22)', text: '#f87171', border: 'rgba(220, 38, 38, 0.4)' },
};

export default function RentStatusCard({ rent, onPay, loading = false, style }) {
  const { colors, isDark } = useTheme();

  if (!rent) {
    return (
      <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No rent record for this month.</Text>
      </View>
    );
  }

  const pendingAmount = Math.max(
    0,
    (Number(rent.rentAmount) || 0) - (Number(rent.paidAmount) || 0) + (Number(rent.lateFeeAccrued) || 0)
  );
  const status =
    rent.status ||
    (pendingAmount <= 0 ? 'paid' : pendingAmount < (Number(rent.rentAmount) || 0) ? 'partial' : 'unpaid');
  const isPaid = pendingAmount <= 0;
  const statusThemes = isDark ? DARK_STATUS_THEMES : STATUS_THEMES;
  const theme = statusThemes[status] || statusThemes.unpaid;

  const dueStr = rent.dueDate
    ? new Date(rent.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>
            {rent.month && rent.year ? formatMonthYear(rent.month, rent.year) : 'Current Rent'}
          </Text>
          {dueStr ? (
            <View style={styles.dueDateRow}>
              <Calendar size={12} color={colors.textSecondary} />
              <Text style={[styles.dueDateText, { color: colors.textSecondary }]}>Due: {dueStr}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.statusPill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Text style={[styles.statusText, { color: theme.text }]}>
            {String(status).toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())}
          </Text>
        </View>
      </View>

      {/* 3 Metrics Box */}
      <View style={[styles.metricsBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
        <View style={styles.metricCol}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>TOTAL RENT</Text>
          <Text style={[styles.metricVal, { color: colors.textPrimary }]}>{formatCurrency(rent.rentAmount)}</Text>
        </View>

        <View style={[styles.metricCol, styles.metricDivider, { borderLeftColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: '#059669' }]}>PAID</Text>
          <Text style={[styles.metricVal, { color: '#059669' }]}>
            {formatCurrency(rent.paidAmount || 0)}
          </Text>
        </View>

        <View style={[styles.metricCol, styles.metricDivider, { borderLeftColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: isPaid ? colors.textSecondary : '#e11d48' }]}>
            PENDING
          </Text>
          <Text
            style={[
              styles.metricVal,
              { color: isPaid ? colors.textSecondary : '#e11d48' },
            ]}
          >
            {formatCurrency(pendingAmount)}
          </Text>
        </View>
      </View>

      {/* Late fee notice */}
      {!isPaid && (Number(rent.lateFeeAccrued) > 0 || rent.lateFeeEnabled) ? (
        <View style={styles.lateFeeBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.lateFeeTitle}>Late fee accrued</Text>
            {Number(rent.lateFeePerDay) > 0 && (
              <Text style={styles.lateFeeSub}>
                {formatCurrency(rent.lateFeePerDay)}/day after due date
              </Text>
            )}
          </View>
          <Text style={styles.lateFeeAmount}>
            {formatCurrency(rent.lateFeeAccrued || 0)}
          </Text>
        </View>
      ) : null}

      {/* Pay CTA */}
      {pendingAmount > 0 && onPay ? (
        <TouchableOpacity
          style={[styles.payButton, loading && { opacity: 0.7 }]}
          onPress={onPay}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator size="small" color="#ffffff" /> : null}
          <Text style={styles.payButtonText}>Pay {formatCurrency(pendingAmount)}</Text>
          <ArrowRight size={16} color="#ffffff" strokeWidth={2.4} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.15,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  dueDateText: {
    fontSize: 11.5,
    color: '#64748b',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  metricsBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#64748b',
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  lateFeeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  lateFeeTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
  },
  lateFeeSub: {
    fontSize: 10,
    color: 'rgba(217, 119, 6, 0.8)',
    marginTop: 1,
  },
  lateFeeAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b45309',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 11,
    ...SHADOWS.small,
  },
  payButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff',
  },
});
