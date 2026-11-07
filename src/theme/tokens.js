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

// Reference width = 350px phone. Tablets stay clamped so text never explodes.
const REF_WIDTH = 350;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.25;

let _fontScale = 1;
let _screenScale = 1;

export function setFontMetrics({ fontScale, screenWidth }) {
  _fontScale = fontScale || 1;
  _screenScale = Math.min(Math.max(screenWidth / REF_WIDTH, MIN_SCALE), MAX_SCALE);
}

export function responsiveFontSize(baseSize) {
  return Number(baseSize) * _screenScale * _fontScale;
}

export function useResponsiveFont() {
  return { responsiveFontSize, fonts, typo };
}
