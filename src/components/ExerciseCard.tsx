import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { Exercise, PlannedExercise } from '@/domain/types';
import { categoryLabels, difficultyLabels, muscleLabels } from '@/i18n/labels';
import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';

export function prescriptionText(p: PlannedExercise): string {
  if (p.durationSec) return `${p.sets} × ${p.durationSec} s`;
  return p.repsMin === p.repsMax ? `${p.sets} × ${p.repsMax}` : `${p.sets} × ${p.repsMin}–${p.repsMax}`;
}

export interface ExerciseCardProps {
  exercise: Exercise;
  planned?: PlannedExercise;
  onPress?: () => void;
  index?: number;
}

export function ExerciseCard({ exercise, planned, onPress, index }: ExerciseCardProps) {
  const meta = [muscleLabels[exercise.muscleGroup], categoryLabels[exercise.category], difficultyLabels[exercise.difficulty]].join(' · ');
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${exercise.name}, ${meta}${planned ? `, ${prescriptionText(planned)}` : ''}`}
      accessibilityHint={onPress ? 'Öffnet die Übungsanleitung' : undefined}
      style={styles.card}>
      {index !== undefined ? (
        <View style={styles.index}>
          <AppText variant="small" tone="secondary" style={styles.indexText}>{index + 1}</AppText>
        </View>
      ) : null}
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>{exercise.name}</AppText>
        <AppText variant="small" tone="secondary" numberOfLines={1}>{meta}</AppText>
      </View>
      {planned ? <AppText variant="bodyStrong" tone="accent">{prescriptionText(planned)}</AppText> : null}
      {onPress ? <ChevronRight size={18} color={colors.textSecondary} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  index: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  indexText: { fontWeight: '700' },
  body: { flex: 1, gap: 2 },
});
