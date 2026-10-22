import { StyleSheet, View } from 'react-native';

import type { LevelProgress } from '@/domain/xp';
import { spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { ProgressBar } from './ProgressBar';

export function XPBar({ progress, compact }: { progress: LevelProgress; compact?: boolean }) {
  const label = progress.isMaxLevel
    ? 'Maximales Level erreicht'
    : `${progress.xpIntoLevel} / ${progress.xpForLevel} XP`;
  return (
    <View style={styles.wrap}>
      <ProgressBar
        value={progress.progress}
        height={compact ? 6 : 10}
        accessibilityLabel={`Erfahrung: ${label}. Noch ${progress.xpRemaining} XP bis Level ${progress.level + 1}.`}
      />
      {!compact && (
        <View style={styles.row}>
          <AppText variant="small" tone="secondary">{label}</AppText>
          {!progress.isMaxLevel && (
            <AppText variant="small" tone="accent">
              noch {progress.xpRemaining} XP bis Level {progress.level + 1}
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
});
