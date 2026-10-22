import { useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, Screen, StatCard } from '@/components';
import { getExercise } from '@/data/exercises';
import { formatDate, formatDuration } from '@/domain/dates';
import type { SetLog } from '@/domain/types';
import { totalVolumeKg } from '@/domain/xp';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

export default function HistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useApp().sessions.find((s) => s.id === id);

  if (!session) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} title="Training nicht gefunden" message="Dieses Training ist nicht (mehr) gespeichert." />
      </Screen>
    );
  }

  const grouped: [string, SetLog[]][] = [];
  for (const set of session.sets) {
    const last = grouped[grouped.length - 1];
    if (last && last[0] === set.exerciseId) last[1].push(set);
    else grouped.push([set.exerciseId, [set]]);
  }

  return (
    <Screen edges={['bottom']}>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">{session.name}</AppText>
        <AppText tone="secondary">{formatDate(session.finishedAt)}</AppText>
      </View>
      <View style={styles.grid}>
        <StatCard label="Dauer" value={formatDuration(session.durationSec)} />
        <StatCard label="XP" value={`+${session.xpEarned}`} />
        <StatCard label="Sätze" value={String(session.sets.length)} />
        <StatCard label="Volumen" value={`${totalVolumeKg([session]).toLocaleString('de-DE')} kg`} />
      </View>
      {grouped.map(([exerciseId, sets], i) => (
        <Card key={`${exerciseId}-${i}`} style={styles.gap}>
          <AppText variant="bodyStrong">{getExercise(exerciseId)?.name ?? exerciseId}</AppText>
          {sets.map((s, j) => (
            <View key={j} style={[styles.row, j > 0 && styles.divider]}>
              <AppText tone="secondary" style={styles.setNo}>Satz {j + 1}</AppText>
              <AppText>
                {s.durationSec ? `${s.durationSec} s` : `${s.reps ?? 0} Wdh.`}
                {s.weightKg ? ` × ${s.weightKg.toLocaleString('de-DE')} kg` : ''}
              </AppText>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  setNo: { width: 70 },
});
