import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarClock, ChevronRight, Pencil, Play, Plus, SearchX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, EmptyState, prescriptionText, Screen, SectionHeader } from '@/components';
import { getExercise } from '@/data/exercises';
import { addDays, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekdayIndex } from '@/domain/dates';
import { dayMuscleLoad } from '@/domain/muscles';
import { estimateDayMinutes, prescribe } from '@/domain/planGenerator';
import { daysForWeek } from '@/domain/planMoves';
import { AddExerciseAssistant } from '@/features/AddExerciseAssistant';
import { BodyMap } from '@/features/BodyMap';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

/** Eine geplante Einheit: Muskelkarte, Übungen, Start. */
export default function DayDetail() {
  const { dayId, next } = useLocalSearchParams<{ dayId: string; next?: string }>();
  const app = useApp();
  const { plan, activeWorkout, profile } = app;
  const [error, setError] = useState<string | null>(null);
  const [assistant, setAssistant] = useState(false);
  const [moving, setMoving] = useState(false);
  const [now] = useState(() => new Date());
  const nextWeek = next === '1';
  const weekDate = nextWeek ? addDays(now, 7) : now;
  const day = plan?.days.find((d) => d.id === dayId);
  const weekDays = plan ? daysForWeek(plan, weekDate) : [];
  const weekday = weekDays.find((d) => d.id === dayId)?.weekday ?? day?.weekday ?? 0;
  const firstAllowed = nextWeek ? 0 : weekdayIndex(now);
  const load = useMemo(() => (day ? dayMuscleLoad(day) : null), [day]);

  if (!day || !load) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} title="Einheit nicht gefunden" message="Diese Trainingseinheit gibt es im Plan nicht mehr." actionLabel="Zum Training" onAction={() => router.replace('/training')} />
      </Screen>
    );
  }

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
          <Button label={isActive ? 'Training fortsetzen' : activeWorkout ? 'Laufendes Training öffnen' : 'Training starten'} icon={Play} size="lg" fullWidth onPress={start} disabled={day.exercises.length === 0} />
        </View>
      }>
      <Stack.Screen options={{ title: day.name }} />
      <View style={styles.header}>
        <AppText variant="caption" tone="accent">
          {nextWeek ? 'NÄCHSTE WOCHE · ' : ''}{WEEKDAYS_LONG[weekday].toUpperCase()}{weekday !== day.weekday ? ` · VERSCHOBEN (SONST ${WEEKDAYS_LONG[day.weekday].toUpperCase()})` : ''}
        </AppText>
        <AppText variant="title" accessibilityRole="header">{day.name}</AppText>
        <AppText tone="secondary">{day.exercises.length} Übungen · ca. {estimateDayMinutes(day)} min</AppText>
      </View>

      {moving ? (
        <Card style={styles.move}>
          <AppText variant="bodyStrong">Auf welchen Tag {nextWeek ? 'nächste' : 'diese'} Woche?</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {WEEKDAYS_SHORT.map((label, w) => (
              <Chip
                key={label}
                role="radio"
                label={label}
                selected={w === weekday}
                disabled={w < firstAllowed}
                onPress={async () => {
                  setError(null);
                  try {
                    await app.moveTraining(day.id, weekDate, w);
                    setMoving(false);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Verschieben fehlgeschlagen.');
                  }
                }}
              />
            ))}
          </View>
          <AppText variant="small" tone="secondary">Gilt nur für diese Woche. Liegt dort schon eine Einheit, tauschen beide den Tag.</AppText>
          <Button label="Abbrechen" size="sm" variant="ghost" onPress={() => setMoving(false)} />
        </Card>
      ) : (
        <Button label="Auf anderen Tag verschieben" icon={CalendarClock} variant="secondary" size="sm" onPress={() => setMoving(true)} />
      )}

      <Card>
        <BodyMap load={load} size={200} />
      </Card>

      <SectionHeader title="Übungen" actionLabel="Anpassen" onAction={() => router.push(`/plan/builder?day=${day.weekday}`)} />
      {day.exercises.length === 0 ? (
        <EmptyState icon={Pencil} title="Noch keine Übungen" message="Tippe auf „Neue Übung“, die App schlägt dir passende vor." />
      ) : (
        <Card padded={false}>
          {day.exercises.map((pe, i) => {
            const ex = getExercise(pe.exerciseId);
            return (
              <Pressable
                key={`${pe.exerciseId}-${i}`}
                onPress={() => ex && router.push({ pathname: '/library/[id]', params: { id: ex.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${ex?.name ?? pe.exerciseId}, ${prescriptionText(pe)}`}
                style={[styles.row, i > 0 && styles.divider]}>
                <AppText variant="small" tone="secondary" style={styles.no}>{i + 1}</AppText>
                <AppText style={styles.flex} numberOfLines={1}>{ex?.name ?? pe.exerciseId}</AppText>
                <AppText variant="small" tone="accent" style={styles.bold}>{prescriptionText(pe)}</AppText>
                <ChevronRight size={16} color={colors.textSecondary} />
              </Pressable>
            );
          })}
        </Card>
      )}
      <Button label="Neue Übung" icon={Plus} variant="secondary" onPress={() => setAssistant(true)} accessibilityHint="Die App schlägt passende Übungen für diese Einheit vor" />
      <AppText variant="small" tone="secondary">Gewichtsempfehlungen siehst du beim Training direkt an jeder Übung.</AppText>

      {profile && plan ? (
        <AddExerciseAssistant
          visible={assistant}
          day={day}
          allDays={plan.days}
          profile={profile}
          onClose={() => setAssistant(false)}
          onAdd={(e) => app.savePlan({ ...plan, days: plan.days.map((d) => (d.id === day.id && !d.exercises.some((x) => x.exerciseId === e.id) ? { ...d, exercises: [...d.exercises, prescribe(e, profile)] } : d)) })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  header: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 56 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  no: { width: 16 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  move: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
