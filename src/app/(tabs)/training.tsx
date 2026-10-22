import { router } from 'expo-router';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Moon, Pencil } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, Screen, SectionHeader, WorkoutCard } from '@/components';
import { addDays, formatDate, WEEKDAYS_LONG } from '@/domain/dates';
import { estimateDayMinutes } from '@/domain/planGenerator';
import { getWeekOverview, type WeekDayEntry } from '@/domain/weekPlan';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

const STATUS_LABEL: Record<WeekDayEntry['status'], string> = {
  rest: 'Ruhetag',
  planned: 'Geplant',
  today: 'Heute',
  done: 'Erledigt',
  missed: 'Nicht absolviert',
};

export default function Training() {
  const app = useApp();
  const { plan, sessions, activeWorkout } = app;
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const week = useMemo(() => {
    const now = new Date();
    return getWeekOverview(plan, sessions, addDays(now, weekOffset * 7), now);
  }, [plan, sessions, weekOffset]);

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
        <EmptyState
          icon={CalendarDays}
          title="Noch kein Trainingsplan"
          message="Lass dir auf Basis deines Profils einen Plan erstellen."
          actionLabel="Plan erstellen"
          onAction={() => app.regeneratePlan().catch((e) => setError(e instanceof Error ? e.message : String(e)))}
        />
        {error ? <AppText tone="error">{error}</AppText> : null}
      </Screen>
    );
  }

  const totalMinutes = plan.days.reduce((n, d) => n + estimateDayMinutes(d), 0);
  const weekTitle = week.isCurrentWeek ? 'Diese Woche' : weekOffset === -1 ? 'Letzte Woche' : weekOffset === 1 ? 'Nächste Woche' : week.label;

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

      <View style={styles.weekNav}>
        <Pressable onPress={() => setWeekOffset((w) => w - 1)} accessibilityRole="button" accessibilityLabel="Vorherige Woche" style={styles.navBtn}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={styles.weekTitle} accessibilityLiveRegion="polite">
          <AppText variant="heading">{weekTitle}</AppText>
          <AppText variant="small" tone="secondary">{week.label} · {week.rangeLabel}</AppText>
        </View>
        <Pressable onPress={() => setWeekOffset((w) => w + 1)} accessibilityRole="button" accessibilityLabel="Nächste Woche" style={styles.navBtn}>
          <ChevronRight size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.summaryRow}>
        <AppText variant="small" tone="secondary" style={styles.flex}>
          {week.completed} von {week.planned} Einheiten erledigt
          {week.extraSessions > 0 ? ` · ${week.extraSessions} zusätzliche${week.extraSessions === 1 ? 's' : ''} Training` : ''}
        </AppText>
        {!week.isCurrentWeek ? (
          <Pressable onPress={() => setWeekOffset(0)} accessibilityRole="button" hitSlop={8}>
            <AppText variant="small" tone="accent" style={styles.bold}>Zu heute</AppText>
          </Pressable>
        ) : null}
      </View>
      {week.isPast ? (
        <AppText variant="small" tone="secondary">Vergangene Wochen zeigen deinen aktuellen Plan und die tatsächlich gespeicherten Trainings.</AppText>
      ) : null}

      <SectionHeader title="Wochenübersicht" />
      {week.days.map((d) => {
        const dateLabel = `${WEEKDAYS_LONG[d.weekday]}, ${d.date.getDate()}.${d.date.getMonth() + 1}.`;
        const extra = d.sessions.filter((s) => s.id !== d.completedBy?.id);
        if (!d.planDay) {
          return (
            <Card key={d.weekday} variant="secondary" style={styles.rest} accessibilityLabel={`${dateLabel}: Ruhetag${extra.length ? `, ${extra.length} Training absolviert` : ''}`}>
              <Moon size={18} color={colors.textSecondary} />
              <View style={styles.flexGap}>
                <AppText variant="caption" tone={d.status === 'rest' && isToday(d) ? 'accent' : 'secondary'}>
                  {isToday(d) ? `HEUTE · ${dateLabel.toUpperCase()}` : dateLabel.toUpperCase()}
                </AppText>
                <AppText tone="secondary">Ruhetag – Erholung gehört zum Training.</AppText>
                {extra.map((s) => (
                  <ExtraSession key={s.id} name={s.name} id={s.id} />
                ))}
              </View>
            </Card>
          );
        }
        const canStart = week.isCurrentWeek && d.status !== 'done';
        const isActive = activeWorkout?.planDayId === d.planDay.id;
        return (
          <View key={d.weekday} style={styles.dayBlock}>
            <WorkoutCard
              day={d.planDay}
              subtitle={`${isToday(d) ? 'Heute · ' : ''}${dateLabel} · ${STATUS_LABEL[d.status]}`}
              highlight={d.status === 'today'}
              done={d.status === 'done'}
              onPress={() => router.push({ pathname: '/day/[dayId]', params: { dayId: d.planDay!.id } })}
              onStart={canStart || isActive ? () => start(d.planDay!.id) : undefined}
              startLabel={isActive ? 'Fortsetzen' : activeWorkout ? 'Laufendes Training öffnen' : 'Training starten'}
            />
            {d.completedBy ? (
              <ExtraSession name={`Erledigt am ${formatDate(d.completedBy.finishedAt)}`} id={d.completedBy.id} />
            ) : null}
            {extra.map((s) => (
              <ExtraSession key={s.id} name={s.name} id={s.id} />
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

function isToday(d: WeekDayEntry) {
  const now = new Date();
  return d.date.getFullYear() === now.getFullYear() && d.date.getMonth() === now.getMonth() && d.date.getDate() === now.getDate();
}

function ExtraSession({ name, id }: { name: string; id: string }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/history/[id]', params: { id } })}
      accessibilityRole="button"
      accessibilityLabel={`Training ansehen: ${name}`}
      style={styles.extra}>
      <AppText variant="small" tone="accent" numberOfLines={1} style={styles.flex}>✓ {name}</AppText>
      <ChevronRight size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  flexGap: { flex: 1, gap: 2 },
  bold: { fontWeight: '700' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xs },
  navBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  weekTitle: { flex: 1, alignItems: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: -spacing.sm },
  rest: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dayBlock: { gap: spacing.xs },
  extra: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36, paddingHorizontal: spacing.md },
});
