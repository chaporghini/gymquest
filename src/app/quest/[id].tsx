import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CircleCheck, Play, SearchX, Target } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, ProgressBar, Screen } from '@/components';
import { addDays, formatDate, startOfWeek } from '@/domain/dates';
import { computeWeeklyQuests } from '@/domain/progression';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

const HOW_IT_COUNTS: Record<string, string> = {
  weekly_workouts: 'Jedes abgeschlossene Training in dieser Kalenderwoche zählt. Das Ziel entspricht der Anzahl der Einheiten in deinem Plan.',
  weekly_sets: 'Gezählt werden alle Sätze, die du im Trainingsmodus abgehakt hast.',
  weekly_full_workout: 'Schließe bei einer Einheit aus deinem Plan alle geplanten Sätze ab.',
  weekly_mobility: 'Gezählt werden abgehakte Sätze von Mobilitätsübungen, z. B. Katze-Kuh oder Hüftbeuger-Dehnung.',
};

export default function QuestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, xpEvents, plan, activeWorkout } = useApp();
  const quest = useMemo(() => computeWeeklyQuests({ sessions, xpEvents, plan, now: new Date() }).find((q) => q.id === id), [id, sessions, xpEvents, plan]);

  if (!quest) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} title="Quest nicht gefunden" message="Diese Quest gibt es in dieser Woche nicht." />
      </Screen>
    );
  }

  const ends = addDays(startOfWeek(new Date()), 6);
  const reward = xpEvents.find((e) => e.source === 'quest' && e.refId === quest.rewardRef);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Quest' }} />
      <View style={styles.header}>
        <View style={[styles.icon, quest.completed && styles.iconDone]}>
          {quest.completed ? <CircleCheck size={28} color={colors.onAccent} /> : <Target size={28} color={colors.accent} />}
        </View>
        <AppText variant="title" accessibilityRole="header">{quest.title}</AppText>
        <AppText tone="secondary">{quest.description}</AppText>
      </View>

      <Card style={styles.gap}>
        <View style={styles.row}>
          <AppText variant="number">{quest.progress}<AppText variant="heading" tone="secondary"> / {quest.target}</AppText></AppText>
          <AppText variant="bodyStrong" tone="accent">+{quest.rewardXp} XP</AppText>
        </View>
        <ProgressBar value={quest.progress / quest.target} accessibilityLabel={`Fortschritt ${quest.progress} von ${quest.target}`} />
        <AppText variant="small" tone={quest.completed ? 'accent' : 'secondary'}>
          {quest.completed
            ? reward
              ? `Abgeschlossen – ${reward.amount} XP am ${formatDate(reward.createdAt)} gutgeschrieben.`
              : 'Abgeschlossen – die XP werden mit deinem nächsten Training gutgeschrieben.'
            : `Läuft bis ${formatDate(ends.toISOString())}.`}
        </AppText>
      </Card>

      <Card variant="secondary" style={styles.gap}>
        <AppText variant="bodyStrong">So wird gezählt</AppText>
        <AppText tone="secondary">{HOW_IT_COUNTS[quest.id] ?? quest.description}</AppText>
        <AppText variant="small" tone="secondary">Der Fortschritt wird ausschließlich aus deinen gespeicherten Trainings berechnet.</AppText>
      </Card>

      {!quest.completed ? (
        <Button
          label={activeWorkout ? 'Training fortsetzen' : 'Zum Trainingsplan'}
          icon={Play}
          size="lg"
          onPress={() => router.push(activeWorkout ? '/workout/active' : '/training')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  icon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  iconDone: { backgroundColor: colors.accent },
  gap: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
