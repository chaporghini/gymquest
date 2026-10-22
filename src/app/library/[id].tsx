import { Stack, useLocalSearchParams } from 'expo-router';
import { SearchX, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, Screen } from '@/components';
import { getExercise } from '@/data/exercises';
import { categoryLabels, difficultyLabels, equipmentLabels, limitationLabels, muscleLabels } from '@/i18n/labels';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useApp();
  const exercise = getExercise(id);

  if (!exercise) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} title="Übung nicht gefunden" message="Diese Übung gibt es nicht in der Bibliothek." />
      </Screen>
    );
  }

  const conflicts = exercise.stresses.filter((s) => profile?.limitations.includes(s));

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: exercise.name }} />
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">{exercise.name}</AppText>
        <AppText tone="secondary">{exercise.description}</AppText>
      </View>
      <View style={styles.tags}>
        {[muscleLabels[exercise.muscleGroup], categoryLabels[exercise.category], difficultyLabels[exercise.difficulty], exercise.measurement === 'time' ? 'Zeitbasiert' : 'Wiederholungen'].map((t) => (
          <View key={t} style={styles.tag}><AppText variant="small">{t}</AppText></View>
        ))}
      </View>

      {conflicts.length > 0 ? (
        <Card variant="secondary" style={styles.warn}>
          <TriangleAlert size={20} color={colors.warning} />
          <AppText style={styles.flex}>
            Diese Übung belastet {conflicts.map((c) => limitationLabels[c]).join(' und ')} – laut deinem Profil solltest du hier vorsichtig sein.
          </AppText>
        </Card>
      ) : null}

      <Card style={styles.gap}>
        <AppText variant="heading">So geht’s</AppText>
        {exercise.steps.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNo}><AppText variant="small" tone="onAccent" style={styles.bold}>{i + 1}</AppText></View>
            <AppText style={styles.flex}>{s}</AppText>
          </View>
        ))}
      </Card>

      <Card style={styles.gap}>
        <AppText variant="heading">Tipps</AppText>
        {exercise.tips.map((t, i) => <AppText key={i} tone="secondary">• {t}</AppText>)}
      </Card>

      <Card style={styles.gap}>
        <Info label="Equipment" value={exercise.equipment.map((e) => equipmentLabels[e]).join(', ')} />
        {exercise.secondaryMuscles.length > 0 ? <Info label="Nebenbei trainiert" value={exercise.secondaryMuscles.map((m) => muscleLabels[m]).join(', ')} /> : null}
        {exercise.stresses.length > 0 ? <Info label="Belastet besonders" value={exercise.stresses.map((s) => limitationLabels[s]).join(', ')} /> : null}
      </Card>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <AppText variant="small" tone="secondary" style={styles.infoLabel}>{label}</AppText>
      <AppText style={styles.flex}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardSecondary },
  warn: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  gap: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  info: { flexDirection: 'row', gap: spacing.md },
  infoLabel: { width: 130 },
});
