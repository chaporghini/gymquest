import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Info, Minus, Pause, Play, Plus, Repeat, SkipForward, Timer, Trash } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, ConfirmDialog, EmptyState, ProgressBar, Screen, Stepper } from '@/components';
import { EXERCISES, getExercise } from '@/data/exercises';
import { alternativesFor } from '@/domain/exerciseInfo';
import { MUSCLE_LABELS, musclesOf } from '@/domain/muscles';
import { prescribe } from '@/domain/planGenerator';
import { formatClock } from '@/domain/dates';
import { formatRir, loadStepFor, loadTypeOf, recommendExerciseLoad } from '@/domain/training';
import type { ActiveWorkout, Effort, ExerciseFeedback, SetLog } from '@/domain/types';
import { activeDurationSec, completedSetCount, lastSetsByExercise, plannedSetCount, replaceActiveExercise, togglePause, toggleSkipExercise } from '@/domain/workout';
import { RecommendationCard } from '@/features/RecommendationCard';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

function useNow(intervalMs = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const EFFORT_OPTIONS: { value: Effort; label: string }[] = [
  { value: 'easy', label: 'Leicht' },
  { value: 'good', label: 'Passend' },
  { value: 'hard', label: 'Schwer' },
  { value: 'max', label: 'Am Limit' },
];

const READINESS_OPTIONS = [1, 2, 3, 4, 5];

function haptic(enabled: boolean, type: 'success' | 'light') {
  if (!enabled || Platform.OS === 'web') return;
  const p = type === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  p.catch(() => {});
}

export default function ActiveWorkoutScreen() {
  useKeepAwake();
  const app = useApp();
  const { activeWorkout: workout, settings, profile, sessions } = app;
  const now = useNow();
  const [dialog, setDialog] = useState<'finish' | 'discard' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restNotified = useRef<string | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const lastSets = useMemo(() => lastSetsByExercise(sessions), [sessions]);

  const exIndexRaw = workout ? Math.min(workout.currentExerciseIndex, workout.exercises.length - 1) : 0;
  const currentRaw = workout?.exercises[exIndexRaw];
  const startedAt = workout?.startedAt;
  // Empfehlung zum Stand des Trainingsbeginns (das laufende Training zählt noch nicht zur Historie).
  const recommendation = useMemo(() => {
    const ex = currentRaw ? getExercise(currentRaw.exerciseId) : undefined;
    if (!ex || !profile || !currentRaw || !startedAt) return null;
    return recommendExerciseLoad(profile, ex, sessions, {
      now: new Date(startedAt),
      planned: { exerciseId: ex.id, sets: currentRaw.sets.length, repsMin: currentRaw.targetRepsMin, repsMax: currentRaw.targetRepsMax, durationSec: currentRaw.targetDurationSec, restSec: currentRaw.restSec },
      settings,
    });
    // Sätze hinzufügen/entfernen soll die Empfehlung nicht neu berechnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRaw?.exerciseId, currentRaw?.targetRepsMin, currentRaw?.targetRepsMax, profile, sessions, settings, startedAt]);

  const restRemaining = workout?.restEndsAt ? Math.ceil((new Date(workout.restEndsAt).getTime() - now) / 1000) : 0;

  useEffect(() => {
    if (workout?.restEndsAt && restRemaining <= 0 && restNotified.current !== workout.restEndsAt) {
      restNotified.current = workout.restEndsAt;
      haptic(settings.hapticsEnabled, 'success');
    }
  }, [restRemaining, workout?.restEndsAt, settings.hapticsEnabled]);

  if (!workout) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          icon={Timer}
          title="Kein aktives Training"
          message="Starte ein Training über Home oder den Trainingsplan."
          actionLabel="Zur Startseite"
          onAction={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </Screen>
    );
  }

  const exIndex = Math.min(workout.currentExerciseIndex, workout.exercises.length - 1);
  const current = workout.exercises[exIndex];
  const exercise = getExercise(current.exerciseId);
  const elapsed = activeDurationSec(workout, new Date(now));
  const paused = !!workout.pausedAt;
  const muscles = musclesOf(current.exerciseId);
  const previous = lastSets[current.exerciseId]?.filter((s) => s.completed) ?? [];
  const previousText = previous.length
    ? previous.map((s) => (s.durationSec ? `${s.durationSec} s` : `${s.reps ?? '–'}${s.weightKg ? ` × ${s.weightKg} kg` : ''}`)).join(' · ')
    : null;
  const alternatives = exercise && profile ? alternativesFor(exercise, EXERCISES, profile).filter((a) => !workout.exercises.some((e) => e.exerciseId === a.id)).slice(0, 4) : [];
  const canSwap = !current.sets.some((st) => st.completed);
  const done = completedSetCount(workout);
  const total = plannedSetCount(workout);
  const restSec = settings.defaultRestSeconds ?? current.restSec;
  const isTime = exercise?.measurement === 'time';
  const weightStep = exercise ? loadStepFor(loadTypeOf(exercise), settings) : 2.5;
  const feedback = current.feedback ?? {};

  const update = (fn: (w: ActiveWorkout) => ActiveWorkout) => app.updateActiveWorkout(fn);

  const updateSet = (setIndex: number, patch: Partial<SetLog>) =>
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, i) =>
        i !== exIndex ? e : { ...e, sets: e.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)) },
      ),
    }));

  const toggleSet = (setIndex: number) => {
    const set = current.sets[setIndex];
    const completing = !set.completed;
    haptic(settings.hapticsEnabled, 'light');
    update((w) => {
      const exercises = w.exercises.map((e, i) =>
        i !== exIndex ? e : { ...e, sets: e.sets.map((s, j) => (j === setIndex ? { ...s, completed: completing } : s)) },
      );
      const allDone = exercises[exIndex].sets.every((s) => s.completed);
      const isLastExercise = exIndex >= exercises.length - 1;
      return {
        ...w,
        exercises,
        // Nach dem letzten Satz einer Übung automatisch zur nächsten wechseln.
        currentExerciseIndex: completing && allDone && !isLastExercise ? exIndex + 1 : w.currentExerciseIndex,
        restEndsAt: completing && !(allDone && isLastExercise) ? new Date(Date.now() + restSec * 1000).toISOString() : completing ? null : w.restEndsAt,
      };
    });
  };

  const setFeedback = (patch: Partial<Omit<ExerciseFeedback, 'exerciseId'>>) =>
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, i) => (i !== exIndex ? e : { ...e, feedback: { ...e.feedback, ...patch } })),
    }));

  const addSet = () =>
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, i) => {
        if (i !== exIndex) return e;
        const last = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [...e.sets, { ...(last ?? { exerciseId: e.exerciseId, reps: e.targetRepsMax, weightKg: null, durationSec: e.targetDurationSec ?? null }), setIndex: e.sets.length, completed: false }],
        };
      }),
    }));

  const removeSet = () =>
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, i) => (i !== exIndex || e.sets.length <= 1 ? e : { ...e, sets: e.sets.slice(0, -1) })),
    }));

  const goTo = (index: number) => update((w) => ({ ...w, currentExerciseIndex: Math.max(0, Math.min(w.exercises.length - 1, index)) }));
  const adjustRest = (delta: number) =>
    update((w) => (w.restEndsAt ? { ...w, restEndsAt: new Date(Math.max(Date.now(), new Date(w.restEndsAt).getTime() + delta * 1000)).toISOString() } : w));
  const skipRest = () => update((w) => ({ ...w, restEndsAt: null }));

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await app.completeWorkout();
      setDialog(null);
      router.replace('/workout/summary');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Training konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten.');
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await app.discardWorkout();
      setDialog(null);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verwerfen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    const skipping = !current.skipped;
    update((w) => {
      const next = toggleSkipExercise(w, exIndex);
      return skipping && exIndex < w.exercises.length - 1 ? { ...next, currentExerciseIndex: exIndex + 1, restEndsAt: null } : next;
    });
  };

  const swapTo = (exerciseId: string) => {
    const ex = EXERCISES.find((e) => e.id === exerciseId);
    if (!ex || !profile) return;
    update((w) => replaceActiveExercise(w, exIndex, prescribe(ex, profile), lastSets[ex.id] ?? []) ?? w);
    setSwapOpen(false);
  };

  const restActive = !!workout.restEndsAt && restRemaining > 0;

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <View style={styles.footer}>
          {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}
          {restActive ? (
            <View style={styles.rest} accessibilityLiveRegion="polite" accessibilityLabel={`Pause: noch ${restRemaining} Sekunden`}>
              <Timer size={22} color={colors.accent} />
              <View style={styles.flex}>
                <AppText variant="caption" tone="secondary">PAUSE</AppText>
                <AppText variant="number">{formatClock(restRemaining)}</AppText>
              </View>
              <RoundButton label="Pause um 15 Sekunden verkürzen" onPress={() => adjustRest(-15)}><Minus size={18} color={colors.text} /></RoundButton>
              <RoundButton label="Pause um 15 Sekunden verlängern" onPress={() => adjustRest(15)}><Plus size={18} color={colors.text} /></RoundButton>
              <RoundButton label="Pause überspringen" onPress={skipRest}><SkipForward size={18} color={colors.text} /></RoundButton>
            </View>
          ) : workout.restEndsAt ? (
            <Pressable onPress={skipRest} accessibilityRole="button" accessibilityLabel="Pause vorbei, weiter geht’s" style={styles.restDone}>
              <AppText variant="bodyStrong" tone="accent">Pause vorbei – nächster Satz!</AppText>
            </Pressable>
          ) : null}
          <Button label="Training abschließen" icon={Check} size="lg" fullWidth onPress={() => setDialog('finish')} disabled={done === 0} accessibilityHint={done === 0 ? 'Schließe zuerst mindestens einen Satz ab' : undefined} />
        </View>
      }>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Training minimieren"
          accessibilityHint="Das Training läuft weiter und bleibt gespeichert"
          hitSlop={8}
          style={styles.iconBtn}>
          <ChevronDown size={26} color={colors.text} />
        </Pressable>
        <View style={styles.center}>
          <AppText variant="caption" tone="secondary">{workout.name.toUpperCase()}</AppText>
          <AppText variant="heading" accessibilityLabel={`Trainingszeit ${formatClock(elapsed)}`}>{formatClock(elapsed)}</AppText>
        </View>
        <View style={styles.topActions}>
          <Pressable onPress={() => update((w) => togglePause(w, new Date()))} accessibilityRole="button" accessibilityLabel={paused ? 'Training fortsetzen' : 'Training anhalten'} hitSlop={8} style={styles.iconBtn}>
            {paused ? <Play size={22} color={colors.accent} /> : <Pause size={22} color={colors.text} />}
          </Pressable>
          <Pressable onPress={() => setDialog('discard')} accessibilityRole="button" accessibilityLabel="Training verwerfen" hitSlop={8} style={styles.iconBtn}>
            <Trash size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      {paused ? (
        <Card variant="highlight" style={styles.pausedCard}>
          <AppText variant="bodyStrong" style={styles.flex}>Training angehalten. Deine Eingaben sind gespeichert.</AppText>
          <Button label="Fortsetzen" icon={Play} size="sm" onPress={() => update((w) => togglePause(w, new Date()))} />
        </Card>
      ) : null}
      <View style={styles.progress}>
        <ProgressBar value={total ? done / total : 0} height={6} accessibilityLabel={`${done} von ${total} Sätzen erledigt`} />
        <AppText variant="small" tone="secondary">{done} von {total} Sätzen</AppText>
      </View>

      {done === 0 || workout.readiness != null ? (
        <Card variant="secondary" style={styles.feedbackCard}>
          <AppText variant="bodyStrong">Wie fit fühlst du dich heute?</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Tagesform von 1 (erschöpft) bis 5 (top)">
            {READINESS_OPTIONS.map((v) => (
              <Chip key={v} role="radio" label={String(v)} selected={workout.readiness === v} onPress={() => update((w) => ({ ...w, readiness: w.readiness === v ? null : v }))} />
            ))}
          </View>
          <AppText variant="caption" tone="secondary">1 = erschöpft · 5 = top</AppText>
          {workout.readiness != null && workout.readiness <= 2 ? (
            <AppText variant="small" tone="secondary">Heute lieber beim gewohnten Gewicht bleiben oder etwas leichter trainieren. Steigerungen holst du an einem fitteren Tag nach.</AppText>
          ) : null}
        </Card>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.exerciseTabs}>
        {workout.exercises.map((e, i) => {
          const ex = getExercise(e.exerciseId);
          const allDone = e.sets.every((s) => s.completed);
          const label = e.skipped ? 'übersprungen' : allDone ? 'erledigt' : '';
          return (
            <Pressable
              key={`${e.exerciseId}-${i}`}
              onPress={() => goTo(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === exIndex }}
              accessibilityLabel={`Übung ${i + 1}: ${ex?.name ?? e.exerciseId}${label ? `, ${label}` : ''}`}
              style={[styles.exTab, i === exIndex && styles.exTabActive, (allDone || e.skipped) && styles.exTabDone]}>
              <AppText variant="small" tone={i === exIndex ? 'accent' : allDone || e.skipped ? 'secondary' : 'primary'} numberOfLines={1} style={e.skipped ? styles.strike : undefined}>
                {allDone ? '✓ ' : ''}{ex?.name ?? e.exerciseId}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card style={styles.exerciseCard}>
        <View style={styles.exHeader}>
          <View style={styles.flex}>
            <AppText variant="caption" tone="accent">ÜBUNG {exIndex + 1} VON {workout.exercises.length}</AppText>
            <AppText variant="title">{exercise?.name ?? 'Unbekannte Übung'}</AppText>
            <AppText variant="small" tone="secondary">
              Ziel: {isTime ? `${current.targetDurationSec ?? 30} s` : `${current.targetRepsMin}–${current.targetRepsMax} Wdh.`} · Pause {restSec} s
            </AppText>
            <AppText variant="small" tone="secondary">
              Primär: {muscles.primary.map((m) => MUSCLE_LABELS[m]).join(', ') || '–'}
              {muscles.secondary.length ? ` · Sekundär: ${muscles.secondary.map((m) => MUSCLE_LABELS[m]).join(', ')}` : ''}
            </AppText>
            {current.replacedExerciseId ? <AppText variant="small" tone="warning">Ersetzt {getExercise(current.replacedExerciseId)?.name ?? 'die geplante Übung'}</AppText> : null}
          </View>
          {exercise ? (
            <Pressable
              onPress={() => router.push({ pathname: '/library/[id]', params: { id: exercise.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Anleitung für ${exercise.name}`}
              hitSlop={8}
              style={styles.iconBtn}>
              <Info size={22} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>

        {exercise ? <AppText variant="small">{exercise.steps[0]} {exercise.tips[0] ?? ''}</AppText> : null}
        <AppText variant="small" tone="secondary">{previousText ? `Zuletzt: ${previousText}` : 'Noch keine Werte von früher. Starte mit einem Gewicht, das du sicher kontrollierst.'}</AppText>

        {current.skipped ? (
          <Card variant="secondary" style={styles.feedbackCard}>
            <AppText>Diese Übung ist übersprungen und wird so in der Historie vermerkt.</AppText>
            <Button label="Doch machen" size="sm" variant="secondary" onPress={skip} />
          </Card>
        ) : null}

        {recommendation && !current.skipped ? <RecommendationCard recommendation={recommendation} compact /> : null}

        {current.sets.map((set, j) => (
          <View key={j} style={[styles.setRow, set.completed && styles.setDone]}>
            <View style={styles.setInputs}>
              {isTime ? (
                <Stepper compact label={`Satz ${j + 1} · Sek.`} value={set.durationSec} onChange={(v) => updateSet(j, { durationSec: v })} step={5} max={600} />
              ) : (
                <Stepper compact label={`Satz ${j + 1} · Wdh.`} value={set.reps} onChange={(v) => updateSet(j, { reps: v })} max={100} />
              )}
              {exercise?.usesWeight || (set.weightKg ?? 0) > 0 ? (
                <Stepper label="Gewicht" unit="kg" compact value={set.weightKg} onChange={(v) => updateSet(j, { weightKg: v })} step={weightStep} max={500} decimals />
              ) : null}
            </View>
            <Pressable
              onPress={() => toggleSet(j)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: set.completed }}
              accessibilityLabel={`Satz ${j + 1} ${set.completed ? 'erledigt' : 'abschließen'}`}
              style={({ pressed }) => [styles.check, set.completed && styles.checkDone, pressed && { opacity: 0.8 }]}>
              <Check size={22} color={set.completed ? colors.onAccent : colors.textSecondary} strokeWidth={3} />
            </Pressable>
          </View>
        ))}

        <View style={styles.setActions}>
          {!current.skipped ? <Button label="Überspringen" icon={SkipForward} variant="ghost" size="sm" onPress={skip} /> : null}
          {canSwap && alternatives.length ? <Button label="Austauschen" icon={Repeat} variant="ghost" size="sm" onPress={() => setSwapOpen((v) => !v)} /> : null}
        </View>
        {swapOpen && canSwap ? (
          <View style={styles.feedbackCard}>
            <AppText variant="bodyStrong">Austauschen gegen</AppText>
            {alternatives.map((a) => (
              <Pressable key={a.id} onPress={() => swapTo(a.id)} accessibilityRole="button" style={styles.swapRow}>
                <Repeat size={16} color={colors.accent} />
                <AppText style={styles.flex}>{a.name}</AppText>
              </Pressable>
            ))}
            <AppText variant="small" tone="secondary">Nur Alternativen mit gleichem Bewegungsmuster, die zu deiner Ausstattung passen.</AppText>
          </View>
        ) : null}

        <View style={styles.setActions}>
          <Button label="Satz hinzufügen" icon={Plus} variant="ghost" size="sm" onPress={addSet} />
          <Button label="Satz entfernen" icon={Minus} variant="ghost" size="sm" onPress={removeSet} disabled={current.sets.length <= 1} accessibilityLabel="Letzten Satz entfernen" />
        </View>

        {current.sets.some((st) => st.completed) ? (
          <View style={styles.feedbackCard}>
            <AppText variant="bodyStrong">Wie anstrengend war diese Übung?</AppText>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {EFFORT_OPTIONS.map((o) => (
                <Chip key={o.value} role="radio" label={o.label} selected={feedback.effort === o.value} onPress={() => setFeedback({ effort: feedback.effort === o.value ? null : o.value })} />
              ))}
            </View>
            <View style={styles.chips}>
              <Chip role="checkbox" label="Technik unsicher" selected={!!feedback.techniqueUnsure} onPress={() => setFeedback({ techniqueUnsure: !feedback.techniqueUnsure })} />
              <Chip role="checkbox" label="Beschwerden" selected={!!feedback.pain} onPress={() => setFeedback({ pain: !feedback.pain })} />
            </View>
            <AppText variant="small" tone="secondary">
              {feedback.pain
                ? 'Brich die Übung ab, wenn es schmerzt. Beim nächsten Mal schlagen wir keine Steigerung vor. Halten Beschwerden an, lass dich ärztlich oder physiotherapeutisch beraten.'
                : `Hilft bei der Empfehlung fürs nächste Mal. Passend heißt: noch etwa ${formatRir(recommendation?.targetRepsInReserve ?? [1, 3])} saubere Wiederholungen wären möglich gewesen.`}
            </AppText>
          </View>
        ) : null}
      </Card>

      <View style={styles.nav}>
        <Button label="Vorherige" icon={ChevronLeft} variant="secondary" onPress={() => goTo(exIndex - 1)} disabled={exIndex === 0} style={styles.flex} />
        <Button label="Nächste" icon={ChevronRight} variant="secondary" onPress={() => goTo(exIndex + 1)} disabled={exIndex >= workout.exercises.length - 1} style={styles.flex} />
      </View>

      <AppText variant="small" tone="secondary" align="center">
        Saubere Technik vor Gewicht. Bei Schmerzen die Übung abbrechen.
      </AppText>

      <ConfirmDialog
        visible={dialog === 'finish'}
        title="Training abschließen?"
        message={
          done < total
            ? `Du hast ${done} von ${total} Sätzen erledigt. Nur abgeschlossene Sätze werden gespeichert und bringen XP.`
            : 'Alle Sätze erledigt – stark! Dein Training wird gespeichert.'
        }
        confirmLabel="Abschließen"
        loading={busy}
        onConfirm={finish}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'discard'}
        title="Training verwerfen?"
        message="Alle Eingaben dieses Trainings gehen verloren und es gibt keine XP."
        confirmLabel="Verwerfen"
        destructive
        loading={busy}
        onConfirm={discard}
        onCancel={() => setDialog(null)}
      />
    </Screen>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.md },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center' },
  topActions: { flexDirection: 'row' },
  pausedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  strike: { textDecorationLine: 'line-through' },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  progress: { gap: spacing.xs },
  noGrow: { flexGrow: 0 },
  exerciseTabs: { gap: spacing.sm, paddingRight: spacing.lg },
  exTab: { paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, maxWidth: 200 },
  exTabActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  exTabDone: { opacity: 0.7 },
  exerciseCard: { gap: spacing.md },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  setRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, padding: spacing.sm, borderRadius: radius.md },
  setDone: { backgroundColor: colors.accentFaint },
  setInputs: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  check: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  setActions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  feedbackCard: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nav: { flexDirection: 'row', gap: spacing.md },
  rest: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.accentBorder },
  restDone: { alignItems: 'center', padding: spacing.sm, minHeight: MIN_TOUCH, justifyContent: 'center' },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
});
