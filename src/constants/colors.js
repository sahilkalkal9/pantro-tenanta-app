export const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryDark: '#1d4ed8',
  secondary: '#059669',
  secondaryLight: '#10b981',
  secondaryDark: '#047857',
  accent: '#f59e0b',
  accentLight: '#fbbf24',
  accentDark: '#d97706',
  danger: '#e11d48',
  dangerLight: '#f43f5e',
  dangerDark: '#be123c',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  success: '#059669',
  successLight: '#10b981',
  info: '#2563eb',
  infoLight: '#3b82f6',
  
  // Neutral
  white: '#ffffff',
  black: '#000000',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
  
  // Backgrounds
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  cardBackground: '#ffffff',
  
  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  borderFocus: '#2563eb',
  
  // Text
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  textInverse: '#ffffff',
  textLink: '#2563eb',
  
  // Status
  online: '#059669',
  offline: '#94a3b8',
  pending: '#f59e0b',
  approved: '#059669',
  rejected: '#e11d48',
  unpaid: '#e11d48',
  paid: '#059669',
  partial: '#f59e0b',
  overdue: '#e11d48',
};

export const THEME_PALETTES = {
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    card: '#ffffff',
    cardSecondary: '#f1f5f9',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    borderStrong: '#cbd5e1',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#64748b',
    textFaint: '#94a3b8',
    iconDefault: '#475569',
    inputBg: '#ffffff',
    surfaceHover: '#f8fafc',
    divider: '#f1f5f9',
    heroSplitBg: '#ffffff',
  },
  dark: {
    background: '#070b14',
    surface: '#0e1526',
    card: '#0e1526',
    cardSecondary: '#121b30',
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.04)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textTertiary: '#94a3b8',
    textFaint: '#64748b',
    iconDefault: '#cbd5e1',
    inputBg: '#141e35',
    surfaceHover: '#16223d',
    divider: 'rgba(255, 255, 255, 0.08)',
    heroSplitBg: '#0e1526',
  },
};

export const getThemeColors = (isDark) =>
  isDark ? THEME_PALETTES.dark : THEME_PALETTES.light;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  display: 32,
};

export const FONT_WEIGHTS = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
};