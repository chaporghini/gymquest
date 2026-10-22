import { router } from 'expo-router';
import { CalendarDays, Dumbbell, Info, Play, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AchievementCard,
  AppText,
  Button,
  Card,
  EmptyState,
  LevelBadge,
  ProgressRing,
  QuestCard,
  Screen,
  SectionHeader,
  WorkoutCard,
  XPBar,
} from '@/components';
import { addDays, isSameDay, startOfWeek, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekdayIndex } from '@/domain/dates';
import { computeAchievements, computeWeeklyQuests, sessionsInWeek, summarizeWeek } from '@/domain/progression';
import { getNextRank } from '@/domain/ranks';
import { getNextSession } from '@/domain/workout';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export default function Home() {
  const app = useApp();
  const { profile, plan, sessions, xpEvents, level, rank, activeWorkout } = app;
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const now = useMemo(() => new Date(), [sessions, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useMemo(() => getNextSession(plan, sessions, now), [plan, sessions, now]);
  const week = useMemo(() => summarizeWeek(sessions, plan, now), [sessions, plan, now]);
  const quests = useMemo(() => computeWeeklyQuests({ sessions, xpEvents, plan, now }), [sessions, xpEvents, plan, now]);
  const achievements = useMemo(
    () =>
      computeAchievements({ sessions, xpEvents, plan, now })
        .filter((a) => a.unlockedAt)
        .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
        .slice(0, 2),
    [sessions, xpEvents, plan, now],
  );
  const doneDayIds = useMemo(() => new Set(sessionsInWeek(sessions, startOfWeek(now)).map((s) => s.planDayId)), [sessions, now]);
  const nextRank = getNextRank(level.level);
  const activeQuests = quests.filter((q) => !q.completed).slice(0, 3);

  const start = async () => {
    setStartError(null);
    if (activeWorkout) return router.push('/workout/active');
    if (!next) return router.push('/training');
    setStarting(true);
    try {
      await app.startWorkout(next.day.id);
      router.push('/workout/active');
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Training konnte nicht gestartet werden.');
    } finally {
      setStarting(false);
    }
  };

  const nextLabel = next
    ? next.isToday
      ? 'Heute'
      : isSameDay(next.date, addDays(now, 1))
        ? 'Morgen'
        : next.nextWeek
          ? `Nächste Woche · ${WEEKDAYS_LONG[next.day.weekday]}`
          : WEEKDAYS_LONG[next.day.weekday]
    : '';

  return (
    <Screen>
      <View style={styles.header}>
        <AppText tone="secondary">{greeting(now)},</AppText>
        <AppText variant="display" numberOfLines={1}>{profile?.displayName ?? 'Abenteurer'}</AppText>
      </View>

      <Card style={styles.levelCard} accessibilityLabel={`Rang ${rank.name}, Level ${level.level}, ${level.totalXp} XP gesamt`}>
        <View style={styles.levelRow}>
          <LevelBadge level={level.level} size="lg" />
          <View style={styles.flex}>
            <AppText variant="caption" tone="accent">RANG</AppText>
            <AppText variant="title">{rank.name}</AppText>
            <AppText variant="small" tone="secondary">{level.totalXp.toLocaleString('de-DE')} XP gesamt</AppText>
          </View>
        </View>
        <XPBar progress={level} />
        {nextRank ? (
          <AppText variant="small" tone="secondary">Nächster Rang: {nextRank.name} ab Level {nextRank.minLevel}</AppText>
        ) : null}
      </Card>

      {profile && !profile.onboardingCompleted ? (
        <Card variant="secondary" onPress={() => router.push('/profile/edit')} accessibilityLabel="Profil vervollständigen" style={styles.hint}>
          <Info size={20} color={colors.warning} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Profil vervollständigen</AppText>
            <AppText variant="small" tone="secondary">Du nutzt einen Standardplan. Mit deinen Angaben wird er passender.</AppText>
          </View>
        </Card>
      ) : null}

      <SectionHeader title="Nächstes Training" actionLabel="Plan ansehen" onAction={() => router.push('/training')} />
      {activeWorkout ? (
        <Card variant="highlight" style={styles.gap}>
          <AppText variant="caption" tone="accent">LÄUFT GERADE</AppText>
          <AppText variant="heading">{activeWorkout.name}</AppText>
          <Button label="Training fortsetzen" icon={Play} onPress={() => router.push('/workout/active')} fullWidth />
        </Card>
      ) : next ? (
        <WorkoutCard
          day={next.day}
          subtitle={nextLabel}
          highlight={next.isToday}
          onPress={() => router.push('/training')}
          onStart={start}
          startLabel={next.nextWeek ? 'Trotzdem jetzt trainieren' : 'Training starten'}
        />
      ) : (
        <EmptyState icon={CalendarDays} title="Kein Trainingsplan" message="Erstelle im Profil einen Plan, um loszulegen." actionLabel="Zum Profil" onAction={() => router.push('/profile')} />
      )}
      {starting ? <AppText tone="secondary">Training wird vorbereitet …</AppText> : null}
      {startError ? <AppText tone="error" accessibilityRole="alert">{startError}</AppText> : null}

      <SectionHeader title="Diese Woche" />
      <Card style={styles.weekCard}>
        <ProgressRing value={week.goal ? week.workouts / week.goal : 0} size={92} accessibilityLabel={`Wochenziel: ${week.workouts} von ${week.goal} Trainings`}>
          <AppText variant="heading">{week.workouts}/{week.goal}</AppText>
          <AppText variant="caption" tone="secondary">EINHEITEN</AppText>
        </ProgressRing>
        <View style={styles.weekStats}>
          <View style={styles.days}>
            {WEEKDAYS_SHORT.map((label, i) => {
              const planned = plan?.days.find((d) => d.weekday === i);
              const done = planned ? doneDayIds.has(planned.id) : false;
              const today = i === weekdayIndex(now);
              return (
                <View key={label} style={styles.dayCol} accessibilityLabel={`${WEEKDAYS_LONG[i]}: ${planned ? (done ? 'erledigt' : 'geplant') : 'Ruhetag'}`}>
                  <View style={[styles.dayDot, planned && styles.dayPlanned, done && styles.dayDone, today && styles.dayToday]} />
                  <AppText variant="caption" tone={today ? 'accent' : 'secondary'}>{label}</AppText>
                </View>
              );
            })}
          </View>
          <AppText variant="small" tone="secondary">
            {week.sets} Sätze · {week.minutes} min Training
          </AppText>
          <AppText variant="small" tone={week.workouts >= week.goal ? 'accent' : 'secondary'}>
            {week.workouts >= week.goal ? 'Wochenziel erreicht – stark!' : `Noch ${week.goal - week.workouts} bis zum Wochenziel`}
          </AppText>
        </View>
      </Card>

      <View style={styles.quick}>
        <Button label="Training starten" icon={Play} onPress={start} loading={starting} style={styles.quickBtn} accessibilityHint="Startet die nächste geplante Einheit" />
        <Button label="Trainingsplan" icon={CalendarDays} variant="secondary" onPress={() => router.push('/training')} style={styles.quickBtn} accessibilityLabel="Trainingsplan ansehen" />
      </View>

      <SectionHeader title="Aktive Quests" actionLabel="Alle Quests" onAction={() => router.push('/quests')} />
      {activeQuests.length > 0 ? (
        <View style={styles.gap}>
          {activeQuests.map((q) => <QuestCard key={q.id} quest={q} compact />)}
        </View>
      ) : (
        <Card variant="highlight" style={styles.hint}>
          <Sparkles size={20} color={colors.accent} />
          <AppText style={styles.flex}>Alle Wochenquests erledigt! Neue Quests gibt es am Montag.</AppText>
        </Card>
      )}

      <SectionHeader title="Letzte Achievements" actionLabel="Alle ansehen" onAction={() => router.push('/quests')} />
      {achievements.length > 0 ? (
        <View style={styles.achievements}>
          {achievements.map((a) => <AchievementCard key={a.id} achievement={a} />)}
        </View>
      ) : (
        <Card variant="secondary" style={styles.hint}>
          <Dumbbell size={20} color={colors.textSecondary} />
          <AppText tone="secondary" style={styles.flex}>Schließe dein erstes Training ab, um dein erstes Achievement zu erhalten.</AppText>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  flex: { flex: 1 },
  gap: { gap: spacing.md },
  levelCard: { gap: spacing.lg },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weekCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  weekStats: { flex: 1, gap: spacing.sm },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4 },
  dayDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.cardSecondary },
  dayPlanned: { borderWidth: 2, borderColor: colors.accent, backgroundColor: 'transparent' },
  dayDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayToday: { transform: [{ scale: 1.15 }] },
  quick: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  quickBtn: { flexGrow: 1, flexBasis: 160 },
  achievements: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
