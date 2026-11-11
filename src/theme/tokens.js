import { Dimensions } from 'react-native';

/**
 * Design tokens — Pantro Tenant.
 * Mirrors the web panel's typography scale + responsive font engine.
 */

// Nunito font family names (loaded via @expo-google-fonts/nunito).
export const fonts = {
  300: 'Nunito_300Light',
  400: 'Nunito_400Regular',
  500: 'Nunito_500Medium',
  600: 'Nunito_600SemiBold',
  700: 'Nunito_700Bold',
  800: 'Nunito_800ExtraBold',
};

/** Helper: typography style with the right Nunito weight. */
export const typo = (weight = 400) => ({ fontFamily: fonts[weight] || fonts[400] });

// Baseline width = 375px standard phone width. Clamped so tablets never have oversized text.
const REF_WIDTH = 375;
const MIN_SCALE = 0.95;
const MAX_SCALE = 1.15;

const _initWidth = typeof Dimensions !== 'undefined' ? Dimensions.get('window')?.width : 375;
let _fontScale = 1;
// Mid-level balanced scale: natural reference to standard 375px phone
let _screenScale = Math.min(Math.max((_initWidth || 375) / REF_WIDTH, MIN_SCALE), MAX_SCALE);

export function setFontMetrics({ fontScale, screenWidth }) {
  _fontScale = fontScale || 1;
  _screenScale = Math.min(Math.max((screenWidth || _initWidth || 375) / REF_WIDTH, MIN_SCALE), MAX_SCALE);
}

export function responsiveFontSize(baseSize) {
  const n = Number(baseSize) || 14;
  // Mid-level balanced scaling: keeps small text readable while preserving balanced layout
  let adjusted = n;
  if (n <= 10) adjusted = n * 1.08;
  else if (n <= 12) adjusted = n * 1.04;
  else if (n <= 14) adjusted = n * 1.02;

  return Math.round(adjusted * _screenScale * _fontScale * 10) / 10;
}

export function useResponsiveFont() {
  return { responsiveFontSize, fonts, typo };
}
