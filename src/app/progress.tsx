import { Award, BookOpen, Dumbbell, Map, Target } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, LevelBadge, RankList, Screen, SectionHeader, XPBar } from '@/components';
import { formatDate } from '@/domain/dates';
import { getNextRank } from '@/domain/ranks';
import type { XpSource } from '@/domain/types';
import { totalXpForLevel, xpToNextLevel, XP_REWARDS, XP_RULES } from '@/domain/xp';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

const SOURCE_ICON: Record<XpSource, typeof Award> = { workout: Dumbbell, quest: Target, achievement: Award, lesson: BookOpen, chapter: Map };

export default function ProgressScreen() {
  const { level, rank, xpEvents } = useApp();
  const nextRank = getNextRank(level.level);
  const recent = xpEvents.slice(0, 20);
  const upcoming = Array.from({ length: 5 }, (_, i) => level.level + i).filter((l) => l < 100);

  return (
    <Screen edges={['bottom']}>
      <Card style={styles.hero}>
        <View style={styles.row}>
          <LevelBadge level={level.level} size="lg" />
          <View style={styles.flex}>
            <AppText variant="caption" tone="accent">RANG</AppText>
            <AppText variant="title">{rank.name}</AppText>
            <AppText variant="small" tone="secondary">{level.totalXp.toLocaleString('de-DE')} XP gesamt</AppText>
          </View>
        </View>
        <XPBar progress={level} />
        <View style={styles.facts}>
          <Fact label="XP in diesem Level" value={`${level.xpIntoLevel}`} />
          <Fact label="Level umfasst" value={`${level.xpForLevel} XP`} />
          <Fact label="Noch bis Level-up" value={`${level.xpRemaining} XP`} />
        </View>
        {nextRank ? (
          <AppText variant="small" tone="secondary">
            Nächster Rang „{nextRank.name}“ ab Level {nextRank.minLevel} – noch {(totalXpForLevel(nextRank.minLevel) - level.totalXp).toLocaleString('de-DE')} XP.
          </AppText>
        ) : null}
      </Card>

      <SectionHeader title="Zuletzt erhaltene XP" />
      {recent.length === 0 ? (
        <Card variant="secondary">
          <AppText tone="secondary">Noch keine XP. Schließe ein Training ab – XP gibt es nur für echtes Training, Quests und Achievements, nicht fürs Öffnen der App.</AppText>
        </Card>
      ) : (
        <Card padded={false}>
          {recent.map((e, i) => {
            const Icon = SOURCE_ICON[e.source];
            return (
              <View key={e.id} style={[styles.event, i > 0 && styles.divider]} accessible accessibilityLabel={`${e.label}, ${formatDate(e.createdAt)}, ${e.amount} XP`}>
                <View style={styles.icon}><Icon size={16} color={colors.accent} /></View>
                <View style={styles.flex}>
                  <AppText numberOfLines={1}>{e.label}</AppText>
                  <AppText variant="small" tone="secondary">{formatDate(e.createdAt)}</AppText>
                </View>
                <AppText variant="bodyStrong" tone={e.amount > 0 ? 'accent' : 'secondary'}>{e.amount > 0 ? `+${e.amount}` : '–'}</AppText>
              </View>
            );
          })}
        </Card>
      )}

      <SectionHeader title="So funktioniert die XP-Kurve" />
      <Card style={styles.gap}>
        <AppText tone="secondary">
          Trainingseinheit: {XP_REWARDS.workout} XP (ab {XP_RULES.minSetsForWorkout} Sätzen) + {XP_REWARDS.exercise} XP je Übung, bei der alle geplanten Sätze erledigt sind (max. {XP_RULES.maxCountedExercises}). Ab dem zweiten Training am selben Tag gibt es {Math.round(XP_RULES.repeatSameDayFactor * 100)} %, Erholung zählt.
        </AppText>
        <AppText tone="secondary">
          Wochenziel {XP_REWARDS.weeklyGoal} XP · Techniklektion {XP_REWARDS.lesson} XP · Meilenstein {XP_REWARDS.milestone} XP · Quest-Kapitel {XP_REWARDS.chapter} XP. Jede Belohnung gibt es nur einmal.
        </AppText>
        <AppText tone="secondary">Schwelle für Level L: 100 × (L − 1) + 25 × (L − 1)² XP.</AppText>
        {upcoming.map((l) => (
          <View key={l} style={styles.curveRow}>
            <AppText style={styles.flex} tone={l === level.level ? 'accent' : 'primary'}>Level {l} → {l + 1}</AppText>
            <AppText variant="bodyStrong">{xpToNextLevel(l)} XP</AppText>
          </View>
        ))}
      </Card>

      <SectionHeader title="Ränge" />
      <RankList level={level.level} />
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption" tone="secondary">{label.toUpperCase()}</AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fact: { flexGrow: 1, flexBasis: 90, gap: 2 },
  gap: { gap: spacing.sm },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  icon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  curveRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
});
