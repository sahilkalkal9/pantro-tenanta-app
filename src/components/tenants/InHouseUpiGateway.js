import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Image,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  QrCode,
  Smartphone,
  Check,
  Sparkles,
  ArrowRight,
} from 'lucide-react-native';
import { tenantService } from '../../services/tenantService';
import { useToast } from '../../hooks/useToast';
import { formatCurrency } from '../../lib/format';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/colors';

function getClipboard() {
  try {
    // eslint-disable-next-line global-require
    return require('expo-clipboard');
  } catch {
    return null;
  }
}

export default function InHouseUpiGateway({
  target,
  items,
  amount,
  onSuccess,
  onClose,
  onBack,
}) {
  const toast = useToast();
  const { colors, isDark } = useTheme();

  // Gateway Session State
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const [gatewayState, setGatewayState] = useState('active'); // active | success | expired

  // Real-time polling & settlement state
  const [pollingActive, setPollingActive] = useState(true);
  const [paidData, setPaidData] = useState(null);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 mins

  // QR Code visibility toggle
  const [showQr, setShowQr] = useState(false);

  // Manual UTR Fallback state
  const [showUtrBox, setShowUtrBox] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);

  // Test Simulation state
  const [simulating, setSimulating] = useState(false);

  // Radar Pulse Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  // 1. Create In-House Gateway Session on mount
  const initGateway = useCallback(async () => {
    setLoading(true);
    setSessionError('');
    try {
      const data = await tenantService.createUpiGatewaySession(items);
      setSession(data);
      if (data?.expiresAt) {
        const remainingSec = Math.max(
          0,
          Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
        );
        setTimeLeft(remainingSec || 15 * 60);
      }
    } catch (err) {
      setSessionError(
        typeof err === 'string'
          ? err
          : err?.response?.data?.message || err?.message || 'Could not initiate UPI Gateway'
      );
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    initGateway();
  }, [initGateway]);

  // 2. Countdown timer countdown
  useEffect(() => {
    if (gatewayState !== 'active' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGatewayState('expired');
          setPollingActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gatewayState, timeLeft]);

  // 3. Real-Time Status Polling (Every 2.5 seconds)
  useEffect(() => {
    if (!pollingActive || !session?.sessionId || gatewayState !== 'active') return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const res = await tenantService.getGatewaySessionStatus(session.sessionId);
        if (!isMounted) return;

        if (res?.status === 'paid') {
          setPaidData(res);
          setGatewayState('success');
          setPollingActive(false);
          toast.success('⚡ Payment Verified & Settled Instantly!');
          onSuccess?.();
        } else if (res?.status === 'expired') {
          setGatewayState('expired');
          setPollingActive(false);
        }
      } catch (_) {
        // silent fail on network blips
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [pollingActive, session?.sessionId, gatewayState, onSuccess, toast]);

  // 4. UPI App Opener with specific fallback
  const handleOpenUpiApp = async (appKey) => {
    if (!session?.universalUpiLink) return;

    let targetLink = session.universalUpiLink;
    if (appKey === 'phonepe' && session.phonepeLink) {
      targetLink = session.phonepeLink;
    } else if (appKey === 'gpay' && session.gpayLink) {
      targetLink = session.gpayLink;
    } else if (appKey === 'paytm' && session.paytmLink) {
      targetLink = session.paytmLink;
    }

    try {
      const canOpen = await Linking.canOpenURL(targetLink).catch(() => false);
      if (canOpen) {
        await Linking.openURL(targetLink);
        return;
      }
    } catch (_) {
      // fallback
    }

    // Fallback: Open Universal UPI link
    try {
      await Linking.openURL(session.universalUpiLink);
    } catch (_) {
      toast.warning('Could not launch selected app. You can scan the QR code or copy the UPI ID.');
    }
  };

  // 5. Copy UPI ID helper
  const copyUpiId = async () => {
    if (!session?.upiId) return;
    const clipboard = getClipboard();
    if (clipboard?.setStringAsync) {
      await clipboard.setStringAsync(session.upiId);
      toast.success(`UPI ID copied: ${session.upiId}`);
    } else {
      toast.info(`UPI ID: ${session.upiId}`);
    }
  };

  // 6. Manual UTR Submission Fallback
  const handleUtrSubmit = async () => {
    const clean = utrInput.replace(/\D/g, '');
    if (clean.length !== 12) {
      toast.error('Please enter a valid 12-digit UPI UTR reference number');
      return;
    }

    setSubmittingUtr(true);
    try {
      const res = await tenantService.submitGatewayUtr(session.sessionId, clean);
      if (res?.status === 'paid' || res?.autoApproved) {
        setPaidData(res);
        setGatewayState('success');
        setPollingActive(false);
        toast.success('⚡ UTR matched! Rent settled instantly!');
        onSuccess?.();
      } else {
        toast.info('UTR submitted. Waiting for bank notification confirmation…');
        setShowUtrBox(false);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to submit UTR');
    } finally {
      setSubmittingUtr(false);
    }
  };

  const handlePasteClipboard = async () => {
    const clipboard = getClipboard();
    if (clipboard?.getStringAsync) {
      try {
        const text = await clipboard.getStringAsync();
        const digits = (text || '').replace(/\D/g, '');
        if (digits.length >= 12) {
          setUtrInput(digits.slice(-12));
          toast.success('12-digit UTR pasted!');
        } else {
          setUtrInput(text || '');
        }
      } catch (_) {}
    }
  };

  // 7. Developer / Test Simulation helper
  const handleSimulatePayment = async () => {
    if (!session?.sessionId) return;
    setSimulating(true);
    try {
      await tenantService.simulateGatewayPayment(session.sessionId);
      toast.success('Simulated payment received on owner phone! Auto-settling…');
      // The polling loop will detect it within 2 seconds
    } catch (err) {
      toast.error('Simulation error: ' + (err?.message || 'Failed'));
    } finally {
      setSimulating(false);
    }
  };

  // Format countdown minutes:seconds
  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const qrImageUrl = session?.universalUpiLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(
        session.universalUpiLink
      )}`
    : null;

  // ── SUCCESS CELEBRATION VIEW ──────────────────────────────────────
  if (gatewayState === 'success') {
    return (
      <View style={styles.container}>
        <View style={styles.successCard}>
          <View style={styles.successIconCircle}>
            <CheckCircle2 size={54} color="#10b981" />
          </View>

          <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
            Payment Successful!
          </Text>

          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            Rent & dues settled instantly via Pantro In-House UPI Gateway.
          </Text>

          <View style={[styles.successAmountBox, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5', borderColor: '#10b981' }]}>
            <Text style={styles.successAmountLabel}>AMOUNT PAID</Text>
            <Text style={styles.successAmountValue}>{formatCurrency(amount)}</Text>
            <View style={styles.autoBadge}>
              <Zap size={12} color="#059669" />
              <Text style={styles.autoBadgeText}>⚡ Auto-Verified & Approved</Text>
            </View>
          </View>

          {paidData?.utr ? (
            <View style={[styles.metaRow, { borderColor: colors.border }]}>
              <Text style={[styles.metaKey, { color: colors.textSecondary }]}>UPI Ref / UTR:</Text>
              <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{paidData.utr}</Text>
            </View>
          ) : null}

          {paidData?.appOrBank ? (
            <View style={[styles.metaRow, { borderColor: colors.border }]}>
              <Text style={[styles.metaKey, { color: colors.textSecondary }]}>Payment App:</Text>
              <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{paidData.appOrBank}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: SPACING.lg, width: '100%', gap: SPACING.sm }}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.primaryBtn, { backgroundColor: '#10b981' }]}
              onPress={onClose}
            >
              <Check size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Done / View Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── EXPIRED VIEW ──────────────────────────────────────────────────
  if (gatewayState === 'expired') {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 12 }} />
        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Gateway Session Expired</Text>
        <Text style={[styles.successSub, { color: colors.textSecondary, marginBottom: 20 }]}>
          The 15-minute payment window has expired. Please initiate a new payment session.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
          onPress={initGateway}
        >
          <RefreshCw size={16} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Start New Session</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── LOADING VIEW ──────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', minHeight: 260 }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 12 }]}>
          Setting up secure In-House UPI Gateway…
        </Text>
      </View>
    );
  }

  // ── ERROR VIEW ────────────────────────────────────────────────────
  if (sessionError) {
    return (
      <View style={[styles.container, { padding: 20, alignItems: 'center' }]}>
        <AlertCircle size={42} color="#ef4444" style={{ marginBottom: 12 }} />
        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Gateway Setup Error</Text>
        <Text style={[styles.successSub, { color: colors.textSecondary, marginBottom: 20, textAlign: 'center' }]}>
          {sessionError}
        </Text>
        <TouchableOpacity activeOpacity={0.8} style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Choose Another Method</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* ── 1. Gateway Security Header ── */}
      <View style={[styles.gatewayHeader, { backgroundColor: isDark ? '#111827' : '#F8FAFC', borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={18} color="#10b981" />
          <Text style={[styles.gatewayHeaderText, { color: colors.textPrimary }]}>
            PANTRO PAY • IN-HOUSE UPI GATEWAY
          </Text>
        </View>
        <View style={styles.zeroFeePill}>
          <Text style={styles.zeroFeeText}>0% Platform Fee</Text>
        </View>
      </View>

      {/* ── 2. Order Amount & Countdown Bar ── */}
      <View style={[styles.amountCard, { backgroundColor: isDark ? '#1e293b' : '#EFF6FF', borderColor: isDark ? '#3b82f6' : '#bfdbfe' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>TOTAL PAYABLE</Text>
            <Text style={[styles.amountValue, { color: colors.textPrimary }]}>
              {formatCurrency(amount)}
            </Text>
            <Text style={[styles.merchantName, { color: colors.textSecondary }]}>
              Pay to: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{session?.upiName}</Text>
            </Text>
          </View>

          <View style={[styles.timerBadge, { backgroundColor: timeLeft < 120 ? '#fee2e2' : isDark ? '#0f172a' : '#dbeafe' }]}>
            <Clock size={13} color={timeLeft < 120 ? '#dc2626' : '#2563eb'} />
            <Text style={[styles.timerText, { color: timeLeft < 120 ? '#dc2626' : '#2563eb' }]}>
              {formatTimer(timeLeft)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 3. 1-Tap Direct UPI Apps Grid ── */}
      <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
        PAY DIRECTLY VIA YOUR UPI APP
      </Text>

      <View style={styles.upiGrid}>
        {/* PhonePe */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOpenUpiApp('phonepe')}
          style={[styles.appCard, { backgroundColor: '#5f259f' }]}
        >
          <View style={styles.appCardContent}>
            <View style={styles.appIconCircle}>
              <Smartphone size={18} color="#5f259f" />
            </View>
            <View>
              <Text style={styles.appName}>PhonePe</Text>
              <Text style={styles.appSub}>1-Tap Pay</Text>
            </View>
          </View>
          <ArrowRight size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Google Pay */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOpenUpiApp('gpay')}
          style={[styles.appCard, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: '#4285F4', borderWidth: 1.5 }]}
        >
          <View style={styles.appCardContent}>
            <View style={[styles.appIconCircle, { backgroundColor: '#4285F4' }]}>
              <Smartphone size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={[styles.appName, { color: isDark ? '#FFFFFF' : '#1f2937' }]}>Google Pay</Text>
              <Text style={[styles.appSub, { color: '#4285F4' }]}>1-Tap Pay</Text>
            </View>
          </View>
          <ArrowRight size={16} color={isDark ? '#FFFFFF' : '#1f2937'} />
        </TouchableOpacity>

        {/* Paytm */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOpenUpiApp('paytm')}
          style={[styles.appCard, { backgroundColor: '#002e6e' }]}
        >
          <View style={styles.appCardContent}>
            <View style={styles.appIconCircle}>
              <Smartphone size={18} color="#002e6e" />
            </View>
            <View>
              <Text style={styles.appName}>Paytm UPI</Text>
              <Text style={styles.appSub}>1-Tap Pay</Text>
            </View>
          </View>
          <ArrowRight size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Other UPI / BHIM */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOpenUpiApp('universal')}
          style={[styles.appCard, { backgroundColor: isDark ? '#334155' : '#047857' }]}
        >
          <View style={styles.appCardContent}>
            <View style={styles.appIconCircle}>
              <Zap size={18} color="#047857" />
            </View>
            <View>
              <Text style={styles.appName}>BHIM / Any App</Text>
              <Text style={styles.appSub}>App Picker</Text>
            </View>
          </View>
          <ArrowRight size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── 4. Live Payment Detector Status Radar ── */}
      <View style={[styles.radarCard, { backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : '#F0F9FF', borderColor: '#38bdf8' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Animated.View
            style={[
              styles.radarDot,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.radarTitle, { color: colors.textPrimary }]}>
              Listening for UPI Payment…
            </Text>
            <Text style={[styles.radarSub, { color: colors.textSecondary }]}>
              Pay from any app. Once received on owner&apos;s phone, verification confirms here in 1 second!
            </Text>
          </View>
        </View>
      </View>

      {/* ── 5. Dynamic QR Code Dropdown ── */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setShowQr(!showQr)}
        style={[styles.qrToggleRow, { borderColor: colors.border }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <QrCode size={18} color={COLORS.primary} />
          <Text style={[styles.qrToggleText, { color: colors.textPrimary }]}>
            {showQr ? 'Hide QR Code' : 'Scan Dynamic QR Code'}
          </Text>
        </View>
        {showQr ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
      </TouchableOpacity>

      {showQr && qrImageUrl ? (
        <View style={[styles.qrContainer, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: colors.border }]}>
          <Image
            source={{ uri: qrImageUrl }}
            style={styles.qrImage}
            resizeMode="contain"
          />
          <Text style={[styles.qrCaption, { color: colors.textSecondary }]}>
            Scan with Google Pay, PhonePe, Paytm or any banking app
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={copyUpiId}
            style={[styles.upiCopyBadge, { borderColor: colors.border }]}
          >
            <Text style={[styles.upiCopyText, { color: colors.textPrimary }]} numberOfLines={1}>
              UPI ID: {session?.upiId}
            </Text>
            <Copy size={13} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── 6. Fallback: Manual 12-Digit UTR Entry ── */}
      <View style={{ marginTop: SPACING.md }}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setShowUtrBox(!showUtrBox)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
        >
          <Text style={[styles.utrToggleText, { color: colors.textSecondary }]}>
            {showUtrBox ? '▲ Hide UTR Input' : '▼ Didn\'t auto-detect? Enter 12-digit UTR manually'}
          </Text>
        </TouchableOpacity>

        {showUtrBox ? (
          <View style={[styles.utrBox, { backgroundColor: isDark ? '#1e293b' : '#F8FAFC', borderColor: colors.border }]}>
            <Text style={[styles.utrLabel, { color: colors.textSecondary }]}>
              12-DIGIT UPI REFERENCE / UTR NUMBER
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TextInput
                style={[
                  styles.utrInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    backgroundColor: isDark ? '#0f172a' : '#FFFFFF',
                  },
                ]}
                placeholder="e.g. 429812345678"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                maxLength={12}
                value={utrInput}
                onChangeText={(t) => setUtrInput(t.replace(/\D/g, ''))}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePasteClipboard}
                style={[styles.pasteBtn, { borderColor: colors.border }]}
              >
                <Copy size={14} color={COLORS.primary} />
                <Text style={[styles.pasteBtnText, { color: COLORS.primary }]}>Paste</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleUtrSubmit}
              disabled={submittingUtr || utrInput.length !== 12}
              style={[
                styles.submitUtrBtn,
                {
                  backgroundColor: utrInput.length === 12 ? COLORS.primary : '#94a3b8',
                },
              ]}
            >
              {submittingUtr ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitUtrBtnText}>Verify & Confirm Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* ── 7. Developer / Test Simulation Fast-Forward ── */}
      <View style={[styles.testBox, { borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="#f59e0b" />
            <Text style={styles.testLabel}>TEST / DEMO SIMULATION</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSimulatePayment}
            disabled={simulating}
            style={styles.simBtn}
          >
            {simulating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.simBtnText}>⚡ Simulate Owner Notification</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.sm,
  },
  gatewayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  gatewayHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  zeroFeePill: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  zeroFeeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  amountCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: SPACING.md,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 4,
  },
  merchantName: {
    fontSize: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6,
  },
  upiGrid: {
    gap: 10,
    marginBottom: SPACING.md,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
  },
  appCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  appSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginTop: 1,
  },
  radarCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  radarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0284c7',
  },
  radarTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  radarSub: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  qrToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  qrToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  qrContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  qrCaption: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  upiCopyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  upiCopyText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  utrToggleText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  utrBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  utrLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  utrInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitUtrBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitUtrBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  testBox: {
    marginTop: SPACING.md,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  testLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d97706',
  },
  simBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  simBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
  successAmountBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    width: '100%',
  },
  successAmountLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#059669',
  },
  successAmountValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#059669',
    marginVertical: 4,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  autoBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  metaKey: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#94a3b8',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  muted: {
    fontSize: 13,
  },
});
