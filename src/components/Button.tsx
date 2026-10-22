import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const variantStyles: Record<Variant, { bg: string; fg: string; border: string; tone: 'onAccent' | 'primary' | 'error' | 'accent' }> = {
  primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent, tone: 'onAccent' },
  secondary: { bg: colors.cardSecondary, fg: colors.text, border: colors.borderStrong, tone: 'primary' },
  ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent', tone: 'accent' },
  danger: { bg: colors.errorMuted, fg: colors.error, border: 'rgba(255,107,107,0.3)', tone: 'error' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  disabled,
  fullWidth,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  const height = size === 'lg' ? 56 : size === 'sm' ? 40 : 48;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      hitSlop={size === 'sm' ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border, minHeight: Math.max(height, size === 'sm' ? 40 : MIN_TOUCH) },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={size === 'sm' ? 16 : 20} color={v.fg} strokeWidth={2.25} /> : null}
          <AppText variant={size === 'sm' ? 'small' : 'bodyStrong'} tone={v.tone} style={size === 'sm' ? styles.smallLabel : undefined}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  smallLabel: { fontWeight: '600' },
});
