import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AchievementCard, AppText, QuestCard, RankList, Screen, SectionHeader } from '@/components';
import { addDays, startOfWeek } from '@/domain/dates';
import { computeAchievements, computeWeeklyQuests } from '@/domain/progression';
import { useApp } from '@/state/AppProvider';
import { spacing } from '@/theme/tokens';

export default function Quests() {
  const { sessions, xpEvents, plan, level } = useApp();
  const now = new Date();
  const quests = useMemo(() => computeWeeklyQuests({ sessions, xpEvents, plan, now: new Date() }), [sessions, xpEvents, plan]);
  const achievements = useMemo(() => computeAchievements({ sessions, xpEvents, plan, now: new Date() }), [sessions, xpEvents, plan]);
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const daysLeft = Math.ceil((addDays(startOfWeek(now), 7).getTime() - now.getTime()) / 86400000);
  const completed = quests.filter((q) => q.completed).length;

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">Quests</AppText>
        <AppText tone="secondary">Wochenquests werden jeden Montag erneuert. XP gibt es automatisch beim Abschluss.</AppText>
      </View>

      <SectionHeader title={`Wochenquests · ${completed}/${quests.length}`} />
      <AppText variant="small" tone="secondary" style={styles.sub}>Noch {daysLeft} {daysLeft === 1 ? 'Tag' : 'Tage'} in dieser Woche</AppText>
      <View style={styles.gap}>
        {quests.map((q) => (
          <QuestCard key={q.id} quest={q} onPress={() => router.push({ pathname: '/quest/[id]', params: { id: q.id } })} />
        ))}
      </View>

      <SectionHeader title="Ränge" actionLabel="XP-Verlauf" onAction={() => router.push('/progress')} />
      <RankList level={level.level} />

      <SectionHeader title={`Achievements · ${unlocked}/${achievements.length}`} />
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
