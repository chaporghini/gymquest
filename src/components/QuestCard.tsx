import { CircleCheck, Target } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { QuestStatus } from '@/domain/progression';
import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';

export function QuestCard({ quest, compact, onPress }: { quest: QuestStatus; compact?: boolean; onPress?: () => void }) {
  const Icon = quest.completed ? CircleCheck : Target;
  return (
    <Card
      variant={quest.completed ? 'highlight' : 'default'}
      onPress={onPress}
      accessibilityHint={onPress ? 'Öffnet die Quest-Details' : undefined}
      accessibilityLabel={`Quest ${quest.title}: ${quest.progress} von ${quest.target}. Belohnung ${quest.rewardXp} XP.${quest.completed ? ' Abgeschlossen.' : ''}`}
      style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, quest.completed && styles.iconDone]}>
          <Icon size={18} color={quest.completed ? colors.onAccent : colors.accent} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{quest.title}</AppText>
          {!compact ? <AppText variant="small" tone="secondary">{quest.description}</AppText> : null}
        </View>
        <AppText variant="small" tone="accent" style={styles.reward}>+{quest.rewardXp} XP</AppText>
      </View>
      <View style={styles.progressRow}>
        <ProgressBar value={quest.progress / quest.target} height={6} style={styles.flex} />
        <AppText variant="small" tone="secondary">{quest.progress}/{quest.target}</AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: colors.accent },
  flex: { flex: 1 },
  reward: { fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
