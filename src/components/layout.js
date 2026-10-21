import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react-native';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SHADOWS,
} from '../constants/colors';
import { removeToast } from '../slices/uiSlice';
import { Button } from './primitives';
import { useTheme } from '../hooks/useTheme';

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */
export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  background,
  contentStyle,
  edges = [],
  style,
  keyboardShouldPersistTaps = 'handled',
}) {
  const { colors } = useTheme();
  const bg = background || colors.background;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: bg }, style]} edges={edges}>
      {body}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Header (for stack screens)                                          */
/* ------------------------------------------------------------------ */
export function Header({ title, subtitle, onBack, right, style, border = true }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, border && { borderBottomWidth: 1, borderBottomColor: colors.border }, style]}>
      <TouchableOpacity
        style={styles.headerBack}
        onPress={onBack || (() => router.back())}
        activeOpacity={0.7}
        hitSlop={8}
      >
        <ChevronLeft size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* ModalSheet (bottom sheet)                                           */
/* ------------------------------------------------------------------ */
export function ModalSheet({
  visible,
  onClose,
  title,
  children,
  actions,
  height,
  scroll = true,
}) {
  const { colors } = useTheme();
  const maxHeight = height || Dimensions.get('window').height * 0.85;
  const content = (
    <View style={{ maxHeight }}>
      <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
      <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>{title}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <X size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {scroll ? (
        <ScrollView
          style={{ maxHeight: maxHeight - 180 }}
          contentContainerStyle={styles.sheetBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.sheetBody}>{children}</View>
      )}
      {actions ? <View style={[styles.sheetActions, { borderTopColor: colors.border }]}>{actions}</View> : null}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>{content}</View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* ConfirmModal                                                        */
/* ------------------------------------------------------------------ */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
  loading = false,
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmBackdrop}>
        <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>{title}</Text>
          {message ? <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>{message}</Text> : null}
          <View style={styles.confirmActions}>
            <Button title={cancelLabel} variant="light" onPress={onCancel} style={{ flex: 1 }} />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Toaster                                                             */
/* ------------------------------------------------------------------ */
const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};
const TOAST_COLORS = {
  success: COLORS.success,
  error: COLORS.danger,
  warning: COLORS.warning,
  info: COLORS.info,
};

function ToastItem({ toast }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const Icon = TOAST_ICONS[toast.type] || Info;
  const color = TOAST_COLORS[toast.type] || COLORS.info;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(
      () => dispatch(removeToast(toast.id)),
      toast.duration || 4000
    );
    return () => clearTimeout(timer);
  }, [toast.id]);

  return (
    <Animated.View style={[styles.toast, { opacity, borderLeftColor: color, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
      <Icon size={20} color={color} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        {toast.title ? <Text style={[styles.toastTitle, { color: colors.textPrimary }]}>{toast.title}</Text> : null}
        <Text style={[styles.toastMessage, { color: colors.textSecondary }]}>{toast.message}</Text>
      </View>
      <TouchableOpacity onPress={() => dispatch(removeToast(toast.id))} hitSlop={8}>
        <X size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function Toaster() {
  const toasts = useSelector((state) => state.ui.toasts);
  if (!toasts || toasts.length === 0) return null;
  return (
    <View style={styles.toaster} pointerEvents="box-none">
      {toasts.slice(-3).map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: SPACING.lg, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  headerBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 1 },
  headerRight: { minWidth: 40, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray300,
    alignSelf: 'center',
    marginTop: SPACING.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sheetTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
    flex: 1,
  },
  sheetBody: { padding: SPACING.md },
  sheetActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  confirmTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  confirmMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  confirmActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  toaster: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.xxl,
    gap: SPACING.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    padding: SPACING.md,
    ...SHADOWS.large,
  },
  toastTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  toastMessage: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 1 },
});
