import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { colors, typography } from '@/theme/tokens';

type Variant = keyof typeof typography;
type Tone = 'primary' | 'secondary' | 'accent' | 'warning' | 'error' | 'onAccent';

const toneColor: Record<Tone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  accent: colors.accent,
  warning: colors.warning,
  error: colors.error,
  onAccent: colors.onAccent,
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
}

// Nativ hat jede Inter-Stärke eine eigene Schriftdatei; im Web reicht fontWeight.
const NATIVE_FAMILY: Record<string, string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  bold: 'Inter_700Bold',
  normal: 'Inter_400Regular',
};

export function AppText({ variant = 'body', tone = 'primary', align, style, ...rest }: AppTextProps) {
  const base = [typography[variant], { color: toneColor[tone], textAlign: align }, style];
  if (Platform.OS === 'web') return <Text {...rest} style={base} />;
  const weight = String(StyleSheet.flatten(base)?.fontWeight ?? '400');
  return <Text {...rest} style={[...base, { fontFamily: NATIVE_FAMILY[weight] ?? 'Inter_400Regular', fontWeight: 'normal' }]} />;
}
