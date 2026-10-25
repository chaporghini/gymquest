import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Chip } from '@/components';
import { hasAnySets, loadFromSets, MAP_MODE_LABELS, muscleSetsFor, type MapMode } from '@/domain/muscleStats';
import { MUSCLE_LABELS, MUSCLES, type Muscle } from '@/domain/muscles';
import type { TrainingPlan, WorkoutSession } from '@/domain/types';
import { useToday } from '@/state/useToday';
import { spacing } from '@/theme/tokens';

import { BodyMap } from './BodyMap';

const EMPTY_TEXT: Record<MapMode, string> = {
  planned: 'Noch kein Trainingsplan. Sobald du einen Plan erstellst, siehst du hier, welche Muskeln er trainiert.',
  done: 'In den letzten vier Wochen wurde noch kein Training gespeichert.',
  week: 'Diese Woche wurde noch kein Training gespeichert.',
};

/**
 * Körperkarte mit Umschaltung Geplant / Absolviert / Diese Woche. Muskeln sind antippbar und öffnen die
 * Detailansicht. Die Farben zeigen erfasste Planung bzw. Trainingshistorie, keine gemessene Muskelaktivität.
 */
export function MuscleMapCard({ plan, sessions, size = 200, initialMode = 'planned' }: { plan: TrainingPlan | null; sessions: WorkoutSession[]; size?: number; initialMode?: MapMode }) {
  const [mode, setMode] = useState<MapMode>(initialMode);
  const now = useToday();
  const sets = useMemo(() => muscleSetsFor(mode, plan, sessions, now), [mode, plan, sessions, now]);
  const empty = !hasAnySets(sets);
  const top = MUSCLES.filter((m) => sets[m].direct > 0).sort((a, b) => sets[b].direct - sets[a].direct);
  const open = (m: Muscle) => router.push({ pathname: '/muscle/[id]', params: { id: m } });
  const unit = mode === 'planned' ? 'Sätze/Woche' : 'Sätze';

  return (
    <Card style={styles.card}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {(Object.keys(MAP_MODE_LABELS) as MapMode[]).map((m) => (
          <Chip key={m} role="radio" label={MAP_MODE_LABELS[m]} selected={mode === m} onPress={() => setMode(m)} />
        ))}
      </View>
      <BodyMap load={loadFromSets(sets)} size={size} neutral={empty} onSelect={open} />
      {empty ? (
        <AppText variant="small" tone="secondary" align="center">{EMPTY_TEXT[mode]}</AppText>
      ) : (
        <>
          <AppText variant="small" tone="secondary" align="center">Tippe auf einen Muskel für Details. Direkte {unit}:</AppText>
          <View style={styles.list}>
            {top.map((m) => (
              <Chip key={m} label={`${MUSCLE_LABELS[m]} · ${sets[m].direct}`} onPress={() => open(m)} accessibilityHint="Öffnet die Details zu diesem Muskel" />
            ))}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
});
