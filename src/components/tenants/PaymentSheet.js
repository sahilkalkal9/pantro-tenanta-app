import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator, Image, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle,
  Copy,
  CreditCard,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wallet,
  Zap,
  Sparkles,
  Lock,
  Receipt,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { usePaymentObserver } from '../../hooks/usePaymentObserver';
import { tenantService } from '../../services/tenantService';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/normalize';
import { formatCurrency } from '../../lib/format';
import { ModalSheet } from '../layout';
import { Button, Card } from '../primitives';
import { TextField, SwitchRow } from '../forms';
import ImageKitUploader from '../ImageKitUploader';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/colors';
import { responsiveFontSize } from "../../theme";

/* ------------------------------------------------------------------ */
/* PaymentSheet — the single payment sheet used everywhere in the      */
/* tenant app (Dues, Rent & Payments, Dashboard).                      */
/*                                                                    */
/* Every "Pay" tap opens THIS sheet and the whole journey happens in  */
/* it: pick a method → pay → submit the proof / confirm the OTP.      */
/* Nothing navigates away and nothing is split across stacked sheets. */
/*                                                                    */
/* target = {                                                        */
/*   title:         'Pay Dues' | 'Pay Rent' | 'Pay Multiple Months'  */
/*   summary:       '2 due items selected'                           */
/*   amount:        4500,                                            */
/*   items:         [{ type:'rent'|'deposit'|'penalty', ... }]       */
/*   rentIds:       ['…'],                                           */
/*   depositAmount: 0,                                               */
/*   showOnline:    true,                                            */
/*   depositToggle: { amount, checked, onChange }                    */
/* }                                                                  */
/* ------------------------------------------------------------------ */

const PROOF_METHODS = {
  upi: {
    label: 'UPI',
    refLabel: 'UPI Transaction ID / UTR',
    refPlaceholder: 'e.g. 423456789012',
    refRequired: true,
  },
  bank_transfer: {
    label: 'Bank Transfer',
    refLabel: 'UTR / Transaction ID',
    refPlaceholder: 'Enter the bank reference',
    refRequired: true,
  },
  cheque: { label: 'Cheque', refLabel: 'Cheque Number', refPlaceholder: 'Enter the cheque number', refRequired: true },
  other: { label: 'Other', refLabel: 'Reference (optional)', refPlaceholder: 'Enter any reference', refRequired: false },
};

const OTHER_METHODS = ['bank_transfer', 'cheque', 'other'];

// expo-clipboard is a NATIVE module. It only exists in binaries that link it
// (Expo Go, or a dev client rebuilt after the dependency was added). A static
// `import` evaluates the native module at load time, so an app running an
// older binary dies with "Cannot find native module 'ExpoClipboard'".
// Requiring it lazily inside a try/catch keeps the app alive and lets the
// caller fall back to showing the UPI ID.
function getClipboard() {
  try {
    // eslint-disable-next-line global-require
    return require('expo-clipboard');
  } catch {
    return null;
  }
}

export default function PaymentSheet({ visible, onClose, onSuccess, target }) {
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const [view, setView] = useState('method'); // method | upi | proof | cash | cash-otp | online
  const [method, setMethod] = useState('');
  const [itemsExpanded, setItemsExpanded] = useState(true);

  // UPI / proof state
  const [upiLink, setUpiLink] = useState('');
  const [upiId, setUpiId] = useState('');
  const [ownerQrUrl, setOwnerQrUrl] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [upiLoading, setUpiLoading] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rrnDismissed, setRrnDismissed] = useState(false);

  // Dynamic Checkout Settings from Super Admin (real-time sync)
  const [checkoutConfig, setCheckoutConfig] = useState({
    upiMode: 'smart_collect', // 'smart_collect' | 'manual_proof'
    methods: {
      upi: true,
      cash: true,
      bankTransfer: true,
      cheque: true,
      other: true,
      onlineGateway: false,
    },
    platformFee: {
      enabled: true,
      amount: 5,
      gstRate: 18,
      applyOnlyToUpi: true,
    },
  });

  useEffect(() => {
    if (visible) {
      tenantService.getPaymentInfo().then((res) => {
        const data = res?.data || res;
        if (data?.checkoutConfig) {
          setCheckoutConfig(data.checkoutConfig);
        }
        if (data?.upiId && !upiId) {
          setUpiId(data.upiId);
        }
        if (data?.ownerUpiQrCode) {
          setOwnerQrUrl(data.ownerUpiQrCode);
        }
        if (data?.upiName) {
          setOwnerName(data.upiName);
        }
      }).catch((e) => {
        console.log('[PaymentSheet] fetch payment info error:', e?.message);
      });
    }
  }, [visible]);

  useEffect(() => {
    AsyncStorage.getItem('pantro_auto_rrn_enabled').then((val) => {
      if (val === 'true') setRrnDismissed(true);
    }).catch(() => {});
  }, []);

  // Cash state
  const [payees, setPayees] = useState([]);
  const [payeesLoading, setPayeesLoading] = useState(false);
  const [payeeId, setPayeeId] = useState('');
  const [cashStage, setCashStage] = useState('select');
  const [cashRequest, setCashRequest] = useState(null);
  const [otp, setOtp] = useState('');
  const [cashLoading, setCashLoading] = useState(false);

  // Online gateway (Cashfree) state
  const [cashfreeLoading, setCashfreeLoading] = useState(false);
  const [cashfreeVerifying, setCashfreeVerifying] = useState(false);
  const [cashfreeOrder, setCashfreeOrder] = useState(null);
  const [cashfreeDone, setCashfreeDone] = useState(false);
  const [cashfreeError, setCashfreeError] = useState('');

  const items = useMemo(() => target?.items || [], [target]);
  const amount = Number(target?.amount) || 0;
  const baseAmount = amount;

  // Tenant Payment Rules & Handling Fee calculation
  const paymentRules = target?.tenantPaymentRules || checkoutConfig?.tenantPaymentRules || {};
  const isAllSelected = target?.isAllSelected === true;
  const hasFreeTx = target?.hasFreeTransaction ?? paymentRules?.hasFreeTransaction ?? (Number(paymentRules?.usedTransactionsThisMonth || 0) < Number(paymentRules?.freeTransactionsCount ?? 1));
  const feePercent = Number(paymentRules?.handlingFeePercent ?? 1);
  const feeCap = Number(paymentRules?.handlingFeeMaxCap ?? 10);

  let handlingFee = 0;
  let feeLabel = '₹0.00 (FREE)';
  let feeSubtext = '';

  if (isAllSelected) {
    handlingFee = 0;
    feeLabel = '₹0.00 (FREE)';
    feeSubtext = '• Full dues waiver (₹0 handling fee)';
  } else if (hasFreeTx) {
    handlingFee = 0;
    feeLabel = '₹0.00 (FREE)';
    feeSubtext = '• 1st free transaction quota';
  } else if (target?.handlingFee !== undefined) {
    handlingFee = Number(target.handlingFee) || 0;
    feeLabel = handlingFee > 0 ? `+₹${handlingFee}` : '₹0.00 (FREE)';
    feeSubtext = handlingFee > 0 ? `• ${feePercent}% handling fee (capped at ₹${feeCap})` : '';
  } else {
    handlingFee = Math.min(feeCap, Math.round(baseAmount * (feePercent / 100)));
    feeLabel = handlingFee > 0 ? `+₹${handlingFee}` : '₹0.00 (FREE)';
    feeSubtext = handlingFee > 0 ? `• ${feePercent}% handling fee (capped at ₹${feeCap})` : '';
  }

  const totalPayable = baseAmount > 0 ? baseAmount + handlingFee : 0;
  const upiPayable = totalPayable;
  const isManualUpi = checkoutConfig?.upiMode === 'manual_proof';
  const configuredFee = handlingFee;
  const rentIds = useMemo(() => target?.rentIds || [], [target]);
  const depositAmount = Number(target?.depositAmount) || 0;

  const methods = checkoutConfig?.methods || {};
  const showUpi = methods.upi !== false;
  const showCash = methods.cash !== false;
  const showBankTransfer = methods.bankTransfer !== false;
  const showCheque = methods.cheque !== false;
  const showOther = methods.other !== false;
  const showOnline = methods.onlineGateway && target?.showOnline !== false && (rentIds.length > 0 || depositAmount > 0);
  const depositToggle = target?.depositToggle || null;

  const activeOtherMethods = useMemo(() => {
    const list = [];
    if (showBankTransfer) list.push('bank_transfer');
    if (showCheque) list.push('cheque');
    if (showOther) list.push('other');
    return list;
  }, [showBankTransfer, showCheque, showOther]);

  const handleLaunchUpiApp = async (appKey) => {
    if (!upiLink) return;
    try {
      let targetScheme = '';
      if (appKey === 'gpay') targetScheme = Platform.OS === 'android' ? 'gpay://' : 'tez://upi/pay';
      else if (appKey === 'phonepe') targetScheme = 'phonepe://';
      else if (appKey === 'paytm') targetScheme = 'paytmmp://';
      else if (appKey === 'kotak') targetScheme = 'kotakbank://';
      else if (appKey === 'pop') targetScheme = 'popclub://';

      if (targetScheme) {
        const customUrl = upiLink.replace(/^upi:\/\//, targetScheme);
        try {
          const can = await Linking.canOpenURL(customUrl);
          if (can) {
            await Linking.openURL(customUrl);
            return;
          }
        } catch {
          // fallback to generic
        }
      }
      await Linking.openURL(upiLink);
    } catch {
      toast.warning('Could not launch selected UPI app. Please scan the QR code.');
    }
  };

  const handleConfirmPaidUpi = async () => {
    toast.success('⚡ Payment submitted via Smart Collect. Verifying balance...');
    close();
    onSuccess?.();
  };

  const {
    detectedRrn,
    detectedMeta,
    isDetecting,
    resetDetection,
    hasNotificationAccess,
    isNativeListenerSupported,
    openNotificationSettings,
  } = usePaymentObserver({
    expectedAmount: amount,
    enabled: visible && (view === 'upi' || view === 'proof'),
    onDetected: (utr, meta) => {
      setTransactionId(utr);
      const app = meta?.appName ? ` via ${meta.appName}` : '';
      toast.success(`⚡ Auto-detected UPI Reference (RRN): ${utr}${app}`);
    },
  });

  const reset = useCallback(() => {
    setView('method');
    setMethod('');
    setUpiLink('');
    setUpiId('');
    setUpiLoading(false);
    setTransactionId('');
    setScreenshotUrl('');
    setSubmitting(false);
    setPayees([]);
    setPayeesLoading(false);
    setPayeeId('');
    setCashStage('select');
    setCashRequest(null);
    setOtp('');
    setCashLoading(false);
    setCashfreeLoading(false);
    setCashfreeVerifying(false);
    setCashfreeOrder(null);
    setCashfreeDone(false);
    setCashfreeError('');
    setItemsExpanded(true);
    resetDetection?.();
  }, []);

  // Fresh state every time the sheet opens.
  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const close = () => {
    reset();
    onClose?.();
  };

  const backToMethods = () => {
    setView('method');
    setMethod('');
  };

  // ── UPI ────────────────────────────────────────────────────────────
  const selectUpi = async () => {
    setMethod('upi');
    setView('upi');
    setUpiLink('');
    setUpiId('');
    setUpiLoading(true);

    try {
      // 1. The dues UPI endpoint prices rent + deposit + penalty items.
      if (items.length) {
        try {
          const res = await tenantService.getDuesUpiLink(items, {
            isAllSelected: target?.isAllSelected ? 'true' : 'false',
          });
          const link = res?.data?.upiDeepLink || res?.upiLink || res?.upiDeepLink || res?.data?.upiQrString || '';
          const id = res?.data?.upiId || res?.upiId || '';
          const qrImg = res?.data?.ownerUpiQrCode || res?.ownerUpiQrCode || '';
          const uName = res?.data?.upiName || res?.upiName || '';
          const cfg = res?.data?.checkoutConfig || res?.checkoutConfig;
          if (cfg) setCheckoutConfig(cfg);
          if (qrImg) setOwnerQrUrl(qrImg);
          if (uName) setOwnerName(uName);
          if (link) {
            setUpiLink(link);
            setUpiId(id);
            return;
          }
        } catch (err) {
          console.log('[PaymentSheet] dues UPI link fallback:', err?.message);
        }
      }

      // 2. Fallback to the owner / property payment details.
      try {
        const payInfoRes = await tenantService.getPaymentInfo();
        const info = payInfoRes?.data || payInfoRes;
        if (info?.checkoutConfig) setCheckoutConfig(info.checkoutConfig);
        if (info?.ownerUpiQrCode) setOwnerQrUrl(info.ownerUpiQrCode);
        const acc = (info?.upiAccounts && info.upiAccounts[0]) || null;
        const accId = info?.upiId || acc?.upiId;
        const accName = info?.upiName || acc?.upiName || 'Payment';
        if (accName) setOwnerName(accName);
        if (accId && totalPayable > 0) {
          const cleanId = String(accId).trim();
          setUpiLink(
            `upi://pay?pa=${cleanId}&pn=${encodeURIComponent(accName)}&am=${totalPayable.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
              target?.title || 'Payment'
            )}`
          );
          setUpiId(cleanId);
          return;
        }
      } catch (err) {
        console.log('[PaymentSheet] payment info fallback:', err?.message);
      }

      // 3. Fallback to the UPI link of the single rent month.
      const rentItems = items.filter((i) => i.type === 'rent');
      if (rentItems.length === 1 && rentItems[0].rentId) {
        try {
          const res = await tenantService.getUpiLink(rentItems[0].rentId);
          const link = res?.data?.upiDeepLink || res?.upiDeepLink || res?.data?.upiQrString || '';
          const id = res?.data?.upiId || res?.upiId || '';
          if (link) {
            setUpiLink(link);
            setUpiId(id);
            return;
          }
        } catch (err) {
          console.log('[PaymentSheet] rent UPI link fallback:', err?.message);
        }
      }

      setUpiLink('');
      setUpiId('');
    } catch (err) {
      console.warn('[PaymentSheet] could not generate a UPI link:', err?.message);
      setUpiLink('');
      setUpiId('');
    } finally {
      setUpiLoading(false);
    }
  };

  const openUpiApp = async () => {
    if (!upiLink) return;
    try {
      await Linking.openURL(upiLink);
    } catch {
      toast.warning('Could not open a UPI app. You can copy the UPI ID and pay via your app.');
    }
  };

  const copyUpiId = async () => {
    if (!upiId) return;
    const clipboard = getClipboard();
    if (!clipboard?.setStringAsync) {
      // The running build does not link the clipboard module — show the ID
      // instead of pretending it was copied.
      toast.warning(`Copy is unavailable in this build — UPI ID: ${upiId}`);
      return;
    }
    try {
      await clipboard.setStringAsync(upiId);
      toast.success(`UPI ID copied: ${upiId}`);
    } catch {
      toast.warning(`Could not copy — the UPI ID is ${upiId}`);
    }
  };

  // ── Proof (UPI / Bank Transfer / Cheque / Other) ───────────────────
  const selectProofMethod = async (key) => {
    setMethod(key);
    if (key === 'upi') {
      await selectUpi();
      return;
    }
    setView('proof');
  };

  const cleanUtr = (transactionId || '').replace(/\D/g, '');
  const isFullUtr = cleanUtr.length === 12;

  const submitProof = async () => {
    const meta = PROOF_METHODS[method] || PROOF_METHODS.upi;
    if (meta.refRequired && !transactionId.trim()) {
      toast.error(`Please enter the ${meta.refLabel}`);
      return;
    }
    // Screenshot is mandatory ONLY if 12-digit UTR is not entered
    if (!screenshotUrl && !isFullUtr) {
      toast.error('Please enter the 12-digit UPI UTR number or upload a screenshot');
      return;
    }
    setSubmitting(true);
    try {
      const finalTxnId = isFullUtr ? cleanUtr : transactionId.trim();
      const res = await tenantService.submitDuesPayment({
        items,
        paymentMethod: method,
        transactionId: finalTxnId,
        screenshotUrl: screenshotUrl || undefined,
      });

      const autoApproved = res?.data?.autoApproved || res?.autoApproved;
      if (autoApproved) {
        setView('auto-approved');
        toast.success('⚡ Payment verified automatically!');
        onSuccess?.();
      } else {
        toast.success('Payment submitted for owner approval');
        close();
        onSuccess?.();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cash ───────────────────────────────────────────────────────────
  const selectCash = async () => {
    setMethod('cash');
    setView('cash');
    setCashStage('select');
    if (payees.length > 0 || payeesLoading) return;
    setPayeesLoading(true);
    try {
      const res = await tenantService.getDuesPayees();
      setPayees(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setPayees([]);
    } finally {
      setPayeesLoading(false);
    }
  };

  const sendCashOtp = async () => {
    if (!payeeId) {
      toast.error('Select who received the cash');
      return;
    }
    setCashLoading(true);
    try {
      const res = await tenantService.initCashPayment({ items, payeeId });
      const data = res?.data || res || {};
      setCashRequest(data);
      setCashStage('otp');
      setOtp(data.devOtp ? String(data.devOtp) : '');
      toast.success(res?.message || `OTP sent to ${data.payeeName || 'the payee'}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCashLoading(false);
    }
  };

  const confirmCash = async () => {
    if (!otp.trim()) {
      toast.error('Enter the OTP');
      return;
    }
    setCashLoading(true);
    try {
      const res = await tenantService.confirmCashPayment({ requestId: cashRequest?.requestId, otp: otp.trim() });
      toast.success(res?.message || 'Cash payment recorded');
      close();
      onSuccess?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCashLoading(false);
    }
  };

  // ── Online gateway (Cashfree) ──────────────────────────────────────
  const selectOnline = () => {
    setMethod('online');
    setView('online');
    setCashfreeError('');
    setCashfreeDone(false);
    setCashfreeOrder(null);
  };

  const handleCashfreePay = async () => {
    setCashfreeError('');
    setCashfreeLoading(true);
    try {
      const cfg = await tenantService.getCashfreeConfig().catch(() => null);
      const mode = cfg?.mode || cfg?.data?.mode || 'sandbox';
      const res = await tenantService.createCashfreeOrder({
        rentIds,
        securityDepositAmount: depositAmount,
      });
      const data = res?.data || res;
      setCashfreeOrder(data);

      const checkoutUrl =
        mode === 'production'
          ? `https://payments.cashfree.com/order/#${data.paymentSessionId}`
          : `https://payments-test.cashfree.com/order/#${data.paymentSessionId}`;

      try {
        await Linking.openURL(checkoutUrl);
      } catch {
        toast.warning('Please tap the link to open checkout');
      }
    } catch (err) {
      setCashfreeError(getErrorMessage(err) || 'Could not start the payment. Please try UPI or Cash.');
    } finally {
      setCashfreeLoading(false);
    }
  };

  const checkCashfreeStatus = async () => {
    if (!cashfreeOrder?.orderId) return;
    setCashfreeVerifying(true);
    setCashfreeError('');
    try {
      const res = await tenantService.verifyCashfreeOrder({ orderId: cashfreeOrder.orderId });
      const ok = res?.data?.settled || res?.settled || res?.data?.status === 'paid';
      if (ok) {
        setCashfreeDone(true);
        toast.success('Payment verified & rent marked as paid!');
        onSuccess?.();
      } else {
        setCashfreeError('We could not confirm the payment yet. Please wait a moment and try again.');
      }
    } catch (err) {
      setCashfreeError(
        getErrorMessage(err) || 'Payment could not be confirmed right now. Refresh in a moment, or send your UTR for manual verification.'
      );
    } finally {
      setCashfreeVerifying(false);
    }
  };

  if (!target) return null;

  const proofMeta = PROOF_METHODS[method] || PROOF_METHODS.upi;
  const selectedPayee = payees.find((p) => String(p.id || p._id) === String(payeeId));

  const blueBg = isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff';
  const blueBorder = isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe';
  const greenBg = isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5';
  const greenBorder = isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0';
  const roseBg = isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2';
  const roseBorder = isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca';

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      onBack={view !== 'method' ? backToMethods : undefined}
      title={target.title || 'Checkout & Pay'}
      subtitle={view === 'method' ? 'Pantro Secure Settlement • 256-Bit SSL' : `Step 2: Pay via ${String(method || '').toUpperCase()}`}
      fullPage={true}
    >
      <View style={{ gap: SPACING.md }}>
        {/* ── Checkout Security & Step Header ─── */}
        <View style={styles.checkoutSecurityBar}>
          <View style={styles.securityBadge}>
            <Lock size={12} color="#059669" />
            <Text style={styles.securityBadgeText}>256-Bit SSL Encrypted Checkout</Text>
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              {view === 'method' ? 'Step 1 of 2: Method' : 'Step 2 of 2: Pay'}
            </Text>
          </View>
        </View>

        {/* ── Itemized Order & Dues Summary Card ─── */}
        <View style={[styles.checkoutSummaryCard, { backgroundColor: isDark ? colors.cardSecondary : '#f8fafc', borderColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setItemsExpanded((v) => !v)}
            style={styles.summaryHeaderRow}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.receiptIconBox}>
                <Receipt size={14} color="#2864B2" />
              </View>
              <Text style={[styles.summaryCardTitle, { color: colors.textPrimary }]}>
                ITEMIZED DUES SUMMARY
              </Text>
              <View style={styles.itemCountBadge}>
                <Text style={styles.itemCountBadgeText}>
                  {items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''}` : '1 item'}
                </Text>
              </View>
            </View>
            {items.length > 0 ? (
              itemsExpanded ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />
            ) : null}
          </TouchableOpacity>

          {itemsExpanded && items.length > 0 ? (
            <View style={styles.itemListContainer}>
              {items.map((it, idx) => {
                const isRent = it.type === 'rent';
                const isDep = it.type === 'deposit';
                const itTitle = it.title || (isRent ? `Rent ${it.month}/${it.year}` : isDep ? 'Security Deposit' : 'Pending Due');
                return (
                  <View key={it.id || idx} style={styles.itemRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <View style={[styles.itemTypeDot, { backgroundColor: isRent ? '#2864B2' : isDep ? '#10b981' : '#f59e0b' }]} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.itemTitleText, { color: colors.textPrimary }]} numberOfLines={1}>
                          {itTitle}
                        </Text>
                        {it.subtitle ? (
                          <Text style={[styles.itemSubText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {it.subtitle}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={[styles.itemAmountText, { color: colors.textPrimary }]}>
                      {formatCurrency(Number(it.amount) || 0)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {depositToggle && depositToggle.amount > 0 ? (
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
              <SwitchRow
                label={`Include ${formatCurrency(depositToggle.amount)} security deposit`}
                value={!!depositToggle.checked}
                onValueChange={(v) => depositToggle.onChange?.(v)}
              />
            </View>
          ) : null}

          {/* Price Line Breakdown */}
          <View style={[styles.priceBreakdownBox, { borderTopColor: colors.border }]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceRowLabel, { color: colors.textSecondary }]}>Base Dues Subtotal</Text>
              <Text style={[styles.priceRowVal, { color: colors.textPrimary }]}>{formatCurrency(baseAmount)}</Text>
            </View>
            <View style={styles.priceRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.priceRowLabel, { color: colors.textSecondary }]}>
                  Handling Fee
                </Text>
                {feeSubtext ? (
                  <Text style={{ fontSize: 11, color: handlingFee > 0 ? colors.textSecondary : '#059669', fontWeight: '600', marginTop: 1 }}>
                    {feeSubtext}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.priceRowVal, { color: handlingFee > 0 ? '#d97706' : '#059669', fontWeight: '700' }]}>
                {feeLabel}
              </Text>
            </View>
            <View style={[styles.totalRowDivider, { backgroundColor: colors.border }]} />
            <View style={styles.grandTotalRow}>
              <View>
                <Text style={[styles.grandTotalLabel, { color: colors.textSecondary }]}>TOTAL PAYABLE</Text>
                <Text style={[styles.grandTotalAmount, { color: isDark ? '#ffffff' : '#1e3a8a' }]}>
                  {formatCurrency(totalPayable)}
                </Text>
              </View>
              <View style={styles.verifiedReceiptPill}>
                <ShieldCheck size={13} color="#059669" />
                <Text style={styles.verifiedReceiptPillText}>Instant Tax Receipt</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 1. Method selection ──────────────────────────────── */}
        {view === 'method' ? (
          <>
            <View style={styles.methodHeaderRow}>
              <Text style={[styles.methodSectionHeading, { color: colors.textPrimary }]}>
                Select Payment Method
              </Text>
              <Text style={[styles.methodSectionSubtitle, { color: colors.textSecondary }]}>
                Choose your preferred settlement option
              </Text>
            </View>

            <View style={styles.methodCol}>
              {/* Via UPI Card */}
              {showUpi ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={selectUpi}
                  style={[
                    styles.checkoutMethodCard,
                    {
                      backgroundColor: isDark ? 'rgba(40, 100, 178, 0.12)' : '#f0f7ff',
                      borderColor: '#2864B2',
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <View style={styles.recommendBadge}>
                    <Sparkles size={10} color="#ffffff" />
                    <Text style={styles.recommendBadgeText}>
                      {isManualUpi ? 'DIRECT OWNER UPI' : 'RECOMMENDED • AUTO SETTLE'}
                    </Text>
                  </View>

                  <View style={styles.methodCardInner}>
                    <View style={[styles.radioCircle, { borderColor: '#2864B2', backgroundColor: '#2864B2' }]}>
                      <View style={styles.radioDot} />
                    </View>

                    <View style={[styles.methodIconBox, { backgroundColor: '#dbeafe' }]}>
                      <Smartphone size={22} color="#1d4ed8" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.checkoutMethodTitle, { color: colors.textPrimary }]}>
                          {isManualUpi ? 'Direct Owner UPI' : 'Via UPI & QR'}
                        </Text>
                        <Text style={styles.checkoutMethodPriceUpi}>
                          {formatCurrency(upiPayable)}
                        </Text>
                      </View>
                      <Text style={[styles.checkoutMethodSub, { color: colors.textSecondary }]}>
                        {isManualUpi
                          ? 'Scan & Pay to Owner • Submit UTR & Screenshot for approval'
                          : `Smart Collect • GPay, PhonePe, Paytm, QR (${configuredFee > 0 ? `Incl. ₹${configuredFee} handling fee` : '₹0 fee'})`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : null}

              {/* Cash Card */}
              {showCash ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={selectCash}
                  style={[
                    styles.checkoutMethodCard,
                    {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#bbf7d0',
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View style={styles.methodCardInner}>
                    <View style={[styles.radioCircle, { borderColor: '#10b981' }]} />

                    <View style={[styles.methodIconBox, { backgroundColor: '#dcfce7' }]}>
                      <Banknote size={22} color="#059669" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.checkoutMethodTitle, { color: colors.textPrimary }]}>Cash</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.checkoutMethodPriceCash}>
                            {formatCurrency(baseAmount)}
                          </Text>
                          <Text style={styles.zeroFeePill}>₹0 fee</Text>
                        </View>
                      </View>
                      <Text style={[styles.checkoutMethodSub, { color: colors.textSecondary }]}>
                        Pay physical cash to owner/manager • OTP verification
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : null}

              {/* Online Gateway (if available) */}
              {showOnline ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={selectOnline}
                  style={[
                    styles.checkoutMethodCard,
                    {
                      backgroundColor: isDark ? 'rgba(124, 58, 237, 0.08)' : '#faf5ff',
                      borderColor: isDark ? 'rgba(124, 58, 237, 0.3)' : '#e9d5ff',
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View style={styles.methodCardInner}>
                    <View style={[styles.radioCircle, { borderColor: '#7c3aed' }]} />

                    <View style={[styles.methodIconBox, { backgroundColor: '#ede9fe' }]}>
                      <Globe size={22} color="#7c3aed" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.checkoutMethodTitle, { color: colors.textPrimary }]}>Online Gateway</Text>
                        <View style={styles.instantPill}>
                          <Text style={styles.instantPillText}>Instant</Text>
                        </View>
                      </View>
                      <Text style={[styles.checkoutMethodSub, { color: colors.textSecondary }]}>
                        Cards & Netbanking via Cashfree
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>

            {activeOtherMethods.length > 0 ? (
              <View style={[styles.otherMethods, { borderTopColor: colors.border }]}>
                <Text style={[styles.otherMethodsLabel, { color: colors.textSecondary }]}>OTHER METHODS (₹0 HANDLING FEE)</Text>
                <View style={styles.otherMethodsRow}>
                  {activeOtherMethods.map((key) => (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.75}
                      onPress={() => selectProofMethod(key)}
                      style={[styles.otherChip, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                    >
                      <Text style={[styles.otherChipText, { color: colors.textPrimary }]}>
                        {PROOF_METHODS[key].label} ({formatCurrency(baseAmount)})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {/* ── 2. UPI (Smart Collect or Direct Owner Manual Proof) ─── */}
        {view === 'upi' ? (
          <View style={{ gap: SPACING.md }}>
            {/* QR Code Card */}
            <View style={[styles.qrCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
              {upiLoading ? (
                <View style={{ height: 210, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={{ fontSize: responsiveFontSize(12), color: colors.textSecondary, marginTop: 10 }}>
                    {isManualUpi ? 'Generating Owner UPI QR…' : 'Generating Smart Collect QR…'}
                  </Text>
                </View>
              ) : upiLink || (isManualUpi && ownerQrUrl) ? (
                <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                  <Image
                    source={{
                      uri: (isManualUpi && ownerQrUrl)
                        ? ownerQrUrl
                        : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(upiLink)}`,
                    }}
                    style={{ width: 190, height: 190, borderRadius: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: colors.border }}
                    resizeMode="contain"
                  />
                  <View style={styles.qrAmountPill}>
                    <ShieldCheck size={14} color="#059669" />
                    <Text style={styles.qrAmountPillText}>
                      Locked Amount: {formatCurrency(upiPayable)}
                    </Text>
                  </View>
                  {isManualUpi && ownerName ? (
                    <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff', borderWidth: 1, borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe' }}>
                      <Text style={{ fontSize: responsiveFontSize(11.5), color: '#2563eb', fontWeight: '700' }}>
                        Beneficiary: {ownerName}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ fontSize: responsiveFontSize(11.5), color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
                    {isManualUpi
                      ? 'Scan with Google Pay, PhonePe, Paytm, or BHIM to pay Owner directly'
                      : 'Scan with Google Pay, PhonePe, Paytm, or any UPI app'}
                  </Text>
                </View>
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#ef4444', fontSize: responsiveFontSize(12) }}>
                    Unable to generate UPI QR. Please retry or choose Cash.
                  </Text>
                </View>
              )}

              {upiId ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={copyUpiId}
                  style={[styles.upiCopyBar, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }]}
                >
                  <Text style={{ fontSize: responsiveFontSize(11.5), color: colors.textSecondary, flex: 1 }} numberOfLines={1}>
                    UPI ID: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{upiId}</Text>
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Copy size={13} color="#2563eb" />
                    <Text style={{ fontSize: responsiveFontSize(11.5), fontWeight: '700', color: '#2563eb' }}>Copy</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Installed Applications Section */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: responsiveFontSize(11), fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Pay Directly with Installed App
              </Text>
              <View style={styles.upiAppsGrid}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleLaunchUpiApp('gpay')}
                  style={[styles.upiAppBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', borderColor: colors.border }]}
                >
                  <View style={[styles.upiAppIconBox, { backgroundColor: '#e8f0fe' }]}>
                    <Text style={{ fontSize: responsiveFontSize(13), fontWeight: '800', color: '#1a73e8' }}>G</Text>
                  </View>
                  <Text style={[styles.upiAppBtnText, { color: colors.textPrimary }]} numberOfLines={1}>Google Pay</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleLaunchUpiApp('phonepe')}
                  style={[styles.upiAppBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', borderColor: colors.border }]}
                >
                  <View style={[styles.upiAppIconBox, { backgroundColor: '#f3e8ff' }]}>
                    <Text style={{ fontSize: responsiveFontSize(13), fontWeight: '800', color: '#6739b7' }}>P</Text>
                  </View>
                  <Text style={[styles.upiAppBtnText, { color: colors.textPrimary }]} numberOfLines={1}>PhonePe</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleLaunchUpiApp('paytm')}
                  style={[styles.upiAppBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', borderColor: colors.border }]}
                >
                  <View style={[styles.upiAppIconBox, { backgroundColor: '#e0f2fe' }]}>
                    <Text style={{ fontSize: responsiveFontSize(12), fontWeight: '800', color: '#0284c7' }}>Pay</Text>
                  </View>
                  <Text style={[styles.upiAppBtnText, { color: colors.textPrimary }]} numberOfLines={1}>Paytm</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleLaunchUpiApp('kotak')}
                  style={[styles.upiAppBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', borderColor: colors.border }]}
                >
                  <View style={[styles.upiAppIconBox, { backgroundColor: '#fee2e2' }]}>
                    <Text style={{ fontSize: responsiveFontSize(13), fontWeight: '800', color: '#dc2626' }}>K</Text>
                  </View>
                  <Text style={[styles.upiAppBtnText, { color: colors.textPrimary }]} numberOfLines={1}>Kotak</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleLaunchUpiApp('pop')}
                  style={[styles.upiAppBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', borderColor: colors.border }]}
                >
                  <View style={[styles.upiAppIconBox, { backgroundColor: '#fef3c7' }]}>
                    <Text style={{ fontSize: responsiveFontSize(13), fontWeight: '800', color: '#d97706' }}>Pop</Text>
                  </View>
                  <Text style={[styles.upiAppBtnText, { color: colors.textPrimary }]} numberOfLines={1}>Pop UPI</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleLaunchUpiApp('generic')}
                  style={[styles.upiAppBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', borderColor: colors.border }]}
                >
                  <View style={[styles.upiAppIconBox, { backgroundColor: '#ecfdf5' }]}>
                    <Zap size={16} color="#059669" />
                  </View>
                  <Text style={[styles.upiAppBtnText, { color: colors.textPrimary }]} numberOfLines={1}>Any App</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Reconciliation Flow: Manual Proof (UTR + Screenshot) vs Smart Collect */}
            {isManualUpi ? (
              <>
                <View style={[styles.banner, { backgroundColor: blueBg, borderColor: blueBorder }]}>
                  <Wallet size={16} color="#2563eb" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: responsiveFontSize(12.5), fontWeight: '700', color: isDark ? '#93c5fd' : '#1e40af' }}>
                      Direct Owner UPI Settlement
                    </Text>
                    <Text style={{ fontSize: responsiveFontSize(11.5), color: isDark ? '#bfdbfe' : '#1e3a8a', marginTop: 2, lineHeight: 16 }}>
                      Pay directly to the owner via any UPI app above. Enter the 12-digit UTR number or upload receipt screenshot below so the owner can verify and approve.
                    </Text>
                  </View>
                </View>

                <TextField
                  label="UPI Transaction ID / 12-digit UTR"
                  placeholder="e.g. 423456789012"
                  value={transactionId}
                  onChangeText={(val) => setTransactionId(val.replace(/\D/g, '').slice(0, 12))}
                  helper={screenshotUrl ? 'Optional if screenshot is attached' : 'Required — 12-digit UTR from your UPI payment app'}
                  keyboardType="numeric"
                  maxLength={12}
                />

                <ImageKitUploader
                  label="Payment receipt screenshot (optional if 12-digit UTR entered)"
                  value={screenshotUrl}
                  onChange={setScreenshotUrl}
                  folder="/tenants/payments"
                />

                <Button
                  title="Submit for Owner Approval"
                  icon={CreditCard}
                  onPress={submitProof}
                  loading={submitting}
                  fullWidth
                />
              </>
            ) : (
              <>
                {/* Smart Collect Realtime Settlement Banner */}
                <View style={[styles.banner, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.12)' : '#ecfdf5', borderColor: isDark ? 'rgba(5, 150, 105, 0.25)' : '#a7f3d0' }]}>
                  <ShieldCheck size={16} color="#059669" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: responsiveFontSize(12.5), fontWeight: '700', color: isDark ? '#6ee7b7' : '#065f46' }}>
                      Smart Collect Realtime Settlement Active
                    </Text>
                    <Text style={{ fontSize: responsiveFontSize(11.5), color: isDark ? '#a7f3d0' : '#047857', marginTop: 2, lineHeight: 16 }}>
                      Payments made via UPI are verified in realtime through Smart Collect and settled directly via RazorpayX. No UTR entry needed!
                    </Text>
                  </View>
                </View>

                {/* Confirm button */}
                <Button
                  title="I Have Completed Payment"
                  icon={CheckCircle}
                  onPress={handleConfirmPaidUpi}
                  fullWidth
                />
              </>
            )}

            <TouchableOpacity onPress={backToMethods} style={styles.backBtn}>
              <Text style={[styles.backText, { color: colors.textSecondary }]}>← Change payment method</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── 3. Other proof methods (bank transfer / cheque / other) */}
        {view === 'proof' ? (
          <View style={{ gap: SPACING.md }}>
            <View style={[styles.banner, { backgroundColor: blueBg, borderColor: blueBorder }]}>
              <Wallet size={16} color="#2563eb" style={{ marginTop: 1 }} />
              <Text style={[styles.bannerText, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
                You are paying <Text style={{ fontWeight: 'bold' }}>{formatCurrency(baseAmount)}</Text> via {proofMeta.label} (₹0 handling fee).
                Submit the reference and a screenshot so the owner can verify it.
              </Text>
            </View>

            <TextField
              label={proofMeta.refLabel}
              placeholder={proofMeta.refPlaceholder}
              value={transactionId}
              onChangeText={setTransactionId}
              helper={proofMeta.refRequired ? 'Required — the owner uses this to verify your payment' : 'Optional'}
              required={proofMeta.refRequired}
            />

            <ImageKitUploader
              label="Payment screenshot (required)"
              value={screenshotUrl}
              onChange={setScreenshotUrl}
              folder="/tenants/payments"
              required
            />

            <Button
              title="Submit for Approval"
              icon={CreditCard}
              onPress={submitProof}
              loading={submitting}
              fullWidth
            />

            <TouchableOpacity onPress={backToMethods} style={styles.backBtn}>
              <Text style={[styles.backText, { color: colors.textSecondary }]}>← Change payment method</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── 4. Cash — pick the payee ─────────────────────────── */}
        {view === 'cash' && cashStage === 'select' ? (
          <View style={{ gap: SPACING.md }}>
            <View style={[styles.banner, { backgroundColor: greenBg, borderColor: greenBorder }]}>
              <Wallet size={16} color="#059669" style={{ marginTop: 1 }} />
              <Text style={[styles.bannerText, { color: isDark ? '#6ee7b7' : '#065f46' }]}>
                You&apos;re paying <Text style={{ fontWeight: 'bold' }}>{formatCurrency(amount)}</Text> in cash. Choose who
                received the money — an OTP goes to them to confirm.
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Who received the cash?</Text>

            {payeesLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.sm }} />
            ) : payees.length === 0 ? (
              <Text style={[styles.warnText, { color: COLORS.warning }]}>
                No owner or manager is available to confirm a cash payment right now.
              </Text>
            ) : (
              payees.map((p) => {
                const pid = String(p.id || p._id);
                const isSelected = String(payeeId) === pid;
                return (
                  <TouchableOpacity
                    key={pid}
                    activeOpacity={0.75}
                    onPress={() => setPayeeId(p.id || p._id)}
                    style={[
                      styles.payeeCard,
                      {
                        backgroundColor: isSelected ? greenBg : isDark ? colors.cardSecondary : '#ffffff',
                        borderColor: isSelected ? '#10b981' : colors.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.payeeName, { color: colors.textPrimary }]}>{p.name}</Text>
                      <Text style={[styles.payeeRole, { color: colors.textSecondary }]}>
                        {p.role === 'owner' ? 'Property Owner' : 'Property Manager'}
                        {p.phoneMasked ? ` • ${p.phoneMasked}` : ' • No phone'}
                        {p.canReceiveOtp === false ? ' — cannot receive OTP' : ''}
                      </Text>
                    </View>
                    <View style={[styles.radio, isSelected && { borderColor: '#10b981', backgroundColor: '#10b981' }]}>
                      {isSelected ? <Check size={12} color="#ffffff" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            <Button
              title="Send OTP to confirm"
              icon={ShieldCheck}
              onPress={sendCashOtp}
              loading={cashLoading}
              disabled={!payeeId || payees.length === 0 || selectedPayee?.canReceiveOtp === false}
              fullWidth
            />

            <TouchableOpacity onPress={backToMethods} style={styles.backBtn}>
              <Text style={[styles.backText, { color: colors.textSecondary }]}>← Change payment method</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── 5. Cash — confirm the OTP ─────────────────────────── */}
        {view === 'cash' && cashStage === 'otp' ? (
          <View style={{ gap: SPACING.md }}>
            <View style={[styles.banner, { backgroundColor: greenBg, borderColor: greenBorder }]}>
              <ShieldCheck size={18} color="#059669" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerTitle, { color: isDark ? '#6ee7b7' : '#065f46' }]}>
                  {cashRequest?.payeeName || 'The payee'} received{' '}
                  <Text style={{ fontWeight: 'bold' }}>{formatCurrency(cashRequest?.amount ?? amount)}</Text>
                </Text>
                <Text style={[styles.bannerText, { color: isDark ? '#a7f3d0' : '#047857', marginTop: 2 }]}>
                  An OTP was sent to {cashRequest?.phoneMasked || 'their phone'}. Ask them to share it to confirm the payment.
                </Text>
              </View>
            </View>

            <TextField
              label="Enter OTP"
              placeholder="6-digit code"
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              helper="The person who received the cash shares this code with you."
              required
            />

            <Button
              title="Confirm payment"
              icon={CheckCircle}
              onPress={confirmCash}
              loading={cashLoading}
              fullWidth
            />

            <View style={styles.otpActions}>
              <TouchableOpacity onPress={sendCashOtp} disabled={cashLoading}>
                <Text style={styles.resendText}>↻ Resend OTP</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setCashStage('select'); setOtp(''); setCashRequest(null); }}>
                <Text style={[styles.backText, { color: colors.textSecondary }]}>← Change payee</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ── 6. Online gateway ─────────────────────────────────── */}
        {view === 'online' ? (
          <View style={{ gap: SPACING.md }}>
            {cashfreeDone ? (
              <View style={styles.successBox}>
                <View style={styles.successIconWrap}>
                  <CheckCircle size={36} color="#059669" />
                </View>
                <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Payment received</Text>
                <Text style={[styles.successDesc, { color: colors.textSecondary }]}>
                  Your payment of{' '}
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{formatCurrency(amount)}</Text> has been
                  settled automatically. Your rent{depositAmount > 0 ? ' and deposit' : ''} is marked as paid.
                </Text>
                <Button title="Done" onPress={close} fullWidth />
              </View>
            ) : (
              <>
                <View style={[styles.totalBox, { backgroundColor: blueBg, borderColor: blueBorder }]}>
                  <Text style={[styles.totalLabel, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>PAY VIA CASHFREE</Text>
                  <Text style={[styles.totalSub, { color: colors.textPrimary }]}>UPI · Cards · NetBanking</Text>
                  <Text style={[styles.totalSub, { color: colors.textSecondary, marginTop: 4 }]}>
                    {rentIds.length} rent month{rentIds.length === 1 ? '' : 's'}
                    {depositAmount > 0 ? ' + deposit' : ''}
                  </Text>
                </View>

                <View style={[styles.banner, { backgroundColor: greenBg, borderColor: greenBorder }]}>
                  <ShieldCheck size={16} color="#059669" style={{ marginTop: 1 }} />
                  <Text style={[styles.bannerText, { color: isDark ? '#6ee7b7' : '#065f46' }]}>
                    Pay securely in a Cashfree-hosted window. The money goes straight to the property owner&apos;s verified bank
                    account and your rent is marked paid automatically — no manual proof needed.
                  </Text>
                </View>

                {cashfreeError ? (
                  <View style={[styles.banner, { backgroundColor: roseBg, borderColor: roseBorder }]}>
                    <AlertCircle size={16} color="#ef4444" style={{ marginTop: 1 }} />
                    <Text style={[styles.bannerText, { color: isDark ? '#fca5a5' : '#991b1b' }]}>{cashfreeError}</Text>
                  </View>
                ) : null}

                {cashfreeVerifying ? (
                  <View style={styles.centerRow}>
                    <Loader2 size={18} color="#2563eb" />
                    <Text style={[styles.muted, { color: colors.textSecondary }]}>Confirming payment…</Text>
                  </View>
                ) : cashfreeOrder ? (
                  <View style={{ gap: SPACING.sm }}>
                    <Text style={[styles.orderInfo, { color: colors.textSecondary }]}>
                      The payment window was opened in your browser. Complete the payment there, then tap below to verify.
                    </Text>
                    <Button
                      title="Check Payment Status"
                      icon={ShieldCheck}
                      onPress={checkCashfreeStatus}
                      loading={cashfreeVerifying}
                      fullWidth
                    />
                    <Button
                      title="Re-open Payment Page"
                      variant="outline"
                      icon={ExternalLink}
                      onPress={handleCashfreePay}
                      loading={cashfreeLoading}
                      fullWidth
                    />
                  </View>
                ) : (
                  <View style={{ gap: SPACING.sm }}>
                    <Button
                      title={`Pay ${formatCurrency(amount)} Online`}
                      icon={CreditCard}
                      onPress={handleCashfreePay}
                      loading={cashfreeLoading}
                      disabled={amount <= 0}
                      fullWidth
                    />
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>
                      Prefer UPI/cash? Use the manual option and submit a proof for approval.
                    </Text>
                  </View>
                )}

                <TouchableOpacity onPress={backToMethods} style={styles.backBtn}>
                  <Text style={[styles.backText, { color: colors.textSecondary }]}>← Change payment method</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {/* ── 2B. Instant Auto-Approved State ───────────────────── */}
        {view === 'auto-approved' ? (
          <View style={{ alignItems: 'center', paddingVertical: SPACING.lg, gap: SPACING.md }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#10b981',
              }}
            >
              <CheckCircle size={38} color="#10b981" />
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: responsiveFontSize(20), fontWeight: '800', color: colors.textPrimary, textAlign: 'center' }}>
                Payment Auto-Verified! 🎉
              </Text>
              <Text
                style={{
                  fontSize: responsiveFontSize(13),
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginTop: 6,
                  lineHeight: 19,
                }}
              >
                Your payment of{' '}
                <Text style={{ fontWeight: '800', color: '#10b981' }}>{formatCurrency(amount)}</Text> was verified
                automatically via the owner&apos;s bank feed.
              </Text>
              <Text style={{ fontSize: responsiveFontSize(11.5), color: colors.textTertiary, marginTop: 8 }}>
                UTR:{' '}
                <Text style={{ fontFamily: 'monospace', fontWeight: '700', color: colors.textPrimary }}>
                  {cleanUtr || transactionId}
                </Text>{' '}
                · Zero manual delay
              </Text>
            </View>

            <View style={{ width: '100%', marginTop: SPACING.sm }}>
              <Button
                title="Done"
                icon={Check}
                onPress={() => {
                  close();
                  onSuccess?.();
                }}
                fullWidth
              />
            </View>
          </View>
        ) : null}

        {/* ── Security Trust Footer ─── */}
        <View style={[styles.checkoutTrustFooter, { borderTopColor: colors.border }]}>
          <View style={styles.trustFooterItem}>
            <ShieldCheck size={13} color="#059669" />
            <Text style={[styles.trustFooterText, { color: colors.textSecondary }]}>100% Safe</Text>
          </View>
          <View style={styles.trustFooterDot} />
          <View style={styles.trustFooterItem}>
            <Receipt size={13} color="#2864B2" />
            <Text style={[styles.trustFooterText, { color: colors.textSecondary }]}>Instant Receipt</Text>
          </View>
          <View style={styles.trustFooterDot} />
          <View style={styles.trustFooterItem}>
            <Lock size={12} color="#64748b" />
            <Text style={[styles.trustFooterText, { color: colors.textSecondary }]}>RazorpayX</Text>
          </View>
        </View>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  totalBox: { borderWidth: 1, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, alignItems: 'center' },
  totalLabel: { fontSize: responsiveFontSize(10), fontWeight: '800', letterSpacing: 1.2 },
  totalAmount: { fontSize: responsiveFontSize(28), fontWeight: '800', marginVertical: 2 },
  totalSub: { fontSize: responsiveFontSize(12), textAlign: 'center' },
  prompt: { fontSize: responsiveFontSize(FONT_SIZES.sm), fontWeight: '600' },
  methodCol: { flexDirection: 'column', gap: SPACING.sm, width: '100%' },
  methodRow: { flexDirection: 'column', gap: SPACING.sm, width: '100%' },
  methodCard: { flex: 1, width: '100%' },
  methodCardWide: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, width: '100%' },
  methodIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  methodIconWide: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  methodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  methodTitle: { fontSize: responsiveFontSize(FONT_SIZES.md), fontWeight: '700' },
  methodSub: { fontSize: responsiveFontSize(10.5), marginTop: 2 },
  instantPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  instantPillText: { fontSize: responsiveFontSize(9.5), fontWeight: '800', color: '#7c3aed', letterSpacing: 0.5 },
  otherMethods: { borderTopWidth: 1, paddingTop: SPACING.md },
  otherMethodsLabel: { fontSize: responsiveFontSize(10), fontWeight: '800', letterSpacing: 1.2, marginBottom: SPACING.sm },
  otherMethodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  otherChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  otherChipText: { fontSize: responsiveFontSize(12), fontWeight: '600' },
  qrCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  qrAmountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
  },
  qrAmountPillText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
    color: '#065f46',
  },
  upiCopyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  upiAppsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  upiAppBtn: {
    width: '31.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  upiAppIconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiAppBtnText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    flex: 1,
  },
  banner: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  bannerTitle: { fontSize: responsiveFontSize(FONT_SIZES.xs), fontWeight: '700' },
  bannerText: { flex: 1, fontSize: responsiveFontSize(12), lineHeight: 17 },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: SPACING.md },
  muted: { fontSize: responsiveFontSize(12) },
  upiIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  upiIdText: { fontSize: responsiveFontSize(12), flex: 1 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: SPACING.sm },
  copyText: { color: '#2563eb', fontSize: responsiveFontSize(12), fontWeight: '700' },
  backBtn: { paddingVertical: SPACING.sm, alignItems: 'center' },
  backText: { fontSize: responsiveFontSize(12), fontWeight: '600' },
  fieldLabel: { fontSize: responsiveFontSize(FONT_SIZES.xs), fontWeight: '700', textTransform: 'uppercase' },
  warnText: { fontSize: responsiveFontSize(12), paddingVertical: SPACING.sm },
  payeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  payeeName: { fontSize: responsiveFontSize(FONT_SIZES.sm), fontWeight: '700' },
  payeeRole: { fontSize: responsiveFontSize(11), marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resendText: { fontSize: responsiveFontSize(12), fontWeight: '700', color: '#059669' },
  orderInfo: { fontSize: responsiveFontSize(12), lineHeight: 17, textAlign: 'center' },
  hint: { fontSize: responsiveFontSize(11), textAlign: 'center' },
  successBox: { alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.md },
  successIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: responsiveFontSize(16), fontWeight: '800', textAlign: 'center' },
  successDesc: { fontSize: responsiveFontSize(12.5), textAlign: 'center', lineHeight: 18, paddingHorizontal: SPACING.sm },

  /* ── Checkout Enhancement Styles ─── */
  checkoutSecurityBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginBottom: -2,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  securityBadgeText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    color: '#059669',
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(40, 100, 178, 0.1)',
  },
  stepBadgeText: {
    fontSize: responsiveFontSize(10.5),
    fontWeight: '700',
    color: '#2864B2',
  },
  checkoutSummaryCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptIconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(40, 100, 178, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardTitle: {
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  itemCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  itemCountBadgeText: {
    fontSize: responsiveFontSize(10.5),
    fontWeight: '700',
    color: '#64748b',
  },
  itemListContainer: {
    gap: 8,
    paddingTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  itemTypeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  itemTitleText: {
    fontSize: responsiveFontSize(12.5),
    fontWeight: '600',
  },
  itemSubText: {
    fontSize: responsiveFontSize(10.5),
    marginTop: 1,
  },
  itemAmountText: {
    fontSize: responsiveFontSize(12.5),
    fontWeight: '700',
  },
  priceBreakdownBox: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceRowLabel: {
    fontSize: responsiveFontSize(11.5),
  },
  priceRowVal: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
  },
  totalRowDivider: {
    height: 1,
    marginVertical: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  grandTotalLabel: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  grandTotalAmount: {
    fontSize: responsiveFontSize(24),
    fontWeight: '900',
    marginTop: 1,
  },
  verifiedReceiptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  verifiedReceiptPillText: {
    fontSize: responsiveFontSize(10.5),
    fontWeight: '700',
    color: '#065f46',
  },
  methodHeaderRow: {
    marginTop: 2,
    marginBottom: -2,
  },
  methodSectionHeading: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  methodSectionSubtitle: {
    fontSize: responsiveFontSize(11),
    marginTop: 2,
  },
  checkoutMethodCard: {
    borderRadius: 14,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  recommendBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#2864B2',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderBottomLeftRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendBadgeText: {
    fontSize: responsiveFontSize(8.5),
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  methodCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutMethodTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: '800',
  },
  checkoutMethodPriceUpi: {
    fontSize: responsiveFontSize(14.5),
    fontWeight: '900',
    color: '#2864B2',
  },
  checkoutMethodPriceCash: {
    fontSize: responsiveFontSize(14.5),
    fontWeight: '900',
    color: '#059669',
  },
  zeroFeePill: {
    fontSize: responsiveFontSize(9.5),
    fontWeight: '700',
    color: '#059669',
    marginTop: 1,
  },
  checkoutMethodSub: {
    fontSize: responsiveFontSize(11),
    marginTop: 3,
    lineHeight: 15,
  },
  checkoutTrustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  trustFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustFooterText: {
    fontSize: responsiveFontSize(10.5),
    fontWeight: '600',
  },
  trustFooterDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#94a3b8',
  },
});
