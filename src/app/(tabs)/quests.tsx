import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AchievementCard, AppText, QuestCard, RankList, Screen, SectionHeader } from '@/components';
import { addDays, startOfWeek } from '@/domain/dates';
import { computeAchievements, computeChapters, computeWeeklyQuests } from '@/domain/progression';
import { ChapterCard } from '@/features/ChapterCard';
import { useApp } from '@/state/AppProvider';
import { spacing } from '@/theme/tokens';

export default function Quests() {
  const { sessions, xpEvents, plan, level, profile } = useApp();
  const now = new Date();
  const input = useMemo(() => ({ sessions, xpEvents, plan, now: new Date(), experience: profile?.experience, startedAt: profile?.createdAt }), [sessions, xpEvents, plan, profile]);
  const quests = useMemo(() => computeWeeklyQuests(input), [input]);
  const chapters = useMemo(() => computeChapters(input), [input]);
  const achievements = useMemo(() => computeAchievements(input), [input]);
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const daysLeft = Math.ceil((addDays(startOfWeek(now), 7).getTime() - now.getTime()) / 86400000);
  const completed = quests.filter((q) => q.completed).length;

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">Quests</AppText>
        <AppText tone="secondary">Alle Quests zählen nur gespeicherte Trainings und Lektionen. XP gibt es automatisch und nur einmal.</AppText>
      </View>

      <SectionHeader title="Quest-Kapitel" />
      <View style={styles.gap}>
        {chapters.map((c) => <ChapterCard key={c.id} chapter={c} />)}
      </View>

      <SectionHeader title={`Wochenquests · ${completed}/${quests.length}`} />
      {quests.length ? (
        <>
          <AppText variant="small" tone="secondary" style={styles.sub}>Noch {daysLeft} {daysLeft === 1 ? 'Tag' : 'Tage'} in dieser Woche, angepasst an deine Erfahrung</AppText>
          <View style={styles.gap}>
            {quests.map((q) => (
              <QuestCard key={q.id} quest={q} onPress={() => router.push({ pathname: '/quest/[id]', params: { id: q.id } })} />
            ))}
          </View>
        </>
      ) : (
        <AppText tone="secondary">Wochenquests gibt es, sobald du einen Trainingsplan hast. Das Wochenziel richtet sich nach deinem Plan.</AppText>
      )}

      <SectionHeader title="Ränge" actionLabel="XP-Verlauf" onAction={() => router.push('/progress')} />
      <RankList level={level.level} />

      <SectionHeader title={`Erfolge · ${unlocked}/${achievements.length}`} />
      <View style={styles.grid}>
        {achievements.map((a) => <AchievementCard key={a.id} achievement={a} />)}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  sub: { marginTop: -spacing.sm },
  gap: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
