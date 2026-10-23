import { router } from 'expo-router';
import { CalendarDays, Info, Play, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
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
import { addDays, isSameDay, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekdayIndex } from '@/domain/dates';
import { getGreeting } from '@/domain/greeting';
import { dayMuscleLoad, MUSCLE_LABELS } from '@/domain/muscles';
import { computeChapters, computeWeeklyQuests, summarizeWeek } from '@/domain/progression';
import { lastTrainedMuscles } from '@/domain/muscleStats';
import { getNextRank } from '@/domain/ranks';
import { getWeekOverview } from '@/domain/weekPlan';
import { getNextSession } from '@/domain/workout';
import { BodyMap } from '@/features/BodyMap';
import { ChapterCard } from '@/features/ChapterCard';
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
  const progressInput = useMemo(() => ({ sessions, xpEvents, plan, now, experience: profile?.experience, startedAt: profile?.createdAt }), [sessions, xpEvents, plan, now, profile]);
  const quests = useMemo(() => computeWeeklyQuests(progressInput), [progressInput]);
  const chapter = useMemo(() => computeChapters(progressInput).find((c) => c.status === 'active') ?? null, [progressInput]);
  const lastTrained = useMemo(() => lastTrainedMuscles(sessions), [sessions]);
  const overview = useMemo(() => getWeekOverview(plan, sessions, now, now), [plan, sessions, now]);
  const nextLoad = useMemo(() => (next ? dayMuscleLoad(next.day) : null), [next]);
  const nextRank = getNextRank(level.level);
  const activeQuests = quests.filter((q) => !q.completed).slice(0, 1);
  const greeting = getGreeting({
    name: profile?.displayName ?? '',
    date: now,
    hasSessions: sessions.length > 0,
    hasActiveWorkout: !!activeWorkout,
    trainingToday: !!next?.isToday,
    trainedToday: sessions.some((s) => isSameDay(new Date(s.finishedAt), now)),
    openQuests: quests.filter((q) => !q.completed).length,
  });

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

      {profile && !profile.onboardingCompleted ? (
        <Card variant="secondary" onPress={() => router.push('/profile/edit')} accessibilityLabel="Profil vervollständigen" style={styles.hint}>
          <Info size={20} color={colors.warning} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Profil vervollständigen</AppText>
            <AppText variant="small" tone="secondary">Mit deinen Angaben werden Plan und Vorschläge passender.</AppText>
          </View>
        </Card>
      ) : null}

      <SectionHeader title="Nächstes Training" {...(plan ? { actionLabel: 'Plan bearbeiten', onAction: () => router.push('/plan/builder') } : {})} />
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
          onPress={() => router.push({ pathname: '/day/[dayId]', params: { dayId: next.day.id } })}
          onStart={start}
          startLabel={next.nextWeek ? 'Trotzdem jetzt trainieren' : 'Training starten'}
        />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Deine Trainingsreise beginnt hier."
          message="Erstelle deinen persönlichen Trainingsplan und entdecke, welche Muskelgruppen du trainierst."
          actionLabel="+ Trainingsplan erstellen"
          onAction={() => router.push('/plan/create')}
        />
      )}
      {!activeWorkout && next && nextLoad ? (
        <Card onPress={() => router.push({ pathname: '/day/[dayId]', params: { dayId: next.day.id } })} accessibilityLabel="Muskeln im nächsten Training" accessibilityHint="Öffnet die Einheit">
          <AppText variant="bodyStrong">Das trainierst du</AppText>
          <BodyMap load={nextLoad} size={170} />
        </Card>
      ) : null}
      {starting ? <AppText tone="secondary">Training wird vorbereitet …</AppText> : null}
      {startError ? <AppText tone="error" accessibilityRole="alert">{startError}</AppText> : null}

      <Card
        style={styles.levelCard}
        onPress={() => router.push('/progress')}
        accessibilityLabel={`Rang ${rank.name}, Level ${level.level}, ${level.totalXp} XP gesamt, noch ${level.xpRemaining} XP bis Level ${level.level + 1}`}
        accessibilityHint="Öffnet die XP- und Rangübersicht">
        <View style={styles.levelRow}>
          <LevelBadge level={level.level} />
          <View style={styles.flex}>
            <AppText variant="caption" tone="accent">RANG</AppText>
            <AppText variant="heading">{rank.name}</AppText>
            <AppText variant="small" tone="secondary">Level {level.level} · {level.totalXp} XP gesamt</AppText>
            <AppText variant="small" tone="secondary">{nextRank ? `Nächster Rang: ${nextRank.name} ab Level ${nextRank.minLevel}` : 'Höchster Rang erreicht'}</AppText>
          </View>
        </View>
        <XPBar progress={level} />
      </Card>


      {plan ? (
        <>
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
        </>
      ) : null}

      {lastTrained && lastTrained.muscles.length ? (
        <Card onPress={() => router.push('/stats')} accessibilityHint="Öffnet deinen Fortschritt" style={styles.gapSm}>
          <AppText variant="caption" tone="secondary">ZULETZT TRAINIERT · {WEEKDAYS_LONG[weekdayIndex(new Date(lastTrained.session.finishedAt))].toUpperCase()}</AppText>
          <AppText>{lastTrained.muscles.slice(0, 6).map((m) => MUSCLE_LABELS[m]).join(', ')}</AppText>
        </Card>
      ) : null}

      <SectionHeader title="Nächste Quest" actionLabel="Alle Quests" onAction={() => router.push('/quests')} />
      {activeQuests.length > 0 ? (
        <View style={styles.gap}>
          {activeQuests.map((q) => (
            <QuestCard key={q.id} quest={q} compact onPress={() => router.push({ pathname: '/quest/[id]', params: { id: q.id } })} />
          ))}
        </View>
      ) : chapter ? (
        <ChapterCard chapter={chapter} compact onPress={() => router.push('/quests')} />
      ) : (
        <Card variant="highlight" style={styles.hint}>
          <Sparkles size={20} color={colors.accent} />
          <AppText style={styles.flex}>Alle Wochenquests erledigt! Neue Quests gibt es am Montag.</AppText>
        </Card>
      )}

    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  gap: { gap: spacing.md },
  gapSm: { gap: spacing.xs },
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
});
