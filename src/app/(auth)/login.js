import React, { useState, useEffect } from 'react';
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
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, Check, RotateCcw, AlertTriangle } from 'lucide-react-native';
import { requestOtp, clearError } from '../../slices/authSlice';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, SHADOWS } from '../../constants/colors';

const LOGO_URI = 'https://ik.imagekit.io/fkhvlkpi1/FULL%20LOGO%20P.png';
const LOCAL_ICON = require('../../../assets/icon.png');

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);

  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const cleanedPhone = phone.replace(/\D/g, '').slice(0, 10);
  const isValid = /^[6-9]\d{9}$/.test(cleanedPhone);

  const handlePhoneChange = (text) => {
    setLocalError('');
    const raw = text.replace(/\D/g, '').slice(0, 10);
    setPhone(raw);
  };

  const handleSendOtp = async () => {
    setLocalError('');
    if (!isValid) {
      setLocalError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    try {
      const res = await dispatch(requestOtp(cleanedPhone)).unwrap();

      // If server returned token directly (dev bypass)
      if (res?.token) {
        router.replace('/(app)/dashboard');
        return;
      }

      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: res?.phone || cleanedPhone,
          devOtp: res?.devOtp ? String(res.devOtp) : '',
        },
      });
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : err?.message || 'Failed to send OTP');
    }
  };

  const formatDisplayPhone = (digits) => {
    if (!digits) return '';
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" backgroundColor="#06090e" translucent={false} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Minimal Ambient Backdrop Glow ──────────────────── */}
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

            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Enter your mobile number to manage your stay &amp; rent
            </Text>
          </View>

          {/* ── Main Glassmorphic Card ──────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardTopHighlight} />

            <Text style={styles.inputLabel}>MOBILE NUMBER</Text>

            <View
              style={[
                styles.inputWrapper,
                isFocused && styles.inputWrapperFocused,
                isValid && styles.inputWrapperValid,
              ]}
            >
              {/* Flag + Country Code Pill */}
              <View style={styles.countryCodePill}>
                <Text style={styles.flagEmoji}>🇮🇳</Text>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>

              <TextInput
                style={styles.phoneInput}
                value={formatDisplayPhone(phone)}
                onChangeText={handlePhoneChange}
                placeholder="98765 43210"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
                maxLength={11} // 10 digits + 1 space
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus
              />

              {/* Status Indicator inside input */}
              <View style={styles.inputAction}>
                {isValid ? (
                  <View style={styles.validCheck}>
                    <Check size={13} color="#2dd4bf" strokeWidth={3} />
                  </View>
                ) : phone ? (
                  <TouchableOpacity
                    onPress={() => setPhone('')}
                    hitSlop={8}
                    style={styles.clearBtn}
                  >
                    <RotateCcw size={12} color="#64748b" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Error Message */}
            {(localError || error) ? (
              <View style={styles.errorBox}>
                <AlertTriangle size={14} color="#f43f5e" style={{ marginTop: 1 }} />
                <Text style={styles.errorText}>{localError || error}</Text>
              </View>
            ) : null}

            {/* Submit CTA */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isValid || isLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSendOtp}
              disabled={!isValid || isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.buttonInner}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.buttonText}>Sending OTP...</Text>
                </View>
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>Continue</Text>
                  <ArrowRight size={16} color="#ffffff" strokeWidth={2.4} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.helperText}>
              Passwordless login via SMS code · Safe &amp; encrypted
            </Text>
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
    top: '25%',
    left: '10%',
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
    fontSize: 24,
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
    maxWidth: 290,
    lineHeight: 18,
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
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    minHeight: 52,
    paddingHorizontal: 4,
    marginBottom: SPACING.md,
  },
  inputWrapperFocused: {
    borderColor: '#0d9488',
    backgroundColor: 'rgba(2, 6, 23, 0.9)',
  },
  inputWrapperValid: {
    borderColor: '#14b8a6',
  },
  countryCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
  },
  flagEmoji: {
    fontSize: 15,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#ffffff',
  },
  inputAction: {
    paddingRight: 12,
  },
  validCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    padding: 6,
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
  helperText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 12,
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