import { Platform } from 'react-native';

/** Wählbare Akzentfarben. Die Wahl gilt pro Gerät und wird beim Start gelesen. */
export const ACCENTS = {
  lime: { label: 'Lime', hex: '#C6FF3D' },
  blue: { label: 'Blau', hex: '#5AC8FF' },
  violet: { label: 'Violett', hex: '#B79CFF' },
  pink: { label: 'Pink', hex: '#FF7AC6' },
} as const;
export type AccentId = keyof typeof ACCENTS;
export const ACCENT_STORAGE_KEY = 'gymquest:accent';

function storedAccent(): AccentId {
  try {
    const v = Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage.getItem(ACCENT_STORAGE_KEY) : null;
    return v && v in ACCENTS ? (v as AccentId) : 'lime';
  } catch {
    return 'lime';
  }
}

export const currentAccent: AccentId = storedAccent();
const accentHex = ACCENTS[currentAccent].hex;
const muted = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;

export const colors = {
  background: '#090B0A',
  card: '#141814',
  cardSecondary: '#1A201B',
  accent: accentHex,
  accentMuted: muted(accentHex, 0.14),
  accentFaint: muted(accentHex, 0.06),
  accentBorder: muted(accentHex, 0.35),
  accentHalf: muted(accentHex, 0.45),
  onAccent: '#090B0A',
  text: '#F5F7F2',
  textSecondary: '#929A9D',
  warning: '#FFB547',
  warningMuted: 'rgba(255, 181, 71, 0.14)',
  error: '#FF6B6B',
  errorMuted: 'rgba(255, 107, 107, 0.14)',
  border: '#292F29',
  borderStrong: '#363E36',
  overlay: 'rgba(0, 0, 0, 0.7)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

// Inter (im Web über Google Fonts geladen), sonst Systemschrift.
const fontFamily = Platform.select({ ios: 'System', web: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', default: undefined });

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

/** Breite Seiten (Home) auf Laptop und PC. */
export const MAX_WIDE_WIDTH = 1120;

/** Ab dieser Fensterbreite: Seitenleiste statt Tab-Leiste, mehrspaltige Layouts. */
export const DESKTOP_BREAKPOINT = 900;

export const shadow = Platform.select({
  web: { boxShadow: '0 6px 20px rgba(0,0,0,0.35)' },
  default: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
});
