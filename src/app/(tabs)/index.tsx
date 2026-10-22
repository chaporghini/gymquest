import { router } from 'expo-router';
import { Award, CalendarDays, Dumbbell, Info, Play, Sparkles, Target } from 'lucide-react-native';
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
import { addDays, formatDate, isSameDay, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekdayIndex } from '@/domain/dates';
import { getGreeting } from '@/domain/greeting';
import { computeAchievements, computeWeeklyQuests, summarizeWeek } from '@/domain/progression';
import { getNextRank } from '@/domain/ranks';
import { getWeekOverview } from '@/domain/weekPlan';
import { getNextSession } from '@/domain/workout';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

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
  const overview = useMemo(() => getWeekOverview(plan, sessions, now, now), [plan, sessions, now]);
  const nextRank = getNextRank(level.level);
  const activeQuests = quests.filter((q) => !q.completed).slice(0, 3);
  const greeting = getGreeting({
    name: profile?.displayName ?? '',
    date: now,
    hasSessions: sessions.length > 0,
    hasActiveWorkout: !!activeWorkout,
    trainingToday: !!next?.isToday,
    trainedToday: sessions.some((s) => isSameDay(new Date(s.finishedAt), now)),
    openQuests: quests.filter((q) => !q.completed).length,
  });
  const recentXp = xpEvents.slice(0, 3);

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
  const nextSubtitle = next ? (next.isToday || nextLabel === 'Morgen' ? `${nextLabel} · ${WEEKDAYS_LONG[next.day.weekday]}` : nextLabel) : '';

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">{greeting.title}</AppText>
        <AppText tone="secondary">{greeting.subtitle}</AppText>
      </View>

      <Card
        style={styles.levelCard}
        onPress={() => router.push('/progress')}
        accessibilityLabel={`Rang ${rank.name}, Level ${level.level}, ${level.totalXp} XP gesamt, noch ${level.xpRemaining} XP bis Level ${level.level + 1}`}
        accessibilityHint="Öffnet die XP- und Rangübersicht">
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
        {recentXp.length > 0 ? (
          <View style={styles.recent}>
            <AppText variant="caption" tone="secondary">ZULETZT ERHALTEN</AppText>
            {recentXp.map((e) => {
              const Icon = e.source === 'workout' ? Dumbbell : e.source === 'quest' ? Target : Award;
              return (
                <View key={e.id} style={styles.recentRow}>
                  <Icon size={14} color={colors.textSecondary} />
                  <AppText variant="small" numberOfLines={1} style={styles.flex}>{e.label}</AppText>
                  <AppText variant="small" tone="secondary">{formatDate(e.createdAt).slice(0, 10)}</AppText>
                  <AppText variant="small" tone="accent" style={styles.bold}>{e.amount > 0 ? `+${e.amount}` : '–'}</AppText>
                </View>
              );
            })}
          </View>
        ) : (
          <AppText variant="small" tone="secondary">XP gibt es für abgeschlossene Trainings, Quests und Achievements.</AppText>
        )}
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
          subtitle={nextSubtitle}
          highlight={next.isToday}
          showExercises
          onPress={() => router.push({ pathname: '/day/[dayId]', params: { dayId: next.day.id } })}
          onStart={start}
          startLabel={next.nextWeek ? 'Trotzdem jetzt trainieren' : 'Training starten'}
        />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Noch kein Trainingsplan"
          message="Lass dir aus deinem Profil einen Wochenplan erstellen. Du kannst ihn danach jederzeit anpassen."
          actionLabel="Trainingsplan erstellen"
          onAction={() => app.regeneratePlan().catch((e) => setStartError(e instanceof Error ? e.message : 'Plan konnte nicht erstellt werden.'))}
        />
      )}
      {starting ? <AppText tone="secondary">Training wird vorbereitet …</AppText> : null}
      {startError ? <AppText tone="error" accessibilityRole="alert">{startError}</AppText> : null}

      <SectionHeader title="Diese Woche" actionLabel="Dein Fortschritt" onAction={() => router.push('/report')} />
      <Card
        style={styles.weekCard}
        onPress={() => router.push('/training')}
        accessibilityLabel={`Diese Woche: ${week.workouts} von ${week.goal} Einheiten erledigt, ${week.sets} Sätze`}
        accessibilityHint="Öffnet den Wochenplan">
        <ProgressRing value={overview.planned ? overview.completed / overview.planned : 0} size={92}>
          <AppText variant="heading">{overview.completed}/{overview.planned}</AppText>
          <AppText variant="caption" tone="secondary">EINHEITEN</AppText>
        </ProgressRing>
        <View style={styles.weekStats}>
          <View style={styles.days}>
            {overview.days.map((d, i) => {
              const label = WEEKDAYS_SHORT[i];
              const today = i === weekdayIndex(now);
              const statusText = { rest: 'Ruhetag', planned: 'geplant', today: 'heute geplant', done: 'erledigt', missed: 'nicht absolviert' }[d.status];
              return (
                <View key={label} style={styles.dayCol} accessibilityLabel={`${WEEKDAYS_LONG[i]}: ${statusText}`}>
                  <View
                    style={[
                      styles.dayDot,
                      d.planDay && styles.dayPlanned,
                      d.status === 'missed' && styles.dayMissed,
                      d.status === 'done' && styles.dayDone,
                      today && styles.dayToday,
                    ]}
                  />
                  <AppText variant="caption" tone={today ? 'accent' : 'secondary'}>{label}</AppText>
                </View>
              );
            })}
          </View>
          <AppText variant="small" tone="secondary">
            {overview.completed} von {overview.planned} geplanten Einheiten erledigt
            {overview.extraSessions > 0 ? ` · ${overview.extraSessions} zusätzlich` : ''}
          </AppText>
          <AppText variant="small" tone="secondary">
            {week.sets} Sätze · {week.minutes} min Training
          </AppText>
          {overview.planned > 0 && overview.completed >= overview.planned ? (
            <AppText variant="small" tone="accent">Alle geplanten Einheiten erledigt.</AppText>
          ) : null}
        </View>
      </Card>

      <View style={styles.quick}>
        <Button label="Training starten" icon={Play} onPress={start} loading={starting} style={styles.quickBtn} accessibilityHint="Startet die nächste geplante Einheit" />
        <Button label="Trainingsplan" icon={CalendarDays} variant="secondary" onPress={() => router.push('/training')} style={styles.quickBtn} accessibilityLabel="Trainingsplan ansehen" />
      </View>

      <SectionHeader title="Aktive Quests" actionLabel="Alle Quests" onAction={() => router.push('/quests')} />
      {activeQuests.length > 0 ? (
        <View style={styles.gap}>
          {activeQuests.map((q) => (
            <QuestCard key={q.id} quest={q} compact onPress={() => router.push({ pathname: '/quest/[id]', params: { id: q.id } })} />
          ))}
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
  header: { gap: 4 },
  bold: { fontWeight: '700' },
  recent: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  dayMissed: { borderColor: colors.warning },
  dayDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayToday: { transform: [{ scale: 1.15 }] },
  quick: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  quickBtn: { flexGrow: 1, flexBasis: 160 },
  achievements: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
