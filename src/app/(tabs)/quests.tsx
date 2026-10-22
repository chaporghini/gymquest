import { Crown, Lock } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AchievementCard, AppText, Card, QuestCard, Screen, SectionHeader } from '@/components';
import { addDays, startOfWeek } from '@/domain/dates';
import { computeAchievements, computeWeeklyQuests } from '@/domain/progression';
import { RANKS } from '@/domain/ranks';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function Quests() {
  const { sessions, xpEvents, plan, level, rank } = useApp();
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
        {quests.map((q) => <QuestCard key={q.id} quest={q} />)}
      </View>

      <SectionHeader title="Ränge" />
      <Card padded={false} style={styles.ranks}>
        {RANKS.map((r, i) => {
          const reached = level.level >= r.minLevel;
          const isCurrent = r.id === rank.id;
          return (
            <View
              key={r.id}
              style={[styles.rankRow, i > 0 && styles.divider, isCurrent && styles.currentRank]}
              accessible
              accessibilityLabel={`Rang ${r.name}, ab Level ${r.minLevel}. ${isCurrent ? 'Aktueller Rang.' : reached ? 'Freigeschaltet.' : 'Noch gesperrt.'}`}>
              <View style={[styles.rankIcon, reached && styles.rankIconReached]}>
                {reached ? <Crown size={18} color={colors.onAccent} /> : <Lock size={16} color={colors.textSecondary} />}
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" tone={reached ? 'primary' : 'secondary'}>{r.name}</AppText>
                <AppText variant="small" tone="secondary">{r.description}</AppText>
              </View>
              <AppText variant="small" tone={isCurrent ? 'accent' : 'secondary'} style={styles.bold}>
                {isCurrent ? 'AKTUELL' : `Lvl ${r.minLevel}`}
              </AppText>
            </View>
          );
        })}
      </Card>

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
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: '700' },
  ranks: { overflow: 'hidden' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  currentRank: { backgroundColor: 'rgba(199,255,85,0.06)' },
  rankIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  rankIconReached: { backgroundColor: colors.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
