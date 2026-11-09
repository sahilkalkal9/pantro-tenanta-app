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

// Baseline width = 375px (modern phone standard). Tablets clamped to avoid oversized text.
const REF_WIDTH = 375;
const MIN_SCALE = 1.0;
const MAX_SCALE = 1.28;

const _initWidth = typeof Dimensions !== 'undefined' ? Dimensions.get('window')?.width : 390;
let _fontScale = 1;
let _screenScale = Math.min(Math.max((_initWidth || 390) / REF_WIDTH, MIN_SCALE), MAX_SCALE) * 1.06;

export function setFontMetrics({ fontScale, screenWidth }) {
  _fontScale = fontScale || 1;
  _screenScale = Math.min(Math.max((screenWidth || _initWidth || 390) / REF_WIDTH, MIN_SCALE), MAX_SCALE) * 1.06;
}

export function responsiveFontSize(baseSize) {
  const n = Number(baseSize) || 14;
  let adjusted = n;
  if (n <= 10) adjusted = n * 1.25;
  else if (n <= 12) adjusted = n * 1.16;
  else if (n <= 15) adjusted = n * 1.10;
  else if (n <= 20) adjusted = n * 1.06;
  else adjusted = n * 1.04;

  return Math.round(adjusted * _screenScale * _fontScale * 10) / 10;
}

export function useResponsiveFont() {
  return { responsiveFontSize, fonts, typo };
}
