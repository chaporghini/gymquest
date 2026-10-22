import { router } from 'expo-router';
import { Award, Crown, PartyPopper, Target } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, LevelBadge, Screen, XPBar } from '@/components';
import { formatDuration } from '@/domain/dates';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function WorkoutSummary() {
  const { lastReward } = useApp();
  const [scale] = useState(() => new Animated.Value(0.6));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const close = () => router.replace('/');

  if (!lastReward) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState icon={Target} title="Keine Auswertung" message="Es gibt keine Auswertung zum Anzeigen." actionLabel="Zur Startseite" onAction={close} />
      </Screen>
    );
  }

  const { session, breakdown, rewards, levelBefore, levelAfter, rankBefore, rankAfter } = lastReward;
  const leveledUp = levelAfter.level > levelBefore;
  const rankUp = rankAfter.id !== rankBefore.id;
  const totalGained = breakdown.total + rewards.reduce((n, r) => n + r.amount, 0);

  return (
    <Screen edges={['top', 'bottom']} footer={<Button label="Weiter" size="lg" fullWidth onPress={close} />}>
      <Animated.View style={[styles.hero, { opacity, transform: [{ scale }] }]} accessibilityLiveRegion="polite">
        {leveledUp ? (
          <>
            <View style={styles.glow}><LevelBadge level={levelAfter.level} size="lg" /></View>
            <AppText variant="caption" tone="accent">LEVEL-UP!</AppText>
            <AppText variant="display" align="center">Level {levelAfter.level}</AppText>
          </>
        ) : (
          <>
            <View style={styles.iconCircle}><PartyPopper size={34} color={colors.onAccent} /></View>
            <AppText variant="display" align="center">Training geschafft!</AppText>
          </>
        )}
        <AppText variant="number" tone="accent">+{totalGained} XP</AppText>
      </Animated.View>

      {rankUp ? (
        <Card variant="highlight" style={styles.row}>
          <Crown size={22} color={colors.accent} />
          <View style={styles.flex}>
            <AppText variant="caption" tone="accent">NEUER RANG</AppText>
            <AppText variant="heading">{rankAfter.name}</AppText>
            <AppText variant="small" tone="secondary">{rankAfter.description}</AppText>
          </View>
        </Card>
      ) : null}

      <Card style={styles.gap}>
        <AppText variant="heading">{session.name}</AppText>
        <AppText tone="secondary">{formatDuration(session.durationSec)} · {breakdown.completedSets} Sätze</AppText>
        <View style={styles.breakdown}>
          <Line label="Training abgeschlossen" value={breakdown.base} />
          <Line label={`Sätze (${Math.min(breakdown.completedSets, 30)} × 4)`} value={breakdown.sets} />
          {breakdown.completion > 0 ? <Line label="Alle Sätze erledigt" value={breakdown.completion} /> : null}
          {breakdown.sameDayPenalty < 0 ? <Line label="Weiteres Training heute (Erholung zählt!)" value={breakdown.sameDayPenalty} /> : null}
        </View>
      </Card>

      {rewards.length > 0 ? (
        <Card style={styles.gap}>
          <AppText variant="heading">Belohnungen</AppText>
          {rewards.map((r) => (
            <View key={r.id} style={styles.row}>
              {r.source === 'quest' ? <Target size={18} color={colors.accent} /> : <Award size={18} color={colors.accent} />}
              <AppText style={styles.flex}>{r.label}</AppText>
              {r.amount > 0 ? <AppText variant="bodyStrong" tone="accent">+{r.amount}</AppText> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.gap}>
        <AppText variant="small" tone="secondary">Fortschritt zu Level {levelAfter.level + 1}</AppText>
        <XPBar progress={levelAfter} />
      </Card>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.row}>
      <AppText tone="secondary" style={styles.flex}>{label}</AppText>
      <AppText variant="bodyStrong" tone={value < 0 ? 'warning' : 'primary'}>{value > 0 ? `+${value}` : value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  glow: { padding: spacing.md, borderRadius: radius.xl + 8, backgroundColor: colors.accentMuted },
  iconCircle: { width: 76, height: 76, borderRadius: radius.xl, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  gap: { gap: spacing.md },
  breakdown: { gap: spacing.sm },
});
