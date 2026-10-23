import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

export interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'highlight';
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, variant = 'default', onPress, accessibilityLabel, accessibilityHint, style, padded = true }: CardProps) {
  const cardStyle = [styles.base, variantStyle[variant], padded && styles.padded, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

const variantStyle = StyleSheet.create({
  default: { backgroundColor: colors.card, borderColor: colors.border },
  secondary: { backgroundColor: colors.cardSecondary, borderColor: colors.border },
  highlight: { backgroundColor: colors.card, borderColor: colors.accentBorder },
});

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, borderWidth: 1 },
  padded: { padding: spacing.lg },
  pressed: { opacity: 0.9 },
});
