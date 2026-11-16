import React, { useEffect, useRef, useState } from 'react';
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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
import { responsiveFontSize } from "../theme";

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
      automaticallyAdjustKeyboardInsets={true}
      keyboardDismissMode="interactive"
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
  subtitle,
  children,
  actions,
  height,
  scroll = true,
  fullPage = false,
  onBack,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const topInset = Platform.OS === 'android'
    ? Math.max(insets.top, RNStatusBar.currentHeight || 0)
    : insets.top;

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height || 0);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const windowHeight = Dimensions.get('window').height;
  const baseMaxHeight = fullPage ? '100%' : (height || windowHeight * 0.85);
  const effectiveMaxHeight = (!fullPage && keyboardHeight > 0)
    ? Math.max(260, windowHeight - keyboardHeight - 50)
    : baseMaxHeight;

  const content = (
    <View style={{ flex: fullPage ? 1 : undefined, maxHeight: fullPage ? undefined : effectiveMaxHeight }}>
      {!fullPage && (
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
      )}
      <View style={[
        styles.sheetHeader,
        fullPage ? {
          backgroundColor: COLORS.primary,
          paddingTop: topInset + 6,
          paddingBottom: 14,
          paddingHorizontal: SPACING.lg,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0, 0, 0, 0.12)',
        } : {
          borderBottomColor: colors.border,
          paddingTop: SPACING.md,
          paddingBottom: SPACING.md,
          paddingHorizontal: SPACING.lg,
          backgroundColor: isDark ? colors.card : '#ffffff',
        }
      ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {fullPage ? (
            <TouchableOpacity
              onPress={onBack || onClose}
              hitSlop={12}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: -4,
              }}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={22} color="#ffffff" strokeWidth={2.4} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.sheetTitle,
                fullPage
                  ? { color: '#ffffff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 }
                  : { color: colors.textPrimary, fontSize: responsiveFontSize(FONT_SIZES.lg) }
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  fontSize: responsiveFontSize(11.5),
                  color: fullPage ? 'rgba(255, 255, 255, 0.85)' : colors.textSecondary,
                  marginTop: 2,
                  fontWeight: fullPage ? '600' : '400',
                }}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={10}
          style={fullPage ? {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          } : { padding: 4 }}
          activeOpacity={0.7}
          accessibilityLabel="Close"
        >
          <X size={18} color={fullPage ? '#ffffff' : colors.textSecondary} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
      {scroll ? (
        <ScrollView
          style={{ flex: fullPage ? 1 : undefined, maxHeight: fullPage ? undefined : Math.max(180, effectiveMaxHeight - 120), backgroundColor: fullPage ? (isDark ? colors.background : '#f8fafc') : undefined }}
          contentContainerStyle={[styles.sheetBody, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : (fullPage ? 100 : 60) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={true}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.sheetBody, { flex: fullPage ? 1 : undefined, paddingBottom: keyboardHeight > 0 ? 80 : 30, backgroundColor: fullPage ? (isDark ? colors.background : '#f8fafc') : undefined }]}>{children}</View>
      )}
      {actions ? (
        <View style={[styles.sheetActions, { borderTopColor: colors.border, paddingBottom: Platform.OS === 'ios' ? 24 : SPACING.md }]}>
          {Array.isArray(actions)
            ? actions.map((act, idx) => {
                if (!act) return null;
                if (React.isValidElement(act)) return act;
                if (typeof act === 'object') {
                  return (
                    <Button
                      key={idx}
                      title={act.label || act.title || 'Action'}
                      variant={act.variant || 'primary'}
                      onPress={act.onPress}
                      loading={act.loading}
                      disabled={act.disabled}
                      style={{ flex: 1 }}
                    />
                  );
                }
                return null;
              })
            : actions}
        </View>
      ) : null}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={!fullPage}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={fullPage}
    >
      {fullPage && (
        <StatusBar
          style="light"
          backgroundColor={COLORS.primary}
          translucent={true}
        />
      )}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: fullPage ? COLORS.primary : undefined }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={fullPage ? { flex: 1, backgroundColor: isDark ? colors.background : '#f8fafc' } : styles.sheetBackdrop}>
          {!fullPage && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />}
          <View style={[styles.sheetContainer, fullPage ? { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0, backgroundColor: isDark ? colors.background : '#f8fafc' } : { backgroundColor: colors.card }]}>
            {content}
          </View>
        </View>
      </KeyboardAvoidingView>
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
    fontSize: responsiveFontSize(FONT_SIZES.lg),
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: { fontSize: responsiveFontSize(FONT_SIZES.xs), color: COLORS.textSecondary, marginTop: 1 },
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
    fontSize: responsiveFontSize(FONT_SIZES.lg),
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
    fontSize: responsiveFontSize(FONT_SIZES.lg),
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  confirmMessage: {
    fontSize: responsiveFontSize(FONT_SIZES.md),
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
    fontSize: responsiveFontSize(FONT_SIZES.sm),
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textPrimary,
  },
  toastMessage: { fontSize: responsiveFontSize(FONT_SIZES.sm), color: COLORS.textSecondary, marginTop: 1 },
});
