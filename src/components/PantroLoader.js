import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { responsiveFontSize } from "../theme";

const LOCAL_ICON = require('../../assets/icon.png');

/**
 * PantroLoader — Exact Mobile Replica of Tenant Web Panel PantroLoader.jsx:
 * - Glowing Pantro emblem with orbital conic & reverse halo rings
 * - Central squircle container with floating emblem and live satellite status bead
 * - Branded typography: "PANTRO • TENANT"
 * - Dynamic loading title
 * - Smooth indeterminate shimmering progress beam
 * - Official corporate footnote: "A Product of Wabsyte Studio (OPC) Private Limited"
 */
export default function PantroLoader({
  fullScreen = false,
  fullscreen,
  variant = 'fullscreen', // 'fullscreen' | 'card' | 'inline' | 'minimal'
  message = 'Loading Pantro Tenant Portal…',
  title,
  subtext = 'A Product of Wabsyte Studio (OPC) Private Limited',
  subtitle,
  size = 'md', // 'sm' | 'md' | 'lg'
  style,
}) {
  const isFullScreen = fullScreen || fullscreen || variant === 'fullscreen';
  const displayMessage = title || message;
  const displaySubtext = subtitle !== undefined ? subtitle : subtext;
  const { colors, isDark } = useTheme();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const reverseRotateAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pingAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Ambient Glow Pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Orbital Outer Ring
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // 3. Reverse Orbital Ring
    const reverseRotateLoop = Animated.loop(
      Animated.timing(reverseRotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // 4. Subtle Float
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // 5. Satellite Ping
    const pingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pingAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pingAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );

    // 6. Indeterminate Progress Shimmer Beam
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    rotateLoop.start();
    reverseRotateLoop.start();
    floatLoop.start();
    pingLoop.start();
    shimmerLoop.start();

    return () => {
      pulseLoop.stop();
      rotateLoop.stop();
      reverseRotateLoop.stop();
      floatLoop.stop();
      pingLoop.stop();
      shimmerLoop.stop();
    };
  }, [pulseAnim, rotateAnim, reverseRotateAnim, floatAnim, pingAnim, shimmerAnim]);

  // Interpolated transforms
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const reverseSpin = reverseRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const glowScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.15],
  });

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.55],
  });

  const pingScale = pingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });

  const pingOpacity = pingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 0],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 160],
  });

  // Minimal Variant
  if (variant === 'minimal') {
    return (
      <View style={[styles.minimalWrap, style]}>
        <View style={styles.minimalRingWrap}>
          <View style={[styles.minimalTrack, { borderColor: isDark ? 'rgba(40, 100, 178, 0.25)' : '#bfdbfe' }]} />
          <Animated.View style={[styles.minimalSpinner, { transform: [{ rotate: spin }] }]} />
        </View>
        {displayMessage ? (
          <Text style={[styles.minimalText, { color: colors.textSecondary }]}>{displayMessage}</Text>
        ) : null}
      </View>
    );
  }

  // Inline Variant
  if (variant === 'inline') {
    return (
      <View style={[styles.inlineWrap, style]}>
        <View style={[styles.inlineBox, { backgroundColor: isDark ? 'rgba(40, 100, 178, 0.15)' : '#eff6ff', borderColor: isDark ? 'rgba(40, 100, 178, 0.35)' : '#bfdbfe' }]}>
          <Image source={LOCAL_ICON} defaultSource={{ uri: REMOTE_ICON }} style={styles.inlineIcon} resizeMode="contain" />
          <Animated.View style={[styles.inlineOrbiter, { transform: [{ rotate: spin }] }]} />
        </View>
        <View style={styles.inlineTextWrap}>
          <Text style={[styles.inlineTitle, { color: colors.textPrimary }]}>{displayMessage}</Text>
          {displaySubtext ? <Text style={[styles.inlineSubtext, { color: colors.textSecondary }]}>{displaySubtext}</Text> : null}
        </View>
      </View>
    );
  }

  const isLg = size === 'lg' || isFullScreen;
  const isSm = size === 'sm';
  const boxDim = isLg ? 88 : isSm ? 62 : 76;
  const iconDim = isLg ? 80 : isSm ? 56 : 68;

  const content = (
    <View style={[styles.contentWrap, variant === 'card' && styles.cardWrap, style]}>
      {/* ── Ambient Glow + Orbital Center ────────────────────── */}
      <View style={styles.centerContainer}>
        {/* Soft Radial Backlight Glow */}
        <Animated.View
          style={[
            styles.ambientGlow,
            {
              width: boxDim * 1.6,
              height: boxDim * 1.6,
              borderRadius: (boxDim * 1.6) / 2,
              transform: [{ scale: glowScale }],
              opacity: glowOpacity,
            },
          ]}
        />

        {/* Orbital Outer Dashed Blue Circle */}
        <Animated.View
          style={[
            styles.outerOrbitalRing,
            {
              width: boxDim + 24,
              height: boxDim + 24,
              borderRadius: (boxDim + 24) / 2,
              borderColor: isDark ? '#3b82f6' : '#2563eb',
              transform: [{ rotate: spin }],
            },
          ]}
        />

        {/* Central Logo Container — transparent, no white box, enlarged logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              width: boxDim,
              height: boxDim,
              transform: [{ translateY: floatY }],
            },
          ]}
        >
          <Image
            source={LOCAL_ICON}
            style={{ width: iconDim, height: iconDim }}
            resizeMode="contain"
          />

          {/* Micro Status Satellite Bead */}
          <View style={styles.satelliteWrap}>
            <Animated.View
              style={[
                styles.satellitePing,
                {
                  transform: [{ scale: pingScale }],
                  opacity: pingOpacity,
                },
              ]}
            />
            <View style={[styles.satelliteDot, { borderColor: isDark ? '#0e1628' : '#ffffff' }]} />
          </View>
        </Animated.View>
      </View>

      {/* ── Brand Lockup (PANTRO • TENANT) ───────────────────── */}
      <View style={styles.brandRow}>
        <Text style={[styles.brandText, { color: isDark ? '#397FC1' : '#2864B2' }]}>PANTRO</Text>
        <Text style={[styles.brandDot, { color: isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8' }]}>•</Text>
        <Text style={[styles.portalText, { color: colors.textSecondary }]}>TENANT</Text>
      </View>

      {/* ── Dynamic Loading Title ────────────────────────────── */}
      <Text style={[styles.messageText, { color: colors.textPrimary }]}>{displayMessage}</Text>

      {/* ── Indeterminate Shimmer Progress Bar ────────────────── */}
      <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0' }]}>
        <Animated.View
          style={[
            styles.progressBarBeam,
            {
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
        />
      </View>

      {/* ── Corporate Footnote ───────────────────────────────── */}
      {displaySubtext ? (
        <View style={styles.footnoteRow}>
          <View style={[styles.footnoteDot, { backgroundColor: isDark ? '#64748b' : '#cbd5e1' }]} />
          <Text style={[styles.footnoteText, { color: colors.textTertiary }]}>
            {typeof displaySubtext === 'string' && displaySubtext.includes('Wabsyte') ? (
              <>
                A Product of <Text style={[styles.footnoteBold, { color: colors.textSecondary }]}>Wabsyte Studio (OPC) Private Limited</Text>
              </>
            ) : (
              displaySubtext
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (isFullScreen) {
    return (
      <View
        style={[
          styles.fullScreenOverlay,
          { backgroundColor: isDark ? '#070b14' : '#f8fafc' },
        ]}
      >
        {content}
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'transparent',
  },
  cardWrap: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: SPACING.md,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  ambientGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(40, 100, 178, 0.28)',
  },
  outerOrbitalRing: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  innerOrbitalRing: {
    position: 'absolute',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    position: 'relative',
  },
  satelliteWrap: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satellitePing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#397FC1',
  },
  satelliteDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#2864B2',
    borderWidth: 1.5,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  brandText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  brandDot: {
    fontSize: responsiveFontSize(10),
  },
  portalText: {
    fontSize: responsiveFontSize(10.5),
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  messageText: {
    fontSize: responsiveFontSize(FONT_SIZES.md),
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  progressTrack: {
    width: 180,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  progressBarBeam: {
    width: 70,
    height: '100%',
    borderRadius: 2.5,
    backgroundColor: '#2864B2',
  },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  footnoteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  footnoteText: {
    fontSize: responsiveFontSize(10.5),
    fontWeight: '500',
  },
  footnoteBold: {
    fontWeight: '700',
  },
  minimalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  minimalRingWrap: {
    width: 20,
    height: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimalTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 2,
  },
  minimalSpinner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2864B2',
    borderTopColor: 'transparent',
  },
  minimalText: {
    fontSize: responsiveFontSize(FONT_SIZES.xs),
    fontWeight: FONT_WEIGHTS.semibold,
  },
  inlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: SPACING.sm,
  },
  inlineBox: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  inlineIcon: {
    width: 20,
    height: 20,
  },
  inlineOrbiter: {
    position: 'absolute',
    inset: -3,
    borderRadius: BORDER_RADIUS.md + 2,
    borderWidth: 1,
    borderColor: '#2864B2',
    borderTopColor: 'transparent',
  },
  inlineTextWrap: {
    flex: 1,
  },
  inlineTitle: {
    fontSize: responsiveFontSize(FONT_SIZES.xs),
    fontWeight: FONT_WEIGHTS.bold,
  },
  inlineSubtext: {
    fontSize: responsiveFontSize(10),
    marginTop: 1,
  },
});
