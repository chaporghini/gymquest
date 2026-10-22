import { router } from 'expo-router';
import { Activity, ChevronRight, Clock, Dumbbell, Flame, History, TrendingUp } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Chip, EmptyState, Screen, SectionHeader, StatCard } from '@/components';
import { getExercise } from '@/data/exercises';
import { addDays, formatDate, formatDuration } from '@/domain/dates';
import { weeklyStreak } from '@/domain/progression';
import { bodyWeightSeries, exerciseSeries, monthlySeries, periodLabel, trainedExercises, weeklySeries, xpSeries, type ExerciseMetric } from '@/domain/training';
import { totalVolumeKg } from '@/domain/xp';
import { Bars, ChartCard, Line } from '@/features/ChartCard';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

type WeekMetric = 'workouts' | 'sets' | 'minutes';
const WEEK_METRICS: Record<WeekMetric, { label: string; title: string; unit: string }> = {
  workouts: { label: 'Trainings', title: 'Trainings pro Woche', unit: 'Anzahl Trainings' },
  sets: { label: 'Sätze', title: 'Arbeitssätze pro Woche', unit: 'Anzahl Sätze' },
  minutes: { label: 'Dauer', title: 'Trainingsdauer pro Woche', unit: 'Minuten' },
};
type MonthMetric = 'workouts' | 'minutes';
const MONTH_METRICS: Record<MonthMetric, { label: string; title: string; unit: string }> = {
  workouts: { label: 'Trainings', title: 'Trainings pro Monat', unit: 'Anzahl Trainings' },
  minutes: { label: 'Dauer', title: 'Trainingsdauer pro Monat', unit: 'Minuten' },
};
const EXERCISE_METRICS: Record<ExerciseMetric, { label: string; unit: string }> = {
  weight: { label: 'Gewicht', unit: 'kg (Arbeitsgewicht)' },
  reps: { label: 'Wiederholungen', unit: 'beste Wdh. pro Satz' },
  duration: { label: 'Dauer', unit: 'Sekunden (beste Haltezeit)' },
};
const WEEKS = 8;
const MONTHS = 6;
const XP_WEEKS = 12;

export default function Stats() {
  const { sessions, plan, xpEvents, profile } = useApp();
  const now = useMemo(() => new Date(), [sessions, xpEvents, profile]); // eslint-disable-line react-hooks/exhaustive-deps
  const [weekMetric, setWeekMetric] = useState<WeekMetric>('workouts');
  const [monthMetric, setMonthMetric] = useState<MonthMetric>('minutes');
  const [selected, setSelected] = useState<number | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [exerciseMetric, setExerciseMetric] = useState<ExerciseMetric | null>(null);

  const weekly = useMemo(() => weeklySeries(sessions, now, WEEKS), [sessions, now]);
  const monthly = useMemo(() => monthlySeries(sessions, now, MONTHS), [sessions, now]);
  const exercises = useMemo(() => trainedExercises(sessions), [sessions]);
  const chosen = exercises.find((e) => e.id === exerciseId) ?? exercises[0];
  const metric = chosen && exerciseMetric && chosen.metrics.includes(exerciseMetric) ? exerciseMetric : chosen?.metrics[0] ?? 'reps';
  const exercisePoints = useMemo(() => (chosen ? exerciseSeries(sessions, chosen.id, metric) : []), [sessions, chosen, metric]);
  const xp = useMemo(() => xpSeries(xpEvents, now, XP_WEEKS), [xpEvents, now]);
  const bodyWeight = useMemo(() => bodyWeightSeries(profile), [profile]);

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
  const streak = weeklyStreak(sessions, plan, now);
  const sel = selected !== null ? weekly[selected] : null;
  const weekPeriod = periodLabel(weekly[0].start, addDays(weekly[WEEKS - 1].start, 6));
  const xpLevelStart = xp[0].level;
  const xpLevelEnd = xp[xp.length - 1].level;

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

      <Card variant="highlight" onPress={() => router.push('/report')} accessibilityLabel="Dein Fortschritt: Wochen- und Monatsbericht öffnen" style={styles.reportLink}>
        <TrendingUp size={22} color={colors.accent} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Dein Fortschritt</AppText>
          <AppText variant="small" tone="secondary">Wochen- und Monatsbericht mit deinem nächsten Schritt</AppText>
        </View>
        <ChevronRight size={18} color={colors.textSecondary} />
      </Card>

      <SectionHeader title="Verlauf" />
      <ChartCard
        title={WEEK_METRICS[weekMetric].title}
        period={`Letzte ${WEEKS} Wochen (${weekPeriod})`}
        unit={WEEK_METRICS[weekMetric].unit}
        empty={sessions.length === 0 ? 'Noch keine Trainings. Nach deinem ersten Training erscheint hier der Wochenverlauf.' : null}
        summary={weekly.map((w) => `Woche ab ${w.label}: ${w[weekMetric]}`).join(', ')}
        footnote={sel ? `Woche ab ${sel.label}.: ${sel[weekMetric]} ${WEEK_METRICS[weekMetric].unit}` : 'Heller Balken: laufende Woche. Tippe auf einen Balken für den Wert.'}
        controls={
          <View style={styles.chips} accessibilityRole="radiogroup">
            {(Object.keys(WEEK_METRICS) as WeekMetric[]).map((m) => (
              <Chip key={m} role="radio" label={WEEK_METRICS[m].label} selected={weekMetric === m} onPress={() => setWeekMetric(m)} />
            ))}
          </View>
        }>
        {(width) => (
          <Bars
            width={width}
            data={weekly.map((w, i) => ({ value: w[weekMetric], label: w.label, muted: w.running, selected: selected === i, onPress: () => setSelected(i === selected ? null : i) }))}
          />
        )}
      </ChartCard>

      <ChartCard
        title={MONTH_METRICS[monthMetric].title}
        period={`Letzte ${MONTHS} Monate (${monthly[0].label} – ${monthly[MONTHS - 1].label} ${now.getFullYear()})`}
        unit={MONTH_METRICS[monthMetric].unit}
        empty={sessions.length === 0 ? 'Noch keine Trainings. Der Monatsverlauf füllt sich mit jedem Training.' : null}
        summary={monthly.map((m) => `${m.label}: ${m[monthMetric]}`).join(', ')}
        footnote={`Heller Balken: ${monthly[MONTHS - 1].label} läuft noch (bis heute).`}
        controls={
          <View style={styles.chips} accessibilityRole="radiogroup">
            {(Object.keys(MONTH_METRICS) as MonthMetric[]).map((m) => (
              <Chip key={m} role="radio" label={MONTH_METRICS[m].label} selected={monthMetric === m} onPress={() => setMonthMetric(m)} />
            ))}
          </View>
        }>
        {(width) => <Bars width={width} data={monthly.map((m) => ({ value: m[monthMetric], label: m.label, muted: m.running }))} />}
      </ChartCard>

      <ChartCard
        title={chosen ? `Übung: ${chosen.name}` : 'Übungsverlauf'}
        period={exercisePoints.length ? `${exercisePoints.length} Einheiten (${exercisePoints[0].label} – ${exercisePoints[exercisePoints.length - 1].label})` : 'Alle Einheiten'}
        unit={EXERCISE_METRICS[metric].unit}
        empty={
          !chosen
            ? 'Noch keine Übung protokolliert. Nach deinem ersten Training kannst du hier jede Übung einzeln verfolgen.'
            : exercisePoints.length < 2
              ? 'Ab zwei Einheiten dieser Übung siehst du hier einen Verlauf.'
              : null
        }
        summary={exercisePoints.map((p) => `${p.label}: ${p.value}`).join(', ')}
        footnote="Jede Übung wird nur mit sich selbst verglichen."
        controls={
          chosen ? (
            <View style={styles.gapSm}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.chips}>
                {exercises.map((e) => (
                  <Chip key={e.id} role="radio" label={e.name} selected={chosen.id === e.id} onPress={() => setExerciseId(e.id)} />
                ))}
              </ScrollView>
              {chosen.metrics.length > 1 ? (
                <View style={styles.chips} accessibilityRole="radiogroup">
                  {chosen.metrics.map((m) => (
                    <Chip key={m} role="radio" label={EXERCISE_METRICS[m].label} selected={metric === m} onPress={() => setExerciseMetric(m)} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null
        }>
        {(width) => <Line width={width} data={exercisePoints} fromZero={metric !== 'weight'} />}
      </ChartCard>

      <ChartCard
        title="XP und Level"
        period={`Letzte ${XP_WEEKS} Wochen, Stand am Wochenende`}
        unit="XP gesamt"
        empty={xpEvents.length === 0 ? 'Noch keine XP. Schließe ein Training ab, dann siehst du hier deinen Aufstieg.' : null}
        summary={xp.map((x) => `${x.label}: ${x.totalXp} XP, Level ${x.level}`).join(', ')}
        footnote={xpLevelStart === xpLevelEnd ? `Level ${xpLevelEnd} im ganzen Zeitraum.` : `Level ${xpLevelStart} → ${xpLevelEnd} in diesem Zeitraum.`}>
        {(width) => <Line width={width} data={xp.map((x) => ({ value: x.totalXp, label: x.label }))} />}
      </ChartCard>

      <ChartCard
        title="Körpergewicht"
        period={bodyWeight.length ? `${bodyWeight.length} Einträge (${bodyWeight[0].label} – ${bodyWeight[bodyWeight.length - 1].label})` : 'Alle Einträge'}
        unit="kg"
        empty={
          bodyWeight.length === 0
            ? 'Optional: Trag dein Gewicht unter Profil → Profil bearbeiten ein. Jede Änderung erscheint hier mit Datum.'
            : bodyWeight.length < 2
              ? `Bisher ein Eintrag (${bodyWeight[0].value.toLocaleString('de-DE')} kg am ${bodyWeight[0].label}). Ab zwei Einträgen siehst du einen Verlauf.`
              : null
        }
        summary={bodyWeight.map((p) => `${p.label}: ${p.value} kg`).join(', ')}
        footnote="Nur deine Einträge, ohne Bewertung.">
        {(width) => <Line width={width} data={bodyWeight} fromZero={false} />}
      </ChartCard>

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
  noGrow: { flexGrow: 0 },
  gapSm: { gap: spacing.sm },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: '700' },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
