import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronRight, SearchX } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, Screen, SectionHeader } from '@/components';
import { EXERCISES, getExercise } from '@/data/exercises';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/domain/dates';
import { muscleDetail } from '@/domain/muscleStats';
import { MUSCLE_LABELS, MUSCLES, musclesOf, planMuscleLoad, type Muscle } from '@/domain/muscles';
import { isExerciseAllowed } from '@/domain/planGenerator';
import { BodyMap, LEVEL_COLORS } from '@/features/BodyMap';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

/** Detailansicht einer Muskelgruppe: Übungen im Plan, geplante und absolvierte direkte Sätze, Verlauf. */
export default function MuscleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plan, sessions, profile } = useApp();
  const muscle = MUSCLES.includes(id as Muscle) ? (id as Muscle) : null;
  const detail = useMemo(() => (muscle ? muscleDetail(muscle, plan, sessions, new Date()) : null), [muscle, plan, sessions]);
  const load = useMemo(() => planMuscleLoad(plan), [plan]);

  if (!muscle || !detail) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} title="Muskel nicht gefunden" message="Diese Muskelgruppe gibt es nicht." />
      </Screen>
    );
  }

  const name = MUSCLE_LABELS[muscle];
  const maxHistory = Math.max(1, ...detail.history.map((h) => h.direct + h.indirect));
  const ideas = detail.exercises.length === 0 && profile
    ? EXERCISES.filter((e) => musclesOf(e.id).primary.includes(muscle) && isExerciseAllowed(e, profile)).slice(0, 3)
    : [];
  const openExercise = (exerciseId: string) => router.push({ pathname: '/library/[id]', params: { id: exerciseId } });

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: name }} />
      <AppText variant="title" accessibilityRole="header">{name}</AppText>

      <Card style={styles.gap}>
        <BodyMap load={load} size={170} selected={muscle} neutral={!plan} showLegend={!!plan} />
        <View style={styles.facts}>
          <Fact label="Geplant pro Woche" value={plan ? `${detail.planned.direct}` : '–'} hint={plan ? `direkte Sätze${detail.planned.indirect ? ` · ${detail.planned.indirect} indirekt` : ''}` : 'kein Plan'} />
          <Fact label="Diese Woche absolviert" value={`${detail.thisWeek.direct}`} hint={`direkte Sätze${detail.thisWeek.indirect ? ` · ${detail.thisWeek.indirect} indirekt` : ''}`} />
        </View>
        <AppText variant="small" tone="secondary">
          Direkt zählt ein Satz, wenn {name} Hauptmuskel der Übung ist. Indirekte Beteiligung wird getrennt gezählt. Die Werte beschreiben Planung und Training, keine gemessene Muskelaktivität.
        </AppText>
      </Card>

      <SectionHeader title="Übungen im Plan" />
      {!plan ? (
        <AppText tone="secondary">Noch kein Trainingsplan gespeichert.</AppText>
      ) : detail.exercises.length === 0 ? (
        <Card variant="secondary" style={styles.gap}>
          <AppText>In deinem Plan beansprucht keine Übung {name}.</AppText>
          {ideas.length ? <AppText variant="small" tone="secondary">Passend zu deiner Ausstattung:</AppText> : null}
          {ideas.map((e) => (
            <Pressable key={e.id} onPress={() => openExercise(e.id)} accessibilityRole="button" style={styles.row}>
              <AppText style={styles.flex}>{e.name}</AppText>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
        </Card>
      ) : (
        <Card padded={false}>
          {detail.exercises.map((e, i) => (
            <Pressable
              key={e.exerciseId}
              onPress={() => openExercise(e.exerciseId)}
              accessibilityRole="button"
              accessibilityLabel={`${getExercise(e.exerciseId)?.name}, ${e.role === 'primary' ? 'direkt' : 'indirekt'}, ${e.sets} Sätze pro Woche`}
              style={[styles.exRow, i > 0 && styles.divider]}>
              <View style={[styles.dot, { backgroundColor: LEVEL_COLORS[e.role] }]} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{getExercise(e.exerciseId)?.name ?? e.exerciseId}</AppText>
                <AppText variant="small" tone="secondary">
                  {e.role === 'primary' ? 'Direkt' : 'Indirekt'} · {e.sets} {e.role === 'primary' ? 'direkte' : ''} Sätze/Woche · {e.weekdays.map((w) => WEEKDAYS_SHORT[w]).join(', ')}
                </AppText>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
        </Card>
      )}
      {detail.weekdays.length ? (
        <AppText variant="small" tone="secondary">Trainingstage: {detail.weekdays.map((w) => WEEKDAYS_LONG[w]).join(', ')}</AppText>
      ) : null}

      <SectionHeader title="Verlauf (6 Wochen)" />
      <Card style={styles.gap}>
        {detail.history.every((h) => h.direct + h.indirect === 0) ? (
          <AppText tone="secondary">In den letzten sechs Wochen wurden keine Sätze für {name} gespeichert.</AppText>
        ) : (
          <View style={styles.chart} accessible accessibilityLabel={`Direkte Sätze pro Woche: ${detail.history.map((h) => h.direct).join(', ')}`}>
            {detail.history.map((h) => (
              <View key={h.weekStart.toISOString()} style={styles.barCol}>
                <AppText variant="caption" tone="secondary">{h.direct}</AppText>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${(h.indirect / maxHistory) * 100}%`, backgroundColor: LEVEL_COLORS.secondary }]} />
                  <View style={[styles.bar, { height: `${(h.direct / maxHistory) * 100}%`, backgroundColor: LEVEL_COLORS.primary }]} />
                </View>
                <AppText variant="caption" tone="secondary">{`${String(h.weekStart.getDate()).padStart(2, '0')}.${String(h.weekStart.getMonth() + 1).padStart(2, '0')}.`}</AppText>
              </View>
            ))}
          </View>
        )}
        <AppText variant="small" tone="secondary">Rot: direkte Sätze, gelb: indirekte Beteiligung. Gezählt werden abgehakte Sätze.</AppText>
      </Card>
    </Screen>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption" tone="secondary">{label.toUpperCase()}</AppText>
      <AppText variant="number">{value}</AppText>
      <AppText variant="small" tone="secondary">{hint}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  facts: { flexDirection: 'row', gap: spacing.md },
  fact: { flex: 1, gap: 2 },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: MIN_TOUCH },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 140 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end', backgroundColor: colors.cardSecondary, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { width: '100%' },
});
