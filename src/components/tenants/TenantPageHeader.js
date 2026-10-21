import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';

const LIGHT_ICON_TONES = {
  blue: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  emerald: { bg: '#dcfce7', color: '#059669', border: '#bbf7d0' },
  amber: { bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
  rose: { bg: '#ffe4e6', color: '#e11d48', border: '#fecdd3' },
  violet: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  slate: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
};

const DARK_ICON_TONES = {
  blue: { bg: 'rgba(37, 99, 235, 0.18)', color: '#60a5fa', border: 'rgba(37, 99, 235, 0.35)' },
  emerald: { bg: 'rgba(5, 150, 105, 0.18)', color: '#34d399', border: 'rgba(5, 150, 105, 0.35)' },
  amber: { bg: 'rgba(217, 119, 6, 0.18)', color: '#fbbf24', border: 'rgba(217, 119, 6, 0.35)' },
  rose: { bg: 'rgba(225, 29, 72, 0.18)', color: '#fb7185', border: 'rgba(225, 29, 72, 0.35)' },
  violet: { bg: 'rgba(124, 58, 237, 0.18)', color: '#a78bfa', border: 'rgba(124, 58, 237, 0.35)' },
  slate: { bg: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', border: 'rgba(255, 255, 255, 0.14)' },
};

export default function TenantPageHeader({
  title,
  subtitle,
  icon: Icon,
  iconTone = 'blue',
  right,
  eyebrow,
  style,
}) {
  const { colors, isDark } = useTheme();
  const tones = isDark ? DARK_ICON_TONES : LIGHT_ICON_TONES;
  const tone = tones[iconTone] || tones.blue;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        {Icon ? (
          <View style={[styles.iconBox, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Icon size={20} color={tone.color} strokeWidth={2.3} />
          </View>
        ) : null}
        <View style={styles.textWrap}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: isDark ? '#60a5fa' : '#2563eb' }]} numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
  },
  right: {
    marginLeft: 8,
  },
});
