import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
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
} from 'lucide-react-native';
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

  // UPI / proof state
  const [upiLink, setUpiLink] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiLoading, setUpiLoading] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
  const rentIds = useMemo(() => target?.rentIds || [], [target]);
  const depositAmount = Number(target?.depositAmount) || 0;
  const showOnline = target?.showOnline !== false && (rentIds.length > 0 || depositAmount > 0);
  const depositToggle = target?.depositToggle || null;

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
          const res = await tenantService.getDuesUpiLink(items);
          const link = res?.data?.upiDeepLink || res?.upiLink || res?.upiDeepLink || res?.data?.upiQrString || '';
          const id = res?.data?.upiId || res?.upiId || '';
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
        const acc = (info?.upiAccounts && info.upiAccounts[0]) || null;
        const accId = info?.upiId || acc?.upiId;
        const accName = info?.upiName || acc?.upiName || 'Payment';
        if (accId && amount > 0) {
          setUpiLink(
            `upi://pay?pa=${encodeURIComponent(accId)}&pn=${encodeURIComponent(accName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(
              target?.title || 'Payment'
            )}`
          );
          setUpiId(accId);
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
      const res = await tenantService.submitDuesPayment({
        items,
        paymentMethod: method,
        transactionId: transactionId.trim(),
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
    <ModalSheet visible={visible} onClose={close} title={target.title || 'Pay'}>
      <View style={{ gap: SPACING.md }}>
        {/* ── Total ─────────────────────────────────────────────── */}
        <View style={[styles.totalBox, { backgroundColor: blueBg, borderColor: blueBorder }]}>
          <Text style={[styles.totalLabel, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>TOTAL TO PAY</Text>
          <Text style={[styles.totalAmount, { color: isDark ? '#ffffff' : '#1e3a8a' }]}>{formatCurrency(amount)}</Text>
          {target.summary ? (
            <Text style={[styles.totalSub, { color: colors.textSecondary }]}>{target.summary}</Text>
          ) : null}

          {depositToggle && depositToggle.amount > 0 ? (
            <View style={{ marginTop: SPACING.sm }}>
              <SwitchRow
                label={`Also pay ${formatCurrency(depositToggle.amount)} security deposit`}
                value={!!depositToggle.checked}
                onValueChange={(v) => depositToggle.onChange?.(v)}
              />
            </View>
          ) : null}
        </View>

        {/* ── 1. Method selection ──────────────────────────────── */}
        {view === 'method' ? (
          <>
            <Text style={[styles.prompt, { color: colors.textPrimary }]}>How would you like to pay?</Text>

            <View style={styles.methodRow}>
              <Card onPress={selectUpi} style={styles.methodCard}>
                <View style={[styles.methodIcon, { backgroundColor: '#eff6ff' }]}>
                  <Smartphone size={20} color="#2563eb" />
                </View>
                <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>UPI</Text>
                <Text style={[styles.methodSub, { color: colors.textSecondary }]}>GPay, PhonePe, Paytm &amp; screenshot</Text>
              </Card>

              <Card onPress={selectCash} style={styles.methodCard}>
                <View style={[styles.methodIcon, { backgroundColor: '#ecfdf5' }]}>
                  <Banknote size={20} color="#059669" />
                </View>
                <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>Cash</Text>
                <Text style={[styles.methodSub, { color: colors.textSecondary }]}>Pay in person, confirmed by OTP</Text>
              </Card>
            </View>

            {showOnline ? (
              <Card onPress={selectOnline} style={styles.methodCardWide}>
                <View style={[styles.methodIcon, { backgroundColor: '#f5f3ff' }]}>
                  <Globe size={20} color="#7c3aed" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.methodTitleRow}>
                    <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>Pay Online Gateway</Text>
                    <View style={styles.instantPill}>
                      <Text style={styles.instantPillText}>Instant</Text>
                    </View>
                  </View>
                  <Text style={[styles.methodSub, { color: colors.textSecondary }]}>
                    UPI, Credit/Debit Cards, Netbanking — auto-verified instantly
                  </Text>
                </View>
              </Card>
            ) : null}

            <View style={[styles.otherMethods, { borderTopColor: colors.border }]}>
              <Text style={[styles.otherMethodsLabel, { color: colors.textSecondary }]}>OTHER METHODS</Text>
              <View style={styles.otherMethodsRow}>
                {OTHER_METHODS.map((key) => (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.75}
                    onPress={() => selectProofMethod(key)}
                    style={[styles.otherChip, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                  >
                    <Text style={[styles.otherChipText, { color: colors.textPrimary }]}>{PROOF_METHODS[key].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {/* ── 2. UPI ────────────────────────────────────────────── */}
        {view === 'upi' ? (
          <View style={{ gap: SPACING.md }}>
            <View style={[styles.banner, { backgroundColor: blueBg, borderColor: blueBorder }]}>
              <Zap size={18} color="#2563eb" style={{ marginTop: 1 }} />
              <Text style={[styles.bannerText, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
                Pay <Text style={{ fontWeight: 'bold' }}>{formatCurrency(amount)}</Text> via UPI. Enter your{' '}
                <Text style={{ fontWeight: 'bold' }}>12-digit UPI Reference (UTR)</Text> for{' '}
                <Text style={{ fontWeight: 'bold' }}>instant 1-second auto-approval</Text>!
              </Text>
            </View>

            {isFullUtr ? (
              <View style={[styles.banner, { backgroundColor: greenBg, borderColor: greenBorder }]}>
                <CheckCircle size={16} color="#059669" style={{ marginTop: 1 }} />
                <Text style={[styles.bannerText, { color: isDark ? '#6ee7b7' : '#065f46' }]}>
                  ✨ 12-digit UTR detected! Screenshot is optional. Tap submit to auto-verify against the owner&apos;s bank feed.
                </Text>
              </View>
            ) : null}

            {upiLoading ? (
              <View style={styles.centerRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={[styles.muted, { color: colors.textSecondary }]}>Generating UPI link…</Text>
              </View>
            ) : upiLink ? (
              <>
                <Button
                  title="Open UPI App"
                  icon={ExternalLink}
                  onPress={openUpiApp}
                  fullWidth
                />
                {upiId ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={copyUpiId}
                    style={[styles.upiIdRow, { backgroundColor: blueBg, borderColor: blueBorder }]}
                  >
                    <Text style={[styles.upiIdText, { color: colors.textPrimary }]} numberOfLines={1} selectable>
                      UPI ID: <Text style={{ fontFamily: 'monospace', fontWeight: '700' }}>{upiId}</Text>
                    </Text>
                    <View style={styles.copyRow}>
                      <Copy size={13} color="#2563eb" />
                      <Text style={styles.copyText}>Copy</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <View style={[styles.banner, { backgroundColor: roseBg, borderColor: roseBorder }]}>
                <AlertCircle size={16} color="#ef4444" style={{ marginTop: 1 }} />
                <Text style={[styles.bannerText, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
                  UPI ID not available. Please contact your manager for payment details.
                </Text>
              </View>
            )}

            <TextField
              label="12-Digit UPI Reference / UTR Number"
              placeholder="e.g. 429812345678"
              value={transactionId}
              onChangeText={setTransactionId}
              helper={isFullUtr ? "✨ Valid 12-digit UTR detected" : "Copied from Google Pay, PhonePe, or Paytm payment receipt"}
              required
              keyboardType="numeric"
            />

            <ImageKitUploader
              label={isFullUtr ? "Payment screenshot (optional)" : "Payment screenshot (required)"}
              value={screenshotUrl}
              onChange={setScreenshotUrl}
              folder="/tenants/payments"
              required={!isFullUtr}
            />

            <Button
              title={isFullUtr ? "Submit & Auto-Verify" : "Submit for Approval"}
              icon={isFullUtr ? Zap : CreditCard}
              onPress={submitProof}
              loading={submitting}
              fullWidth
            />

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
                You are paying <Text style={{ fontWeight: 'bold' }}>{formatCurrency(amount)}</Text> via {proofMeta.label}.
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
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' }}>
                Payment Auto-Verified! 🎉
              </Text>
              <Text
                style={{
                  fontSize: 13,
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
              <Text style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 8 }}>
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
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  totalBox: { borderWidth: 1, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, alignItems: 'center' },
  totalLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  totalAmount: { fontSize: 28, fontWeight: '800', marginVertical: 2 },
  totalSub: { fontSize: 12, textAlign: 'center' },
  prompt: { fontSize: FONT_SIZES.sm, fontWeight: '600' },
  methodRow: { flexDirection: 'row', gap: SPACING.sm },
  methodCard: { flex: 1 },
  methodCardWide: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  methodIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  methodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  methodTitle: { fontSize: FONT_SIZES.md, fontWeight: '700' },
  methodSub: { fontSize: 10.5, marginTop: 2 },
  instantPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  instantPillText: { fontSize: 9.5, fontWeight: '800', color: '#7c3aed', letterSpacing: 0.5 },
  otherMethods: { borderTopWidth: 1, paddingTop: SPACING.md },
  otherMethodsLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: SPACING.sm },
  otherMethodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  otherChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  otherChipText: { fontSize: 12, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  bannerTitle: { fontSize: FONT_SIZES.xs, fontWeight: '700' },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 17 },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: SPACING.md },
  muted: { fontSize: 12 },
  upiIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  upiIdText: { fontSize: 12, flex: 1 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: SPACING.sm },
  copyText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
  backBtn: { paddingVertical: SPACING.sm, alignItems: 'center' },
  backText: { fontSize: 12, fontWeight: '600' },
  fieldLabel: { fontSize: FONT_SIZES.xs, fontWeight: '700', textTransform: 'uppercase' },
  warnText: { fontSize: 12, paddingVertical: SPACING.sm },
  payeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  payeeName: { fontSize: FONT_SIZES.sm, fontWeight: '700' },
  payeeRole: { fontSize: 11, marginTop: 2 },
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
  resendText: { fontSize: 12, fontWeight: '700', color: '#059669' },
  orderInfo: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  hint: { fontSize: 11, textAlign: 'center' },
  successBox: { alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.md },
  successIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  successDesc: { fontSize: 12.5, textAlign: 'center', lineHeight: 18, paddingHorizontal: SPACING.sm },
});
