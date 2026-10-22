import { Platform } from 'react-native';

export const colors = {
  background: '#0B0D0E',
  card: '#15191B',
  cardSecondary: '#202528',
  accent: '#C7FF55',
  accentMuted: 'rgba(199, 255, 85, 0.14)',
  onAccent: '#0B0D0E',
  text: '#F5F7F2',
  textSecondary: '#929A9D',
  warning: '#FFB547',
  warningMuted: 'rgba(255, 181, 71, 0.14)',
  error: '#FF6B6B',
  errorMuted: 'rgba(255, 107, 107, 0.14)',
  border: 'rgba(245, 247, 242, 0.08)',
  borderStrong: 'rgba(245, 247, 242, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.7)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

const fontFamily = Platform.select({ ios: 'System', default: undefined });

export const typography = {
  display: { fontFamily, fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontFamily, fontSize: 24, lineHeight: 30, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  body: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  small: { fontFamily, fontSize: 14, lineHeight: 19, fontWeight: '400' as const },
  caption: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.4 },
  number: { fontFamily, fontSize: 28, lineHeight: 32, fontWeight: '800' as const, fontVariant: ['tabular-nums' as const] },
} as const;

/** Mindestgröße für Touch-Flächen (Apple HIG: 44 pt). */
export const MIN_TOUCH = 44;

/** Maximale Inhaltsbreite auf Tablets und im Browser. */
export const MAX_CONTENT_WIDTH = 640;

export const shadow = Platform.select({
  web: { boxShadow: '0 6px 20px rgba(0,0,0,0.35)' },
  default: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
});
