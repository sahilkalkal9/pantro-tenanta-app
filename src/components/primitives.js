import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SHADOWS,
} from '../constants/colors';
import PantroLoader from './PantroLoader';
import { useTheme } from '../hooks/useTheme';

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
export function Card({ children, style, onPress, padded = true }) {
  const { colors } = useTheme();
  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        padded && styles.cardPadded,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  style,
  textStyle,
  fullWidth = false,
}) {
  const { colors, isDark } = useTheme();
  const VARIANTS = {
    primary: { bg: COLORS.primary, text: COLORS.white, border: COLORS.primary },
    secondary: { bg: COLORS.secondary, text: COLORS.white, border: COLORS.secondary },
    danger: { bg: COLORS.danger, text: COLORS.white, border: COLORS.danger },
    outline: { bg: 'transparent', text: COLORS.primary, border: COLORS.primary },
    ghost: { bg: 'transparent', text: COLORS.primary, border: 'transparent' },
    light: {
      bg: isDark ? colors.cardSecondary : COLORS.gray100,
      text: colors.textPrimary,
      border: isDark ? colors.border : COLORS.gray100,
    },
  };
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;
  const heights = { sm: 38, md: 48, lg: 54 };
  const fontSizes = { sm: FONT_SIZES.sm, md: FONT_SIZES.md, lg: FONT_SIZES.lg };
  const iconColor = v.text;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          height: heights[size],
        },
        fullWidth && { width: '100%' },
        isDisabled && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {Icon ? <Icon size={18} color={iconColor} style={{ marginRight: 6 }} /> : null}
          <Text
            style={[
              styles.buttonText,
              { color: v.text, fontSize: fontSizes[size] },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {IconRight ? (
            <IconRight size={18} color={iconColor} style={{ marginLeft: 6 }} />
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

export function IconButton({ icon: Icon, onPress, size = 20, color, style, bg }) {
  const { colors } = useTheme();
  const iconColor = color || colors.textPrimary;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.iconButton,
        bg ? { backgroundColor: bg } : null,
        style,
      ]}
    >
      <Icon size={size} color={iconColor} />
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */
/* Badge / Chip / StatusPill                                           */
/* ------------------------------------------------------------------ */
const STATUS_COLORS = {
  paid: COLORS.success,
  approved: COLORS.success,
  active: COLORS.success,
  occupied: COLORS.success,
  resolved: COLORS.success,
  pending: COLORS.pending,
  partial: COLORS.pending,
  in_progress: COLORS.info,
  unpaid: COLORS.danger,
  overdue: COLORS.danger,
  rejected: COLORS.danger,
  vacant: COLORS.gray400,
  inactive: COLORS.gray400,
  open: COLORS.info,
  closed: COLORS.gray500,
};

export function statusColor(status) {
  if (!status) return COLORS.gray500;
  return STATUS_COLORS[String(status).toLowerCase()] || COLORS.info;
}

export function Badge({ label, color, bg, style, textStyle }) {
  const c = color || COLORS.primary;
  return (
    <View style={[styles.badge, { backgroundColor: bg || `${c}1A` }, style]}>
      <Text style={[styles.badgeText, { color: c }, textStyle]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status, style }) {
  if (!status) return null;
  const label = String(status).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  return <Badge label={label} color={statusColor(status)} style={style} />;
}

export function Chip({ label, active, onPress, color = COLORS.primary, style, icon: Icon }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {Icon ? <Icon size={14} color={active ? COLORS.white : colors.textSecondary} style={{ marginRight: 4 }} /> : null}
      <Text
        style={[
          styles.chipText,
          { color: active ? COLORS.white : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */
/* Divider                                                             */
/* ------------------------------------------------------------------ */
export function Divider({ style, label }) {
  const { colors } = useTheme();
  if (label) {
    return (
      <View style={[styles.dividerRow, style]}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerLabel, { color: colors.textTertiary }]}>{label}</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>
    );
  }
  return <View style={[styles.divider, { backgroundColor: colors.border }, style]} />;
}

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */
export function Avatar({ name, size = 44, color = COLORS.primary, style }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}1A`,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color, fontWeight: FONT_WEIGHTS.bold, fontSize: size * 0.38 }}>
        {initials}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* ProgressBar                                                         */
/* ------------------------------------------------------------------ */
export function ProgressBar({ value = 0, color = COLORS.primary, style, height = 8 }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={[styles.progressTrack, { height, backgroundColor: colors.border }, style]}>
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* SectionHeader                                                       */
/* ------------------------------------------------------------------ */
export function SectionHeader({ title, action, onAction, style, actionIcon: ActionIcon }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction} style={styles.sectionAction} activeOpacity={0.7}>
          <Text style={styles.sectionActionText}>{action}</Text>
          {ActionIcon ? <ActionIcon size={14} color={COLORS.primary} style={{ marginLeft: 2 }} /> : null}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* ListItem                                                            */
/* ------------------------------------------------------------------ */
export function ListItem({
  icon: Icon,
  iconColor = COLORS.primary,
  title,
  subtitle,
  right,
  onPress,
  chevron: Chevron,
  style,
  left,
  rightStyle,
}) {
  const { colors } = useTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper activeOpacity={0.7} onPress={onPress} style={[styles.listItem, style]}>
      {left}
      {Icon ? (
        <View style={[styles.listItemIcon, { backgroundColor: `${iconColor}15` }]}>
          <Icon size={20} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.listItemBody}>
        <Text style={[styles.listItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.listItemRight, rightStyle]}>
        {typeof right === 'string' || typeof right === 'number' ? (
          <Text style={[styles.listItemRightText, { color: colors.textPrimary }]}>{right}</Text>
        ) : (
          right
        )}
        {Chevron || onPress ? (
          Chevron ? <Chevron size={18} color={colors.textTertiary} /> : null
        ) : null}
      </View>
    </Wrapper>
  );
}

/* ------------------------------------------------------------------ */
/* KeyValue row                                                        */
/* ------------------------------------------------------------------ */
export function KeyValue({ label, value, valueColor, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.keyValue, style]}>
      <Text style={[styles.keyValueLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.keyValueValue, { color: valueColor || colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */
export function EmptyState({ icon: Icon, title, message, action, onAction, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.emptyState, style]}>
      {Icon ? (
        <View style={[styles.emptyIcon, { backgroundColor: colors.cardSecondary }]}>
          <Icon size={40} color={colors.textTertiary} />
        </View>
      ) : null}
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{title}</Text>
      {message ? <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>{message}</Text> : null}
      {action ? (
        <Button title={action} onPress={onAction} size="sm" style={{ marginTop: SPACING.md }} />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* LoadingState                                                        */
/* ------------------------------------------------------------------ */
export function LoadingState({ message = 'Loading...', variant = 'card', style, title, subtitle, subtext }) {
  return (
    <View style={[styles.loadingState, style]}>
      <PantroLoader
        variant={variant}
        message={title || message}
        subtext={subtitle || subtext}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons (content placeholders matching the web panel)            */
/* ------------------------------------------------------------------ */
function usePulse() {
  const value = React.useRef(new Animated.Value(0.55)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

export function Skeleton({ variant = 'text', style }) {
  const { isDark } = useTheme();
  const opacity = usePulse();
  const variants = {
    text: { height: 14, borderRadius: 6, alignSelf: 'stretch' },
    title: { height: 20, width: '50%', borderRadius: 8 },
    avatar: { height: 40, width: 40, borderRadius: 20 },
    card: { height: 128, borderRadius: 16, alignSelf: 'stretch' },
    button: { height: 40, width: 96, borderRadius: 10 },
    badge: { height: 20, width: 64, borderRadius: 999 },
  };
  return (
    <Animated.View
      style={[
        { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' },
        variants[variant] || variants.text,
        style,
        { opacity },
      ]}
    />
  );
}

export function CardSkeleton({ count = 4, style }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[{ gap: 12 }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 16,
            gap: 12,
          }}
        >
          <Skeleton variant="text" style={{ width: 80, height: 12 }} />
          <Skeleton variant="text" style={{ width: 96, height: 24 }} />
        </View>
      ))}
    </View>
  );
}

export function ListSkeleton({ count = 3, style }) {
  const { colors } = useTheme();
  return (
    <View style={[{ gap: 10 }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 14,
          }}
        >
          <Skeleton variant="avatar" />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton variant="text" style={{ width: '35%' }} />
            <Skeleton variant="text" style={{ width: '65%', height: 12 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* SearchBar                                                           */
/* ------------------------------------------------------------------ */
export function SearchBar({ value, onChangeText, placeholder = 'Search...', style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.border }, style]}>
      <Text style={{ color: colors.textTertiary, fontSize: 15, marginRight: 6 }}>⌕</Text>
      <TextInput
        style={[styles.searchInput, { color: colors.textPrimary }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="search"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <Text style={[styles.searchClear, { color: colors.textTertiary }]}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function SearchIcon() {
  return (
    <Text style={{ color: COLORS.textTertiary, fontSize: 15, marginRight: 6 }}>⌕</Text>
  );
}

/* ------------------------------------------------------------------ */
/* FAB                                                                 */
/* ------------------------------------------------------------------ */
export function FAB({ icon: Icon, onPress, style, color = COLORS.primary, label }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.fab, { backgroundColor: color }, style]}
    >
      {Icon ? <Icon size={22} color={COLORS.white} /> : null}
      {label ? <Text style={styles.fabLabel}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */
/* SegmentedControl                                                    */
/* ------------------------------------------------------------------ */
export function SegmentedControl({ options = [], value, onChange, style }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: isDark ? colors.cardSecondary : COLORS.gray100 }, style]}>
      {options.map((opt) => {
        const optValue = typeof opt === 'string' ? opt : opt.value;
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        const active = optValue === value;
        return (
          <TouchableOpacity
            key={String(optValue)}
            activeOpacity={0.8}
            onPress={() => onChange && onChange(optValue)}
            style={[
              styles.segmentedItem,
              active && {
                backgroundColor: isDark ? colors.card : COLORS.white,
                ...SHADOWS.small,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentedText,
                { color: active ? COLORS.primary : colors.textSecondary },
              ]}
            >
              {optLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* StatCard                                                            */
/* ------------------------------------------------------------------ */
export function StatCard({ icon: Icon, label, value, sub, color = COLORS.primary, onPress, style }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={[styles.statCard, style]}>
      <View style={styles.statRow}>
        {Icon ? (
          <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
            <Icon size={22} color={color} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
          {sub ? <Text style={[styles.statSub, { color: colors.textTertiary }]}>{sub}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* PageHeader (large in-content header)                                */
/* ------------------------------------------------------------------ */
export function PageHeader({ title, subtitle, right, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pageHeader, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.pageHeaderTitle, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.pageHeaderSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  cardPadded: { padding: SPACING.md },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
  },
  buttonText: { fontWeight: FONT_WEIGHTS.semibold },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semibold },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium },
  divider: { height: 1, backgroundColor: COLORS.border },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textTertiary },
  progressTrack: {
    width: '100%',
    backgroundColor: COLORS.gray200,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  sectionAction: { flexDirection: 'row', alignItems: 'center' },
  sectionActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemBody: { flex: 1 },
  listItemTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textPrimary,
  },
  listItemSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  listItemRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  listItemRightText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
  },
  keyValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  keyValueLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  keyValueValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 280,
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  searchClear: { color: COLORS.textTertiary, fontSize: 14, paddingHorizontal: 4 },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    height: 52,
    borderRadius: 26,
    ...SHADOWS.large,
  },
  fabLabel: { color: COLORS.white, fontWeight: FONT_WEIGHTS.semibold, fontSize: FONT_SIZES.md },
  segmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray100,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  segmentedItemActive: { backgroundColor: COLORS.white, ...SHADOWS.small },
  segmentedText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  segmentedTextActive: { color: COLORS.primary },
  statCard: { flex: 1 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  statIcon: {
    width: 46,
    height: 46,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  statLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  statSub: { fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: 2 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  pageHeaderTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  pageHeaderSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
