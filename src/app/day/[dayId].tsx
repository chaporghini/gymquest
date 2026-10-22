import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Clock, Dumbbell, Pencil, Play, SearchX, Target } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, ExerciseCard, Screen, SectionHeader } from '@/components';
import { getExercise } from '@/data/exercises';
import { formatDate, formatDuration, WEEKDAYS_LONG } from '@/domain/dates';
import { estimateDayMinutes } from '@/domain/planGenerator';
import { recommendationsForDay } from '@/domain/training';
import { RecommendationCard } from '@/features/RecommendationCard';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

/** Trainingsdetails einer geplanten Einheit (nur ansehen und starten; bearbeiten im Plan-Editor). */
export default function DayDetail() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const app = useApp();
  const { plan, sessions, activeWorkout, trainingData } = app;
  const [error, setError] = useState<string | null>(null);
  const day = plan?.days.find((d) => d.id === dayId);
  const recommendations = useMemo(() => recommendationsForDay(trainingData, dayId), [trainingData, dayId]);
  const history = useMemo(() => sessions.filter((s) => s.planDayId === dayId).slice(0, 3), [sessions, dayId]);

  if (!day) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} title="Einheit nicht gefunden" message="Diese Trainingseinheit gibt es im Plan nicht mehr." actionLabel="Zum Trainingsplan" onAction={() => router.replace('/training')} />
      </Screen>
    );
  }

  const totalSets = day.exercises.reduce((n, e) => n + e.sets, 0);
  const isActive = activeWorkout?.planDayId === day.id;

  const start = async () => {
    setError(null);
    try {
      if (!activeWorkout) await app.startWorkout(day.id);
      router.push('/workout/active');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Training konnte nicht gestartet werden.');
    }
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.footer}>
          {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}
          <Button
            label={isActive ? 'Training fortsetzen' : activeWorkout ? 'Laufendes Training öffnen' : 'Training starten'}
            icon={Play}
            size="lg"
            fullWidth
            onPress={start}
            disabled={day.exercises.length === 0}
          />
        </View>
      }>
      <Stack.Screen options={{ title: day.name }} />
      <View style={styles.header}>
        <AppText variant="caption" tone="accent">{WEEKDAYS_LONG[day.weekday].toUpperCase()}</AppText>
        <AppText variant="title" accessibilityRole="header">{day.name}</AppText>
      </View>
      <View style={styles.meta}>
        <Meta icon={Target} text={day.focus} />
        <Meta icon={Clock} text={`ca. ${estimateDayMinutes(day)} min`} />
        <Meta icon={Dumbbell} text={`${day.exercises.length} Übungen · ${totalSets} Sätze`} />
      </View>

      <SectionHeader title="Übungen" actionLabel="Bearbeiten" onAction={() => router.push({ pathname: '/plan/day/[dayId]', params: { dayId: day.id } })} />
      {day.exercises.length === 0 ? (
        <EmptyState icon={Pencil} title="Noch keine Übungen" message="Füge im Plan-Editor Übungen hinzu." actionLabel="Einheit bearbeiten" onAction={() => router.push({ pathname: '/plan/day/[dayId]', params: { dayId: day.id } })} />
      ) : (
        <View style={styles.list}>
          {day.exercises.map((pe, i) => {
            const ex = getExercise(pe.exerciseId);
            const rec = recommendations[pe.exerciseId];
            return ex ? (
              <View key={`${pe.exerciseId}-${i}`} style={styles.exercise}>
                <ExerciseCard exercise={ex} planned={pe} index={i} onPress={() => router.push({ pathname: '/library/[id]', params: { id: ex.id } })} />
                {rec ? <RecommendationCard recommendation={rec} compact /> : null}
              </View>
            ) : null;
          })}
        </View>
      )}

      <SectionHeader title="Zuletzt trainiert" />
      {history.length === 0 ? (
        <Card variant="secondary"><AppText tone="secondary">Diese Einheit hast du noch nicht absolviert.</AppText></Card>
      ) : (
        <Card padded={false}>
          {history.map((s, i) => (
            <Card
              key={s.id}
              padded={false}
              onPress={() => router.push({ pathname: '/history/[id]', params: { id: s.id } })}
              accessibilityLabel={`${formatDate(s.finishedAt)}, ${s.sets.length} Sätze, ${s.xpEarned} XP`}
              style={[styles.historyRow, i > 0 && styles.divider]}>
              <AppText style={styles.flex}>{formatDate(s.finishedAt)}</AppText>
              <AppText variant="small" tone="secondary">{formatDuration(s.durationSec)} · {s.sets.length} Sätze</AppText>
              <AppText variant="small" tone="accent" style={styles.bold}>+{s.xpEarned} XP</AppText>
            </Card>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function Meta({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Icon size={16} color={colors.textSecondary} />
      <AppText variant="small" tone="secondary">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  header: { gap: 2 },
  meta: { gap: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { gap: spacing.lg },
  exercise: { gap: spacing.xs },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
