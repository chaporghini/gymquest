import { router } from 'expo-router';
import { BookOpen, CalendarPlus, Check, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, Screen, SectionHeader, WorkoutCard } from '@/components';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/domain/dates';
import { estimateDayMinutes } from '@/domain/planGenerator';
import { getWeekOverview } from '@/domain/weekPlan';
import { getNextSession } from '@/domain/workout';
import { MuscleMapCard } from '@/features/MuscleMapCard';
import { SuggestionsList } from '@/features/SuggestionsList';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function Training() {
  const app = useApp();
  const { plan, sessions, activeWorkout } = app;
  const [error, setError] = useState<string | null>(null);
  const now = useMemo(() => new Date(), [sessions, plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = useMemo(() => getWeekOverview(plan, sessions, now, now), [plan, sessions, now]);
  const next = useMemo(() => getNextSession(plan, sessions, now), [plan, sessions, now]);

  const start = async (dayId: string) => {
    setError(null);
    if (activeWorkout) return router.push('/workout/active');
    try {
      await app.startWorkout(dayId);
      router.push('/workout/active');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Training konnte nicht gestartet werden.');
    }
  };

  if (!plan || plan.days.length === 0) {
    return (
      <Screen>
        <AppText variant="title" accessibilityRole="header">Training</AppText>
        <EmptyState
          icon={CalendarPlus}
          title="Deine Trainingsreise beginnt hier."
          message="Erstelle deinen persönlichen Trainingsplan und entdecke, welche Muskelgruppen du trainierst."
          actionLabel="+ Trainingsplan erstellen"
          onAction={() => router.push('/plan/create')}
        />
        <SectionHeader title="Muskelkarte" />
        <MuscleMapCard plan={null} sessions={sessions} />
        <Button label="Übungsbibliothek" icon={BookOpen} variant="secondary" onPress={() => router.push('/library')} />
        {error ? <AppText tone="error">{error}</AppText> : null}
      </Screen>
    );
  }

  const restDays = week.days.filter((d) => !d.planDay).map((d) => WEEKDAYS_SHORT[d.weekday]);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">Training</AppText>
        <AppText tone="secondary">{plan.name}</AppText>
      </View>

      {activeWorkout ? (
        <Button label="Laufendes Training fortsetzen" size="lg" onPress={() => router.push('/workout/active')} fullWidth />
      ) : next ? (
        <WorkoutCard
          day={next.day}
          subtitle={next.isToday ? 'Heute' : next.nextWeek ? `Nächste Woche · ${WEEKDAYS_LONG[next.day.weekday]}` : WEEKDAYS_LONG[next.day.weekday]}
          highlight={next.isToday}
          onPress={() => router.push({ pathname: '/day/[dayId]', params: { dayId: next.day.id } })}
          onStart={() => start(next.day.id)}
        />
      ) : null}
      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}

      <SuggestionsList />

      <SectionHeader title="Muskeln in deinem Plan" />
      <MuscleMapCard plan={plan} sessions={sessions} />

      <SectionHeader title="Diese Woche" actionLabel="Plan anpassen" onAction={() => router.push('/plan/builder')} />
      <Card padded={false}>
        {week.days.filter((d) => d.planDay).map((d, i) => {
          const day = d.planDay!;
          const done = d.status === 'done';
          const today = d.status === 'today';
          return (
            <Pressable
              key={day.id}
              onPress={() => router.push({ pathname: '/day/[dayId]', params: { dayId: day.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAYS_LONG[d.weekday]}: ${day.name}${done ? ', erledigt' : today ? ', heute' : ''}`}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}>
              <View style={[styles.dayBadge, today && styles.dayToday, done && styles.dayDone]}>
                {done ? <Check size={18} color={colors.onAccent} strokeWidth={3} /> : <AppText variant="small" style={styles.bold} tone={today ? 'accent' : 'primary'}>{WEEKDAYS_SHORT[d.weekday]}</AppText>}
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>{day.name}</AppText>
                <AppText variant="small" tone="secondary">{day.exercises.length} Übungen · ca. {estimateDayMinutes(day)} min</AppText>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          );
        })}
      </Card>
      {restDays.length ? <AppText variant="small" tone="secondary">Ruhetage: {restDays.join(', ')}</AppText> : null}

      <Button label="Übungsbibliothek" icon={BookOpen} variant="secondary" onPress={() => router.push('/library')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 64 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.8 },
  dayBadge: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 2, borderColor: colors.accent, backgroundColor: 'transparent' },
  dayDone: { backgroundColor: colors.accent },
});
