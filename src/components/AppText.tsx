import { Text, type TextProps } from 'react-native';

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

export function AppText({ variant = 'body', tone = 'primary', align, style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography[variant], { color: toneColor[tone], textAlign: align }, style]} />;
}
