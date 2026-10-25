import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { BookOpen, CalendarCheck, ChevronRight, CloudOff, Dumbbell, Flame, Info, Play, Plus, Sparkles, Star, Target, Trophy, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Button, Card, ProgressBar, Screen, SectionHeader } from '@/components';
import { addDays, isSameDay, startOfDay, WEEKDAYS_LONG } from '@/domain/dates';
import { getGreeting } from '@/domain/greeting';
import { dayMuscleLoad } from '@/domain/muscles';
import { computeChapters, computeWeeklyQuests, weeklyStreak, type QuestStatus } from '@/domain/progression';
import { estimateDayMinutes } from '@/domain/planGenerator';
import { getNextRank } from '@/domain/ranks';
import type { XpEvent } from '@/domain/types';
import { getWeekOverview } from '@/domain/weekPlan';
import { getNextSession } from '@/domain/workout';
import { BodyMap } from '@/features/BodyMap';
import { ChapterCard } from '@/features/ChapterCard';
import { useApp } from '@/state/AppProvider';
import { colors, DESKTOP_BREAKPOINT, radius, spacing } from '@/theme/tokens';

export default function Home() {
  const app = useApp();
  const { profile, plan, sessions, xpEvents, level, rank, activeWorkout } = app;
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Über den „Passwort vergessen“-Link geöffnet: direkt zum neuen Passwort.
  const recovery = app.cloud.recovery;
  useEffect(() => {
    if (recovery) router.push('/account');
  }, [recovery]);
  const now = useMemo(() => new Date(), [sessions, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useMemo(() => getNextSession(plan, sessions, now), [plan, sessions, now]);
  const streak = useMemo(() => weeklyStreak(sessions, plan, now), [sessions, plan, now]);
  const volumeKg = useMemo(() => sessions.reduce((n, s) => n + s.sets.reduce((m, x) => m + (x.completed && x.weightKg && x.reps ? x.weightKg * x.reps : 0), 0), 0), [sessions]);
  const { width } = useWindowDimensions();
  const desktop = width >= DESKTOP_BREAKPOINT;
  const progressInput = useMemo(() => ({ sessions, xpEvents, plan, now, experience: profile?.experience, startedAt: profile?.createdAt }), [sessions, xpEvents, plan, now, profile]);
  const quests = useMemo(() => computeWeeklyQuests(progressInput), [progressInput]);
  const chapter = useMemo(() => computeChapters(progressInput).find((c) => c.status === 'active') ?? null, [progressInput]);
  const overview = useMemo(() => getWeekOverview(plan, sessions, now, now), [plan, sessions, now]);
  const nextLoad = useMemo(() => (next ? dayMuscleLoad(next.day) : null), [next]);
  const nextRank = getNextRank(level.level);
  const recent = useMemo(() => [...xpEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4), [xpEvents]);
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

  const dayParams = next ? (next.nextWeek ? { dayId: next.day.id, next: '1' } : { dayId: next.day.id }) : null;

  const hero = (
    <View style={styles.heroWrap}>
      <LinearGradient
        colors={[colors.accentMuted, 'rgba(0,0,0,0)']}
        start={{ x: 0.9, y: 0 }}
        end={{ x: 0.2, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Pressable onPress={() => router.push('/progress')} accessibilityRole="button" accessibilityHint="Öffnet die XP- und Rangübersicht" style={styles.heroTop}>
        <AppText variant="title" numberOfLines={1}>{profile?.displayName || 'Abenteurer'}</AppText>
        <AppText tone="secondary">{nextRank ? `Nächster Rang: ${nextRank.name} ab Level ${nextRank.minLevel}` : 'Höchster Rang erreicht'}</AppText>
        <View style={styles.heroStats}>
          <AppText variant="bodyStrong">Level {level.level}</AppText>
          <View style={styles.sep} />
          <AppText variant="bodyStrong">Rang: {rank.name}</AppText>
          <View style={styles.flex} />
          <AppText variant="bodyStrong"><AppText variant="bodyStrong" tone="accent">{level.totalXp}</AppText> XP</AppText>
        </View>
        <ProgressBar value={level.progress} height={10} accessibilityLabel={`Noch ${level.xpRemaining} XP bis Level ${level.level + 1}`} />
        <View style={styles.heroStats}>
          <AppText variant="small" tone="secondary">{level.xpIntoLevel} / {level.xpForLevel} XP</AppText>
          <View style={styles.flex} />
          {!level.isMaxLevel ? <AppText variant="small" tone="secondary">noch {level.xpRemaining} XP bis Level {level.level + 1}</AppText> : null}
        </View>
      </Pressable>

      {activeWorkout ? (
        <>
          <AppText tone="secondary">Läuft gerade: {activeWorkout.name}</AppText>
          <Button label="Training fortsetzen" icon={Play} size="lg" onPress={() => router.push('/workout/active')} fullWidth />
        </>
      ) : next && dayParams ? (
        <>
          <Pressable onPress={() => router.push({ pathname: '/day/[dayId]', params: dayParams })} accessibilityRole="button" accessibilityLabel={`Nächstes Training: ${next.day.name}, ${nextSubtitle}`} style={styles.nextRow}>
            <View style={styles.flex}>
              <AppText variant="caption" tone="accent">{nextSubtitle.toUpperCase()}</AppText>
              <AppText variant="bodyStrong">{next.day.name}</AppText>
              <AppText variant="small" tone="secondary">{next.day.exercises.length} Übungen · ca. {estimateDayMinutes(next.day)} min</AppText>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
          <Button label={next.nextWeek ? 'Trotzdem jetzt trainieren' : 'Training starten'} icon={Play} size="lg" loading={starting} onPress={start} fullWidth />
        </>
      ) : (
        <>
          <View>
            <AppText variant="bodyStrong">Deine Trainingsreise beginnt hier.</AppText>
            <AppText variant="small" tone="secondary">Erstelle deinen persönlichen Trainingsplan und entdecke, welche Muskelgruppen du trainierst.</AppText>
          </View>
          <Button label="Trainingsplan erstellen" icon={Plus} size="lg" onPress={() => router.push('/plan/create')} fullWidth />
        </>
      )}
      {startError ? <AppText tone="error" accessibilityRole="alert">{startError}</AppText> : null}
    </View>
  );

  const questSection = (
    <>
      <SectionHeader title="Wochenquests" actionLabel="Alle Quests" onAction={() => router.push('/quests')} />
      {quests.length > 0 ? (
        desktop ? (
          <View style={styles.tiles}>
            {quests.slice(0, 3).map((q, i) => (
              <QuestTile key={q.id} quest={q} icon={QUEST_ICONS[i % QUEST_ICONS.length]} onPress={() => router.push({ pathname: '/quest/[id]', params: { id: q.id } })} />
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.questScroll}>
            {quests.slice(0, 3).map((q, i) => (
              <View key={q.id} style={styles.questSlot}>
                <QuestTile quest={q} icon={QUEST_ICONS[i % QUEST_ICONS.length]} onPress={() => router.push({ pathname: '/quest/[id]', params: { id: q.id } })} />
              </View>
            ))}
          </ScrollView>
        )
      ) : chapter ? (
        <ChapterCard chapter={chapter} compact onPress={() => router.push('/quests')} />
      ) : (
        <Card variant="highlight" style={styles.hint}>
          <Sparkles size={20} color={colors.accent} />
          <AppText style={styles.flex}>Alles erledigt! Neue Quests gibt es am Montag.</AppText>
        </Card>
      )}
    </>
  );

  const statTiles = (
    <View style={[styles.tiles, desktop && styles.column]}>
      <StatTile label="Diese Woche" value={plan ? `${overview.completed}/${overview.planned}` : String(overview.completed)} hint="Einheiten" onPress={() => router.push('/training')} />
      <StatTile label="Serie" value={`${streak}`} hint={streak === 1 ? 'Woche' : 'Wochen'} onPress={() => router.push('/report')} />
      <StatTile label="Bewegtes Gewicht" value={formatVolume(volumeKg)} hint="gesamt" onPress={() => router.push('/stats')} wide={!desktop} />
    </View>
  );

  const bodyMap =
    !activeWorkout && next && nextLoad && dayParams ? (
      <>
        <SectionHeader title="Das trainierst du" actionLabel="Plan bearbeiten" onAction={() => router.push('/plan/builder')} />
        <Card onPress={() => router.push({ pathname: '/day/[dayId]', params: dayParams })} accessibilityLabel="Muskeln im nächsten Training" accessibilityHint="Öffnet die Einheit">
          <BodyMap load={nextLoad} size={170} />
        </Card>
      </>
    ) : null;

  const activity = (
    <Card style={styles.gap}>
      <AppText variant="bodyStrong">Letzte Aktivität</AppText>
      {recent.length === 0 ? (
        <AppText variant="small" tone="secondary">Hier erscheinen deine Trainings, Quests und Erfolge.</AppText>
      ) : (
        recent.map((e) => <ActivityRow key={e.id} event={e} now={now} />)
      )}
    </Card>
  );

  const hints = (
    <>
      {profile && !profile.onboardingCompleted ? (
        <Card variant="secondary" onPress={() => router.push('/profile/edit')} accessibilityLabel="Profil vervollständigen" style={styles.hint}>
          <Info size={20} color={colors.warning} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Profil vervollständigen</AppText>
            <AppText variant="small" tone="secondary">Mit deinen Angaben werden Plan und Vorschläge passender.</AppText>
          </View>
        </Card>
      ) : null}
      {app.cloud.configured && app.cloud.ready && !app.cloud.user && sessions.length > 0 ? (
        <Card variant="secondary" onPress={() => router.push('/account')} accessibilityLabel="Fortschritt sichern" style={styles.hint}>
          <CloudOff size={20} color={colors.warning} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Noch nicht gesichert</AppText>
            <AppText variant="small" tone="secondary">Mit einem Konto ist dein Fortschritt auf allen Geräten sicher.</AppText>
          </View>
        </Card>
      ) : null}
    </>
  );

  return (
    <Screen wide>
      <View style={styles.header}>
        {!desktop ? (
          <AppText variant="heading">
            Gym<AppText variant="heading" tone="accent">Quest</AppText>
          </AppText>
        ) : null}
        <AppText variant="title" accessibilityRole="header">{greeting.title}</AppText>
        <AppText tone="secondary">{greeting.subtitle}</AppText>
      </View>
      {hints}
      {desktop ? (
        <View style={styles.columns}>
          <View style={styles.mainCol}>
            {hero}
            {questSection}
            {bodyMap}
          </View>
          <View style={styles.sideCol}>
            {statTiles}
            {activity}
          </View>
        </View>
      ) : (
        <>
          {hero}
          {questSection}
          {statTiles}
          {bodyMap}
          {activity}
        </>
      )}
    </Screen>
  );
}

const QUEST_ICONS: LucideIcon[] = [Target, Dumbbell, Flame];

function QuestTile({ quest, icon: Icon, onPress }: { quest: QuestStatus; icon: LucideIcon; onPress: () => void }) {
  return (
    <Card
      variant={quest.completed ? 'highlight' : 'default'}
      onPress={onPress}
      accessibilityLabel={`Quest ${quest.title}: ${quest.progress} von ${quest.target}. Belohnung ${quest.rewardXp} XP.${quest.completed ? ' Abgeschlossen.' : ''}`}
      style={styles.questTile}>
      <View style={[styles.iconCircle, quest.completed && styles.iconDone]}>
        <Icon size={20} color={quest.completed ? colors.onAccent : colors.accent} />
      </View>
      <AppText variant="bodyStrong" numberOfLines={2} style={styles.questTitle}>{quest.title}</AppText>
      <View style={styles.heroStats}>
        <AppText variant="small" tone="secondary">Fortschritt</AppText>
        <View style={styles.flex} />
        <AppText variant="small" tone="secondary">{Math.min(quest.progress, quest.target)}/{quest.target}</AppText>
      </View>
      <ProgressBar value={quest.progress / quest.target} height={6} />
      <AppText variant="small" tone="accent" style={styles.bold}>{quest.completed ? 'Erledigt' : `+${quest.rewardXp} XP`}</AppText>
    </Card>
  );
}

function StatTile({ label, value, hint, onPress, wide }: { label: string; value: string; hint: string; onPress: () => void; wide?: boolean }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${label}: ${value} ${hint}`} style={[styles.statTile, wide && styles.statWide]}>
      <View style={styles.heroStats}>
        <AppText tone="secondary" numberOfLines={1} style={styles.flex}>{label}</AppText>
        <ChevronRight size={16} color={colors.textSecondary} />
      </View>
      <AppText variant="number">{value} <AppText variant="small" tone="secondary">{hint}</AppText></AppText>
    </Card>
  );
}

const ACTIVITY_ICONS: Record<XpEvent['source'], LucideIcon> = {
  workout: Dumbbell,
  quest: CalendarCheck,
  achievement: Trophy,
  lesson: BookOpen,
  chapter: Star,
};

function ActivityRow({ event, now }: { event: XpEvent; now: Date }) {
  const Icon = ACTIVITY_ICONS[event.source] ?? Dumbbell;
  return (
    <View style={styles.activityRow}>
      <View style={styles.iconCircleSm}><Icon size={16} color={colors.accent} /></View>
      <View style={styles.flex}>
        <AppText numberOfLines={1}>{event.label}</AppText>
        <AppText variant="small" tone="secondary">{relativeDay(event.createdAt, now)}</AppText>
      </View>
      <AppText variant="bodyStrong" tone="accent">+{event.amount}</AppText>
    </View>
  );
}

function relativeDay(iso: string, now: Date): string {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / 86_400_000);
  if (days <= 0) return 'Heute';
  if (days === 1) return 'Gestern';
  return `Vor ${days} Tagen`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} t`;
  return `${Math.round(kg).toLocaleString('de-DE')} kg`;
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  gap: { gap: spacing.md },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroWrap: { gap: spacing.lg, padding: spacing.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.card, overflow: 'hidden' },
  heroTop: { gap: spacing.sm },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sep: { width: 1, height: 16, backgroundColor: colors.borderStrong },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.25)' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flexDirection: 'column', flexWrap: 'nowrap' },
  bleed: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  questScroll: { paddingHorizontal: spacing.lg, gap: spacing.md, alignItems: 'flex-start' },
  questSlot: { width: 168, flexDirection: 'row' },
  questTile: { flex: 1, minWidth: 104, gap: spacing.sm, padding: spacing.md },
  questTitle: { minHeight: 44 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: colors.accent },
  iconCircleSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  statTile: { flex: 1, minWidth: 140, gap: spacing.xs },
  statWide: { flexBasis: '100%' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  mainCol: { flex: 2, gap: spacing.lg, minWidth: 0 },
  sideCol: { flex: 1, gap: spacing.lg, minWidth: 260 },
});
