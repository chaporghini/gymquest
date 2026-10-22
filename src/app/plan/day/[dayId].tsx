import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, Info, Play, Plus, Repeat, SearchX, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, EmptyState, prescriptionText, Screen, Stepper } from '@/components';
import { EXERCISES, getExercise } from '@/data/exercises';
import { estimateDayMinutes, isExerciseAllowed } from '@/domain/planGenerator';
import type { PlanDay, PlannedExercise } from '@/domain/types';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function DayEditor() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const app = useApp();
  const { plan, profile, activeWorkout } = app;
  const day = plan?.days.find((d) => d.id === dayId);
  const [name, setName] = useState(day?.name ?? '');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!plan || !day || !profile) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} title="Einheit nicht gefunden" message="Diese Trainingseinheit gibt es im Plan nicht mehr." actionLabel="Zurück" onAction={() => (router.canGoBack() ? router.back() : router.replace('/training'))} />
      </Screen>
    );
  }

  const saveDay = async (patch: Partial<PlanDay>) => {
    setError(null);
    try {
      await app.savePlan({ ...plan, days: plan.days.map((d) => (d.id === day.id ? { ...d, ...patch } : d)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    }
  };

  const setExercises = (exercises: PlannedExercise[]) => saveDay({ exercises });
  const updateEx = (i: number, patch: Partial<PlannedExercise>) => setExercises(day.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...day.exercises];
    const [item] = next.splice(i, 1);
    next.splice(i + dir, 0, item);
    setExpanded(i + dir);
    void setExercises(next);
  };
  const swap = (i: number) => {
    const current = getExercise(day.exercises[i].exerciseId);
    if (!current) return;
    const used = new Set(day.exercises.map((e) => e.exerciseId));
    const options = EXERCISES.filter((e) => e.pattern === current.pattern && isExerciseAllowed(e, profile) && (!used.has(e.id) || e.id === current.id));
    if (options.length <= 1) return setError(`Keine passende Alternative zu „${current.name}“ mit deinem Equipment gefunden.`);
    const next = options[(options.findIndex((o) => o.id === current.id) + 1) % options.length];
    const isTime = next.measurement === 'time';
    void updateEx(i, {
      exerciseId: next.id,
      durationSec: isTime ? (day.exercises[i].durationSec ?? 30) : undefined,
      repsMin: isTime ? 0 : day.exercises[i].repsMin || 8,
      repsMax: isTime ? 0 : day.exercises[i].repsMax || 12,
    });
  };

  const start = async () => {
    try {
      if (!activeWorkout) await app.startWorkout(day.id);
      router.push('/workout/active');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Training konnte nicht gestartet werden.');
    }
  };

  return (
    <Screen
      edges={['bottom']}
      footer={<Button label={activeWorkout ? 'Laufendes Training öffnen' : 'Diese Einheit starten'} icon={Play} size="lg" fullWidth onPress={start} disabled={day.exercises.length === 0} />}>
      <Stack.Screen options={{ title: day.name }} />
      <View style={styles.field}>
        <AppText variant="caption" tone="secondary">NAME DER EINHEIT</AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={() => name.trim() && name.trim() !== day.name && saveDay({ name: name.trim() })}
          maxLength={30}
          accessibilityLabel="Name der Einheit"
          style={styles.input}
        />
      </View>
      <AppText variant="small" tone="secondary">
        {day.exercises.length} Übungen · geschätzt {estimateDayMinutes(day)} min (Ziel: {profile.sessionMinutes} min)
      </AppText>
      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}

      {day.exercises.length === 0 ? (
        <EmptyState icon={Plus} title="Noch keine Übungen" message="Füge Übungen aus der Bibliothek hinzu." />
      ) : null}

      {day.exercises.map((pe, i) => {
        const ex = getExercise(pe.exerciseId);
        const open = expanded === i;
        return (
          <Card key={`${pe.exerciseId}-${i}`} style={styles.card}>
            <Pressable
              onPress={() => setExpanded(open ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${ex?.name ?? pe.exerciseId}, ${prescriptionText(pe)}. ${open ? 'Zuklappen' : 'Bearbeiten'}`}
              style={styles.row}>
              <View style={styles.index}><AppText variant="small" style={styles.bold}>{i + 1}</AppText></View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{ex?.name ?? pe.exerciseId}</AppText>
                <AppText variant="small" tone="secondary">{prescriptionText(pe)} · Pause {pe.restSec} s</AppText>
              </View>
              <AppText variant="small" tone="accent">{open ? 'Fertig' : 'Bearbeiten'}</AppText>
            </Pressable>
            {open ? (
              <View style={styles.editor}>
                <View style={styles.steppers}>
                  <Stepper label="Sätze" value={pe.sets} onChange={(v) => updateEx(i, { sets: Math.max(1, Math.min(10, v ?? 1)) })} min={1} max={10} />
                  {pe.durationSec ? (
                    <Stepper label="Sekunden" value={pe.durationSec} onChange={(v) => updateEx(i, { durationSec: Math.max(5, v ?? 30) })} step={5} min={5} max={600} />
                  ) : (
                    <>
                      <Stepper label="Wdh. min" value={pe.repsMin} onChange={(v) => updateEx(i, { repsMin: Math.max(1, v ?? 1), repsMax: Math.max(pe.repsMax, v ?? 1) })} min={1} max={50} />
                      <Stepper label="Wdh. max" value={pe.repsMax} onChange={(v) => updateEx(i, { repsMax: Math.max(pe.repsMin, v ?? pe.repsMin) })} min={1} max={50} />
                    </>
                  )}
                  <Stepper label="Pause" unit="s" value={pe.restSec} onChange={(v) => updateEx(i, { restSec: Math.max(0, v ?? 60) })} step={15} max={600} />
                </View>
                <View style={styles.actions}>
                  <Button label="Tauschen" icon={Repeat} variant="secondary" size="sm" onPress={() => swap(i)} accessibilityLabel="Gegen ähnliche Übung tauschen" />
                  <Button label="Anleitung" icon={Info} variant="secondary" size="sm" onPress={() => router.push({ pathname: '/library/[id]', params: { id: pe.exerciseId } })} />
                  <Button label="Hoch" icon={ArrowUp} variant="ghost" size="sm" onPress={() => move(i, -1)} disabled={i === 0} accessibilityLabel="Nach oben verschieben" />
                  <Button label="Runter" icon={ArrowDown} variant="ghost" size="sm" onPress={() => move(i, 1)} disabled={i === day.exercises.length - 1} accessibilityLabel="Nach unten verschieben" />
                  <Button
                    label="Entfernen"
                    icon={Trash}
                    variant="danger"
                    size="sm"
                    onPress={() => {
                      setExpanded(null);
                      void setExercises(day.exercises.filter((_, j) => j !== i));
                    }}
                  />
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}

      <Button label="Übung hinzufügen" icon={Plus} variant="secondary" onPress={() => router.push({ pathname: '/library', params: { pickFor: day.id } })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: { ...typography.bodyStrong, color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 48 },
  card: { gap: spacing.md, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  index: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  flex: { flex: 1, gap: 2 },
  editor: { gap: spacing.md },
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
