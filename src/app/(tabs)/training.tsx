import { router } from 'expo-router';
import { BookOpen, CalendarDays, Moon, Pencil } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, Screen, SectionHeader, WorkoutCard } from '@/components';
import { startOfWeek, WEEKDAYS_LONG, weekdayIndex } from '@/domain/dates';
import { estimateDayMinutes } from '@/domain/planGenerator';
import { sessionsInWeek } from '@/domain/progression';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

export default function Training() {
  const app = useApp();
  const { plan, sessions, activeWorkout } = app;
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const today = weekdayIndex(now);
  const doneIds = useMemo(() => new Set(sessionsInWeek(sessions, startOfWeek(new Date())).map((s) => s.planDayId)), [sessions]);

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

  if (!plan) {
    return (
      <Screen>
        <AppText variant="title" accessibilityRole="header">Training</AppText>
        <EmptyState icon={CalendarDays} title="Noch kein Trainingsplan" message="Lass dir auf Basis deines Profils einen Plan erstellen." actionLabel="Plan erstellen" onAction={() => app.regeneratePlan().catch((e) => setError(String(e)))} />
        {error ? <AppText tone="error">{error}</AppText> : null}
      </Screen>
    );
  }

  const totalMinutes = plan.days.reduce((n, d) => n + estimateDayMinutes(d), 0);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">Trainingsplan</AppText>
        <AppText tone="secondary">{plan.name}</AppText>
        <AppText variant="small" tone="secondary">
          {plan.days.length} Einheiten · ca. {totalMinutes} min pro Woche · {7 - plan.days.length} Ruhetage
        </AppText>
      </View>

      <View style={styles.actions}>
        <Button label="Plan bearbeiten" icon={Pencil} variant="secondary" onPress={() => router.push('/plan/edit')} style={styles.flex} />
        <Button label="Übungen" icon={BookOpen} variant="secondary" onPress={() => router.push('/library')} style={styles.flex} accessibilityLabel="Übungsbibliothek öffnen" />
      </View>
      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}

      <SectionHeader title="Wochenübersicht" />
      {WEEKDAYS_LONG.map((label, weekday) => {
        const day = plan.days.find((d) => d.weekday === weekday);
        const isToday = weekday === today;
        if (!day) {
          return (
            <Card key={label} variant="secondary" style={styles.rest} accessibilityLabel={`${label}: Ruhetag`}>
              <Moon size={18} color={colors.textSecondary} />
              <View style={styles.flex}>
                <AppText variant="caption" tone={isToday ? 'accent' : 'secondary'}>{isToday ? `HEUTE · ${label.toUpperCase()}` : label.toUpperCase()}</AppText>
                <AppText tone="secondary">Ruhetag – Erholung gehört zum Training.</AppText>
              </View>
            </Card>
          );
        }
        const done = doneIds.has(day.id);
        const isActive = activeWorkout?.planDayId === day.id;
        return (
          <WorkoutCard
            key={label}
            day={day}
            subtitle={isToday ? `Heute · ${label}` : label}
            highlight={isToday && !done}
            done={done}
            onPress={() => router.push({ pathname: '/plan/day/[dayId]', params: { dayId: day.id } })}
            onStart={() => start(day.id)}
            startLabel={isActive ? 'Fortsetzen' : activeWorkout ? 'Laufendes Training öffnen' : done ? 'Erneut trainieren' : 'Training starten'}
          />
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  rest: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
