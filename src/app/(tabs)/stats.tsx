import { router } from 'expo-router';
import { Activity, ChevronRight, Clock, Dumbbell, Flame, History } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { AppText, Card, Chip, EmptyState, Screen, SectionHeader, StatCard } from '@/components';
import { getExercise } from '@/data/exercises';
import { addDays, formatDate, formatDuration, startOfWeek } from '@/domain/dates';
import { sessionsInWeek, weeklyStreak } from '@/domain/progression';
import { totalVolumeKg } from '@/domain/xp';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

type Metric = 'workouts' | 'sets' | 'minutes';
const METRIC_LABELS: Record<Metric, string> = { workouts: 'Trainings', sets: 'Sätze', minutes: 'Minuten' };
const WEEKS = 8;

export default function Stats() {
  const { sessions, plan } = useApp();
  const [metric, setMetric] = useState<Metric>('sets');
  const [chartWidth, setChartWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const weekly = useMemo(() => {
    const thisWeek = startOfWeek(new Date());
    return Array.from({ length: WEEKS }, (_, i) => {
      const start = addDays(thisWeek, -7 * (WEEKS - 1 - i));
      const list = sessionsInWeek(sessions, start);
      return {
        start,
        workouts: list.length,
        sets: list.reduce((n, s) => n + s.sets.length, 0),
        minutes: Math.round(list.reduce((n, s) => n + s.durationSec, 0) / 60),
      };
    });
  }, [sessions]);

  const records = useMemo(() => {
    const best = new Map<string, { weight: number; reps: number }>();
    for (const s of sessions) {
      for (const set of s.sets) {
        if (!set.weightKg || !set.reps) continue;
        const cur = best.get(set.exerciseId);
        if (!cur || set.weightKg > cur.weight || (set.weightKg === cur.weight && set.reps > cur.reps)) {
          best.set(set.exerciseId, { weight: set.weightKg, reps: set.reps });
        }
      }
    }
    return [...best.entries()].sort((a, b) => b[1].weight - a[1].weight).slice(0, 5);
  }, [sessions]);

  const totalSets = sessions.reduce((n, s) => n + s.sets.length, 0);
  const totalTime = sessions.reduce((n, s) => n + s.durationSec, 0);
  const streak = weeklyStreak(sessions, plan, new Date());

  const data = weekly.map((w, i) => ({
    value: w[metric],
    label: `${String(w.start.getDate()).padStart(2, '0')}.${String(w.start.getMonth() + 1).padStart(2, '0')}`,
    frontColor: selected === i ? colors.text : colors.accent,
    onPress: () => setSelected(i === selected ? null : i),
  }));
  const maxValue = Math.max(4, ...weekly.map((w) => w[metric]));
  const sel = selected !== null ? weekly[selected] : null;

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">Statistiken</AppText>

      <View style={styles.grid}>
        <StatCard label="Trainings" value={String(sessions.length)} icon={Dumbbell} />
        <StatCard label="Sätze" value={totalSets.toLocaleString('de-DE')} icon={Activity} />
        <StatCard label="Trainingszeit" value={formatDuration(totalTime)} icon={Clock} />
        <StatCard label="Wochen-Serie" value={`${streak}`} hint={streak === 1 ? 'Woche in Folge' : 'Wochen in Folge'} icon={Flame} />
      </View>
      <StatCard label="Bewegtes Gewicht" value={`${totalVolumeKg(sessions).toLocaleString('de-DE')} kg`} hint="Summe aus Gewicht × Wiederholungen" />

      <SectionHeader title="Verlauf der letzten 8 Wochen" />
      <View style={styles.chips} accessibilityRole="radiogroup">
        {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
          <Chip key={m} role="radio" label={METRIC_LABELS[m]} selected={metric === m} onPress={() => setMetric(m)} />
        ))}
      </View>
      <Card style={styles.chartCard}>
        <AppText variant="small" tone="secondary" accessibilityLiveRegion="polite">
          {sel
            ? `Woche ab ${String(sel.start.getDate()).padStart(2, '0')}.${String(sel.start.getMonth() + 1).padStart(2, '0')}.: ${sel[metric]} ${METRIC_LABELS[metric]}`
            : `${METRIC_LABELS[metric]} pro Woche – tippe auf einen Balken für Details.`}
        </AppText>
        <View
          onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityLabel={`Balkendiagramm ${METRIC_LABELS[metric]} pro Woche: ${weekly.map((w) => w[metric]).join(', ')}`}>
          {chartWidth > 0 ? (
            <BarChart
              data={data}
              width={chartWidth - 40}
              height={160}
              barWidth={Math.max(12, (chartWidth - 40) / WEEKS - 14)}
              spacing={12}
              initialSpacing={8}
              endSpacing={4}
              maxValue={maxValue}
              noOfSections={4}
              barBorderRadius={4}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={colors.border}
              rulesColor={colors.border}
              rulesType="solid"
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 11 }}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              yAxisLabelWidth={32}
              disableScroll
              isAnimated
            />
          ) : null}
        </View>
      </Card>

      {records.length > 0 ? (
        <>
          <SectionHeader title="Bestleistungen" />
          <Card padded={false}>
            {records.map(([id, r], i) => (
              <View key={id} style={[styles.recordRow, i > 0 && styles.divider]}>
                <AppText style={styles.flex} numberOfLines={1}>{getExercise(id)?.name ?? id}</AppText>
                <AppText variant="bodyStrong" tone="accent">{r.weight.toLocaleString('de-DE')} kg × {r.reps}</AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Trainingshistorie" />
      {sessions.length === 0 ? (
        <EmptyState icon={History} title="Noch keine Trainings" message="Sobald du ein Training abschließt, erscheint es hier." />
      ) : (
        <Card padded={false}>
          {sessions.slice(0, 30).map((s, i) => (
            <Card
              key={s.id}
              padded={false}
              onPress={() => router.push({ pathname: '/history/[id]', params: { id: s.id } })}
              accessibilityLabel={`${s.name} am ${formatDate(s.finishedAt)}, ${s.sets.length} Sätze, ${s.xpEarned} XP`}
              style={[styles.historyRow, i > 0 && styles.divider]}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{s.name}</AppText>
                <AppText variant="small" tone="secondary">
                  {formatDate(s.finishedAt)} · {formatDuration(s.durationSec)} · {s.sets.length} Sätze
                </AppText>
              </View>
              <AppText variant="small" tone="accent" style={styles.bold}>+{s.xpEarned} XP</AppText>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Card>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chartCard: { gap: spacing.md, overflow: 'hidden' },
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: '700' },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
