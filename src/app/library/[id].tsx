import { router, Stack, useLocalSearchParams } from 'expo-router';
import { BookOpen, ChevronRight, CircleCheck, SearchX, TriangleAlert } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useMemo, useState } from 'react';

import { AppText, Button, Card, EmptyState, Screen, Stepper } from '@/components';
import { EXERCISES, getExercise } from '@/data/exercises';
import { alternativesFor, recommendedRanges } from '@/domain/exerciseInfo';
import { isExerciseAllowed } from '@/domain/planGenerator';
import { categoryLabels, difficultyLabels, equipmentLabels, goalLabels, limitationLabels, muscleLabels } from '@/i18n/labels';
import { recommendExerciseLoad } from '@/domain/training';
import { muscleLoad } from '@/domain/muscles';
import { BodyMap } from '@/features/BodyMap';
import { RecommendationCard } from '@/features/RecommendationCard';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, sessions, settings, saveKnownLoad, xpEvents } = useApp();
  const exercise = getExercise(id);
  const known = profile?.knownLoads?.find((k) => k.exerciseId === id);
  const [knownWeight, setKnownWeight] = useState<number | null>(known?.weightKg ?? null);
  const [knownReps, setKnownReps] = useState<number | null>(known?.reps ?? null);
  const [saved, setSaved] = useState(false);
  const recommendation = useMemo(
    () => (exercise && profile ? recommendExerciseLoad(profile, exercise, sessions, { settings }) : null),
    [exercise, profile, sessions, settings],
  );
  const hasHistory = (recommendation?.basedOnTrainingSessionIds.length ?? 0) > 0;

  if (!exercise) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} title="Übung nicht gefunden" message="Diese Übung gibt es nicht in der Bibliothek." />
      </Screen>
    );
  }

  const conflicts = exercise.stresses.filter((s) => profile?.limitations.includes(s));
  const lessonDone = xpEvents.some((e) => e.source === 'lesson' && e.refId === exercise.id);
  const alternatives = alternativesFor(exercise, EXERCISES).slice(0, 5);
  const ranges = recommendedRanges(exercise, exercise.category === 'mobility' ? ['mobility'] : exercise.category === 'isolation' ? ['hypertrophy', 'general'] : ['hypertrophy', 'strength', 'general']);

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

      <Card>
        <BodyMap load={muscleLoad([exercise.id])} showList />
      </Card>

      <Pressable
        onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: exercise.id } })}
        accessibilityRole="button"
        style={styles.lesson}>
        {lessonDone ? <CircleCheck size={22} color={colors.accent} /> : <BookOpen size={22} color={colors.accent} />}
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Techniklektion</AppText>
          <AppText variant="small" tone="secondary">{lessonDone ? 'Abgeschlossen. Du kannst sie jederzeit wiederholen.' : 'Ausführung, häufige Fehler und eine kurze Frage · +20 XP'}</AppText>
        </View>
        <ChevronRight size={18} color={colors.textSecondary} />
      </Pressable>

      {conflicts.length > 0 ? (
        <Card variant="secondary" style={styles.warn}>
          <TriangleAlert size={20} color={colors.warning} />
          <AppText style={styles.flex}>
            Diese Übung belastet {conflicts.map((c) => limitationLabels[c]).join(' und ')} – laut deinem Profil solltest du hier vorsichtig sein.
          </AppText>
        </Card>
      ) : null}

      {recommendation ? (
        <View style={styles.gap}>
          <AppText variant="heading">Empfehlung fürs nächste Mal</AppText>
          <RecommendationCard recommendation={recommendation} />
        </View>
      ) : null}

      {exercise.usesWeight && !hasHistory ? (
        <Card style={styles.gap}>
          <AppText variant="heading">Bekannte Leistung (optional)</AppText>
          <AppText variant="small" tone="secondary">
            Weißt du, mit welchem Gewicht du diese Übung zuletzt sauber geschafft hast? Dann starten wir etwas darunter. Sobald du die Übung in GYMQUEST trainierst, zählt nur noch dein Protokoll.
          </AppText>
          <View style={styles.row}>
            <View style={styles.flex}><Stepper label="Gewicht" unit="kg" compact value={knownWeight} onChange={(v) => { setKnownWeight(v); setSaved(false); }} step={recommendation?.loadStepKg ?? 2.5} max={500} decimals /></View>
            <View style={styles.flex}><Stepper label="Wdh." compact value={knownReps} onChange={(v) => { setKnownReps(v); setSaved(false); }} max={50} /></View>
          </View>
          <View style={styles.row}>
            <Button
              label={saved ? 'Gespeichert' : 'Speichern'}
              size="sm"
              disabled={!knownWeight || !knownReps}
              onPress={async () => {
                if (knownWeight && knownReps) await saveKnownLoad(exercise.id, { weightKg: knownWeight, reps: knownReps });
                setSaved(true);
              }}
            />
            {known ? (
              <Button label="Entfernen" size="sm" variant="ghost" onPress={async () => { await saveKnownLoad(exercise.id, null); setKnownWeight(null); setKnownReps(null); }} />
            ) : null}
          </View>
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

      {exercise.mistakes.length ? (
        <Card variant="secondary" style={styles.gap}>
          <AppText variant="heading">Häufige Fehler</AppText>
          {exercise.mistakes.map((m) => <AppText key={m} tone="secondary">• {m}</AppText>)}
        </Card>
      ) : null}

      <Card style={styles.gap}>
        <AppText variant="heading">Empfohlene Bereiche</AppText>
        {ranges.map((r) => (
          <Info key={r.goal} label={goalLabels[r.goal]} value={`${r.sets} Sätze × ${r.reps} · Pause ${r.rest}`} />
        ))}
        <AppText variant="small" tone="secondary">Ausgangswerte. Dein Plan passt sie an Erfahrung, Ziel und Trainingstage an.</AppText>
      </Card>

      {alternatives.length ? (
        <Card style={styles.gap}>
          <AppText variant="heading">Alternativen</AppText>
          {alternatives.map((a) => {
            const fits = !profile || isExerciseAllowed(a, profile);
            return (
              <Pressable key={a.id} onPress={() => router.push({ pathname: '/library/[id]', params: { id: a.id } })} accessibilityRole="button" style={styles.altRow}>
                <View style={styles.flex}>
                  <AppText>{a.name}</AppText>
                  <AppText variant="small" tone={fits ? 'secondary' : 'warning'}>{fits ? `${difficultyLabels[a.difficulty]} · ${a.equipment.map((e) => equipmentLabels[e]).join(' oder ')}` : 'Passt nicht zu deiner Ausstattung oder Einschränkung'}</AppText>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </Pressable>
            );
          })}
        </Card>
      ) : null}

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
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  info: { flexDirection: 'row', gap: spacing.md },
  infoLabel: { width: 130 },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
});
