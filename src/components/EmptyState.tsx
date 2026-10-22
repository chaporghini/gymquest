import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
}

export function EmptyState({ icon: Icon, title, message, actionLabel, onAction, tone = 'neutral' }: EmptyStateProps) {
  const color = tone === 'error' ? colors.error : colors.accent;
  return (
    <View style={styles.wrap} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <View style={[styles.icon, { backgroundColor: tone === 'error' ? colors.errorMuted : colors.accentMuted }]}>
        <Icon size={28} color={color} />
      </View>
      <AppText variant="heading" align="center">{title}</AppText>
      <AppText variant="body" tone="secondary" align="center">{message}</AppText>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant={tone === 'error' ? 'secondary' : 'primary'} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  icon: { width: 64, height: 64, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
});
