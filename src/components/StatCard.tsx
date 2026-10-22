import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon?: LucideIcon }) {
  return (
    <Card style={styles.card} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.header}>
        {Icon ? <Icon size={16} color={colors.textSecondary} /> : null}
        <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.label}>
          {label.toUpperCase()}
        </AppText>
      </View>
      <AppText variant="number" numberOfLines={1} adjustsFontSizeToFit>{value}</AppText>
      {hint ? <AppText variant="small" tone="secondary">{hint}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 140, gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { flexShrink: 1 },
});
