import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { AppText } from './AppText';

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <AppText variant="heading" accessibilityRole="header">{title}</AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={12} style={styles.action}>
          <AppText variant="small" tone="accent" style={styles.actionText}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -spacing.xs },
  action: { minHeight: 32, justifyContent: 'center' },
  actionText: { fontWeight: '600' },
});
