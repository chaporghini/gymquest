import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';
import { AppText } from './AppText';

export function LevelBadge({ level, size = 'md' }: { level: number; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 72 : size === 'sm' ? 36 : 52;
  return (
    <View
      accessibilityLabel={`Level ${level}`}
      style={[styles.badge, { width: dim, height: dim, borderRadius: size === 'lg' ? radius.xl : radius.md }]}>
      <AppText variant="caption" tone="onAccent" style={size === 'sm' ? styles.tinyLabel : styles.label}>
        LVL
      </AppText>
      <AppText variant={size === 'lg' ? 'title' : size === 'sm' ? 'bodyStrong' : 'heading'} tone="onAccent" style={styles.number}>
        {level}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, lineHeight: 12, opacity: 0.75 },
  tinyLabel: { fontSize: 8, lineHeight: 9, opacity: 0.75 },
  number: { fontWeight: '800', marginTop: -2 },
});
