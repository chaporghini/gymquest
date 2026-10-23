import { Circle, CircleCheck, Lock, Map } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, ProgressBar } from '@/components';
import { formatDate } from '@/domain/dates';
import type { ChapterStatus } from '@/domain/progression';
import { colors, radius, spacing } from '@/theme/tokens';

/** Quest-Kapitel mit seinen Schritten. Kompakt: nur Fortschritt und nächster offener Schritt. */
export function ChapterCard({ chapter, compact, onPress }: { chapter: ChapterStatus; compact?: boolean; onPress?: () => void }) {
  const done = chapter.steps.filter((s) => s.completed).length;
  const next = chapter.steps.find((s) => !s.completed);
  const locked = chapter.status === 'locked';
  const completed = chapter.status === 'completed';
  return (
    <Card
      variant={completed ? 'highlight' : 'default'}
      onPress={onPress}
      accessibilityLabel={`${chapter.title}: ${done} von ${chapter.steps.length} Schritten. Belohnung ${chapter.rewardXp} XP.${locked ? ' Gesperrt.' : completed ? ' Abgeschlossen.' : ''}`}
      style={[styles.card, locked && styles.locked]}>
      <View style={styles.row}>
        <View style={[styles.icon, completed && styles.iconDone]}>
          {locked ? <Lock size={18} color={colors.textSecondary} /> : completed ? <CircleCheck size={18} color={colors.onAccent} /> : <Map size={18} color={colors.accent} />}
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{chapter.title}</AppText>
          <AppText variant="small" tone="secondary">
            {locked ? 'Wird nach dem vorherigen Kapitel freigeschaltet.' : compact && next ? `Als Nächstes: ${next.title}` : chapter.description}
          </AppText>
        </View>
        <AppText variant="small" tone="accent">+{chapter.rewardXp} XP</AppText>
      </View>
      {!compact && !locked ? (
        <View style={styles.steps}>
          {chapter.steps.map((s) => (
            <View key={s.id} style={styles.step}>
              {s.completed ? <CircleCheck size={18} color={colors.accent} /> : <Circle size={18} color={colors.textSecondary} />}
              <AppText style={styles.flex} tone={s.completed ? 'secondary' : 'primary'}>{s.title}</AppText>
              {s.target > 1 ? <AppText variant="small" tone="secondary">{s.progress}/{s.target}</AppText> : null}
            </View>
          ))}
        </View>
      ) : null}
      {!locked ? (
        <View style={styles.progressRow}>
          <ProgressBar value={done / chapter.steps.length} height={6} style={styles.flex} />
          <AppText variant="small" tone="secondary">{done}/{chapter.steps.length}</AppText>
        </View>
      ) : null}
      {!compact && (chapter.startedAt || chapter.completedAt) ? (
        <AppText variant="caption" tone="secondary">
          {chapter.startedAt ? `Begonnen ${formatDate(chapter.startedAt)}` : ''}
          {chapter.completedAt ? ` · Abgeschlossen ${formatDate(chapter.completedAt)}` : ''}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  locked: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: colors.accent },
  flex: { flex: 1 },
  steps: { gap: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
