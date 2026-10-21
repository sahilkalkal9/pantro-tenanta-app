import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, ArrowLeft, Clock, Zap, AlertTriangle } from 'lucide-react-native';
import { verifyOtp, requestOtp } from '../../slices/authSlice';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, SHADOWS } from '../../constants/colors';

const LOGO_URI = 'https://ik.imagekit.io/fkhvlkpi1/FULL%20LOGO%20P.png';
const LOCAL_ICON = require('../../../assets/icon.png');

export default function VerifyOtpScreen() {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  const params = useLocalSearchParams();

  const phone = params.phone || '';
  const initialDevOtp = params.devOtp || '';

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState(initialDevOtp);
  const [cooldown, setCooldown] = useState(30);
  const [localError, setLocalError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleOtpChange = (index, value) => {
    setLocalError('');
    const cleaned = value.replace(/\D/g, '');

    if (!cleaned) {
      const copy = [...otpDigits];
      copy[index] = '';
      setOtpDigits(copy);
      return;
    }

    // Handles multi-digit paste or SMS autofill
    if (cleaned.length > 1) {
      const digits = cleaned.slice(0, 6).split('');
      const copy = [...otpDigits];
      digits.forEach((d, i) => {
        if (i < 6) copy[i] = d;
      });
      setOtpDigits(copy);
      const nextIdx = Math.min(digits.length - 1, 5);
      inputRefs.current[nextIdx]?.focus();

      if (digits.length === 6) {
        submitCode(digits.join(''));
      }
      return;
    }

    const copy = [...otpDigits];
    copy[index] = cleaned[cleaned.length - 1];
    setOtpDigits(copy);

    if (index < 5 && cleaned) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit if all 6 digits entered
    if (index === 5 && cleaned) {
      const completeCode = [...copy.slice(0, 5), cleaned[cleaned.length - 1]].join('');
      if (completeCode.length === 6) {
        submitCode(completeCode);
      }
    }
  };

  const handleKeyPress = (index, e) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFillDevOtp = () => {
    if (!devOtp) return;
    const digits = devOtp.slice(0, 6).split('');
    const copy = [...otpDigits];
    digits.forEach((d, i) => {
      if (i < 6) copy[i] = d;
    });
    setOtpDigits(copy);
    submitCode(digits.join(''));
  };

  const submitCode = async (code) => {
    setLocalError('');
    if (code.length !== 6) {
      setLocalError('Please enter the complete 6-digit OTP code.');
      return;
    }

    try {
      await dispatch(verifyOtp({ phone, otp: code })).unwrap();
      router.replace('/(app)/dashboard');
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : err?.message || 'Invalid OTP code');
    }
  };

  const handleVerify = () => {
    submitCode(otpDigits.join(''));
  };

  const handleResend = async () => {
    if (cooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setLocalError('');

    try {
      const res = await dispatch(requestOtp(phone)).unwrap();
      setCooldown(30);
      if (res?.devOtp) {
        setDevOtp(String(res.devOtp));
      }
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  const isComplete = otpDigits.every((d) => d !== '');

  const formatDisplayPhone = (p) => {
    if (!p) return '';
    const digits = p.replace(/\D/g, '').slice(-10);
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" backgroundColor="#06090e" translucent={false} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.ambientGlow} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centeredWrap}>
          {/* ── Brand Emblem & Header ────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.logoTile}>
              <Image
                source={{ uri: LOGO_URI }}
                defaultSource={LOCAL_ICON}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.portalBadge}>
              <View style={styles.portalBadgeDot} />
              <Text style={styles.portalBadgeText}>TENANT PORTAL</Text>
            </View>

            <Text style={styles.title}>Enter Verification Code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{' '}
              <Text style={styles.phoneHighlight}>{formatDisplayPhone(phone)}</Text>
            </Text>
          </View>

          {/* ── Glassmorphic Container ───────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardTopHighlight} />

            {/* Back link */}
            <View style={styles.cardSubheader}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.changeNumberBtn}
                hitSlop={8}
              >
                <ArrowLeft size={13} color="#2dd4bf" />
                <Text style={styles.changeNumberText}>Change number</Text>
              </TouchableOpacity>
              <Text style={styles.phonePill}>{phone ? `+91 ${phone}` : ''}</Text>
            </View>

            {/* 6 OTP Input Boxes */}
            <View style={styles.otpGrid}>
              {otpDigits.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  style={[
                    styles.otpBox,
                    digit && styles.otpBoxFilled,
                  ]}
                  value={digit}
                  onChangeText={(val) => handleOtpChange(idx, val)}
                  onKeyPress={(e) => handleKeyPress(idx, e)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={idx === 0}
                  selectionColor="#2dd4bf"
                />
              ))}
            </View>

            {/* Dev OTP Quick Chip */}
            {devOtp ? (
              <TouchableOpacity
                style={styles.devChip}
                onPress={handleAutoFillDevOtp}
                activeOpacity={0.8}
              >
                <View style={styles.devChipLeft}>
                  <Zap size={13} color="#fbbf24" />
                  <Text style={styles.devChipText}>Dev code: {devOtp}</Text>
                </View>
                <Text style={styles.devChipAction}>Auto-fill</Text>
              </TouchableOpacity>
            ) : null}

            {/* Error Banner */}
            {(localError || error) ? (
              <View style={styles.errorBox}>
                <AlertTriangle size={14} color="#f43f5e" style={{ marginTop: 1 }} />
                <Text style={styles.errorText}>{localError || error}</Text>
              </View>
            ) : null}

            {/* Verify CTA */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isComplete || isLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleVerify}
              disabled={!isComplete || isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.buttonInner}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.buttonText}>Verifying...</Text>
                </View>
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>Sign In</Text>
                  <ArrowRight size={16} color="#ffffff" strokeWidth={2.4} />
                </View>
              )}
            </TouchableOpacity>

            {/* Resend Cooldown */}
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={handleResend}
              disabled={cooldown > 0 || resendLoading}
              activeOpacity={0.7}
            >
              {resendLoading ? (
                <ActivityIndicator size="small" color="#2dd4bf" />
              ) : cooldown > 0 ? (
                <View style={styles.resendInner}>
                  <Clock size={13} color="#94a3b8" />
                  <Text style={styles.resendTextCooldown}>Resend OTP in {cooldown}s</Text>
                </View>
              ) : (
                <Text style={styles.resendTextActive}>Resend OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Corporate Identity Footer ──────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerCopy}>
            © {new Date().getFullYear()} Pantro. All rights reserved.
          </Text>
          <Text style={styles.footerBrand}>
            A Product of <Text style={styles.footerBrandBold}>Wabsyte Studio OPC Private Limited</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#06090e',
  },
  screen: {
    flex: 1,
    backgroundColor: '#06090e',
  },
  ambientGlow: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: SPACING.lg,
  },
  centeredWrap: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoTile: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...SHADOWS.large,
    shadowColor: 'rgba(20, 184, 166, 0.45)',
    elevation: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.25)',
    marginBottom: 10,
  },
  portalBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2dd4bf',
  },
  portalBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#2dd4bf',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.4,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 18,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: '#cbd5e1',
  },
  card: {
    position: 'relative',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: SPACING.xl,
    ...SHADOWS.large,
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 40,
    right: 40,
    height: 1,
    backgroundColor: 'rgba(20, 184, 166, 0.4)',
  },
  cardSubheader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  changeNumberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  changeNumberText: {
    fontSize: 12,
    color: '#2dd4bf',
    fontWeight: '600',
  },
  phonePill: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    letterSpacing: 0.5,
  },
  otpGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: SPACING.md,
  },
  otpBox: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  otpBoxFilled: {
    borderColor: '#14b8a6',
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
  },
  devChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: SPACING.md,
  },
  devChipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  devChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fde68a',
  },
  devChipAction: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#fbbf24',
    textDecorationLine: 'underline',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 12,
    padding: 10,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: '#0d9488',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
    shadowColor: 'rgba(20, 184, 166, 0.5)',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  resendBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  resendInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendTextCooldown: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  resendTextActive: {
    fontSize: 12.5,
    color: '#2dd4bf',
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    gap: 2,
  },
  footerCopy: {
    fontSize: 11,
    color: '#64748b',
  },
  footerBrand: {
    fontSize: 11,
    color: '#64748b',
  },
  footerBrandBold: {
    fontWeight: '600',
    color: '#94a3b8',
  },
});