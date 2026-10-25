import { CircleCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { QuestStatus } from '@/domain/progression';
import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';

export function QuestCard({ quest, compact, onPress }: { quest: QuestStatus; compact?: boolean; onPress?: () => void }) {
  const pill = quest.completed ? 'Erledigt' : quest.progress > 0 ? 'In Arbeit' : 'Offen';
  return (
    <Card
      variant={quest.completed ? 'highlight' : 'default'}
      onPress={onPress}
      accessibilityHint={onPress ? 'Öffnet die Quest-Details' : undefined}
      accessibilityLabel={`Quest ${quest.title}: ${quest.progress} von ${quest.target}. Belohnung ${quest.rewardXp} XP.${quest.completed ? ' Abgeschlossen.' : ''}`}
      style={[styles.card, quest.completed && styles.done]}>
      <View style={styles.row}>
        <View style={[styles.pill, quest.completed && styles.pillDone]}>
          <AppText variant="caption" tone={quest.completed ? 'onAccent' : 'accent'}>{pill.toUpperCase()}</AppText>
        </View>
        <View style={styles.flex} />
        <AppText variant="bodyStrong" tone="accent">+{quest.rewardXp} XP</AppText>
      </View>
      <View>
        <AppText variant="heading">{quest.title}</AppText>
        {!compact ? <AppText variant="small" tone="secondary">{quest.description}</AppText> : null}
      </View>
      <View style={styles.progressRow}>
        <ProgressBar value={quest.progress / quest.target} height={6} style={styles.flex} />
        {quest.completed ? <CircleCheck size={18} color={colors.accent} /> : <AppText variant="small" tone="secondary">{Math.min(quest.progress, quest.target)}/{quest.target}</AppText>}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  done: { backgroundColor: colors.accentFaint },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.accentMuted },
  pillDone: { backgroundColor: colors.accent },
  flex: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
