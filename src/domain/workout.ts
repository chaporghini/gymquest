import { addDays, isSameDay, startOfDay, startOfWeek, weekdayIndex } from './dates';
import { sessionsInWeek } from './progression';
import type { ActiveWorkout, ExerciseFeedback, PlanDay, PlannedExercise, SessionExercise, SetLog, TrainingPlan, WorkoutSession } from './types';
import { calculateWorkoutXp, type WorkoutXpBreakdown } from './xp';

export interface NextSession {
  day: PlanDay;
  date: Date;
  isToday: boolean;
  /** true, wenn alle Einheiten dieser Woche erledigt sind und die nächste in der Folgewoche liegt. */
  nextWeek: boolean;
}

export function getNextSession(plan: TrainingPlan | null, sessions: WorkoutSession[], now: Date): NextSession | null {
  if (!plan || plan.days.length === 0) return null;
  const weekStart = startOfWeek(now);
  const doneIds = new Set(sessionsInWeek(sessions, weekStart).map((s) => s.planDayId));
  const today = weekdayIndex(now);
  const ordered = [...plan.days].sort((a, b) => a.weekday - b.weekday);

  // Offene Einheiten ab heute; verpasste Einheiten von früher in der Woche werden danach angeboten.
  const upcoming = ordered.find((d) => d.weekday >= today && !doneIds.has(d.id));
  if (upcoming) {
    const date = addDays(weekStart, upcoming.weekday);
    return { day: upcoming, date, isToday: isSameDay(date, now), nextWeek: false };
  }
  const missed = ordered.find((d) => !doneIds.has(d.id));
  if (missed) return { day: missed, date: startOfDay(now), isToday: true, nextWeek: false };
  const first = ordered[0];
  return { day: first, date: addDays(weekStart, 7 + first.weekday), isToday: false, nextWeek: true };
}

/**
 * `suggestedLoads`: empfohlene Gewichte je Übung (aus recommendExerciseLoad). Ohne Empfehlung
 * wird das Gewicht vom letzten Mal vorgeschlagen.
 */
export function createActiveWorkout(
  day: PlanDay,
  id: string,
  now: Date,
  lastSets: Record<string, SetLog[]> = {},
  suggestedLoads: Record<string, number | null | undefined> = {},
  planName: string | null = null,
): ActiveWorkout {
  return {
    id,
    planDayId: day.id,
    name: day.name,
    planName,
    startedAt: now.toISOString(),
    currentExerciseIndex: 0,
    restEndsAt: null,
    exercises: day.exercises.map((pe) => activeExercise(pe, lastSets[pe.exerciseId] ?? [], suggestedLoads[pe.exerciseId])),
  };
}

function activeExercise(pe: PlannedExercise, previous: SetLog[], suggested: number | null | undefined): ActiveWorkout['exercises'][number] {
  return {
    exerciseId: pe.exerciseId,
    restSec: pe.restSec,
    targetRepsMin: pe.repsMin,
    targetRepsMax: pe.repsMax,
    targetDurationSec: pe.durationSec,
    sets: Array.from({ length: pe.sets }, (_, i) => ({
      exerciseId: pe.exerciseId,
      setIndex: i,
      // Werte vom letzten Mal vorschlagen, sonst Ziel-Wiederholungen
      reps: pe.durationSec ? null : (previous[i]?.reps ?? pe.repsMax),
      weightKg: suggested ?? previous[i]?.weightKg ?? null,
      durationSec: pe.durationSec ?? null,
      completed: false,
    })),
  };
}

/** Übung im laufenden Training überspringen (oder wieder aufnehmen). Bereits erledigte Sätze bleiben erhalten. */
export function toggleSkipExercise(workout: ActiveWorkout, index: number): ActiveWorkout {
  return { ...workout, exercises: workout.exercises.map((e, i) => (i === index ? { ...e, skipped: !e.skipped } : e)) };
}

/**
 * Ersetzt eine Übung im laufenden Training. Nur möglich, solange noch kein Satz erledigt ist.
 * Die ursprünglich geplante Übung wird für die Historie vermerkt.
 */
export function replaceActiveExercise(workout: ActiveWorkout, index: number, planned: PlannedExercise, lastSets: SetLog[] = [], suggested?: number | null): ActiveWorkout | null {
  const current = workout.exercises[index];
  if (!current || current.sets.some((s) => s.completed)) return null;
  if (workout.exercises.some((e, i) => i !== index && e.exerciseId === planned.exerciseId)) return null;
  const original = current.replacedExerciseId ?? current.exerciseId;
  const replaced = { ...activeExercise(planned, lastSets, suggested), ...(original !== planned.exerciseId ? { replacedExerciseId: original } : {}) };
  return { ...workout, exercises: workout.exercises.map((e, i) => (i === index ? replaced : e)) };
}

export function plannedSetCount(workout: ActiveWorkout): number {
  return workout.exercises.reduce((n, e) => n + e.sets.length, 0);
}

export function completedSetCount(workout: ActiveWorkout): number {
  return workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
}

/** Trainingsdauer ohne angehaltene Zeit. */
export function activeDurationSec(workout: Pick<ActiveWorkout, 'startedAt' | 'pausedAt' | 'pausedSec'>, now: Date): number {
  const pausedNow = workout.pausedAt ? Math.max(0, now.getTime() - new Date(workout.pausedAt).getTime()) / 1000 : 0;
  return Math.max(0, Math.round((now.getTime() - new Date(workout.startedAt).getTime()) / 1000 - (workout.pausedSec ?? 0) - pausedNow));
}

/** Training anhalten oder fortsetzen. Eine laufende Satzpause wird dabei beendet. */
export function togglePause(workout: ActiveWorkout, now: Date): ActiveWorkout {
  if (workout.pausedAt) {
    const extra = Math.max(0, Math.round((now.getTime() - new Date(workout.pausedAt).getTime()) / 1000));
    return { ...workout, pausedAt: null, pausedSec: (workout.pausedSec ?? 0) + extra };
  }
  return { ...workout, pausedAt: now.toISOString(), restEndsAt: null };
}

/** Geplante und erledigte Arbeit je Übung; Grundlage für XP und die Trainingshistorie. */
export function sessionExercises(workout: ActiveWorkout): SessionExercise[] {
  return workout.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    plannedSets: e.sets.length,
    repsMin: e.targetRepsMin,
    repsMax: e.targetRepsMax,
    ...(e.targetDurationSec ? { durationSec: e.targetDurationSec } : {}),
    restSec: e.restSec,
    completedSets: e.sets.filter((s) => s.completed).length,
    ...(e.skipped ? { skipped: true } : {}),
    ...(e.replacedExerciseId ? { replacedExerciseId: e.replacedExerciseId } : {}),
  }));
}

export function finishWorkout(
  workout: ActiveWorkout,
  previousSessions: WorkoutSession[],
  now: Date,
): { session: WorkoutSession; xp: WorkoutXpBreakdown } {
  const sets = workout.exercises.flatMap((e) => e.sets);
  const earlierToday = previousSessions.filter((s) => isSameDay(new Date(s.finishedAt), now)).length;
  const exercises = sessionExercises(workout);
  const xp = calculateWorkoutXp(exercises, earlierToday);
  const durationSec = activeDurationSec(workout, now);
  return {
    session: {
      id: workout.id,
      planDayId: workout.planDayId,
      name: workout.name,
      startedAt: workout.startedAt,
      finishedAt: now.toISOString(),
      durationSec,
      xpEarned: xp.total,
      sets: sets.filter((s) => s.completed),
      feedback: collectFeedback(workout),
      readiness: workout.readiness ?? null,
      planName: workout.planName ?? null,
      exercises,
    },
    xp,
  };
}

function collectFeedback(workout: ActiveWorkout): ExerciseFeedback[] | undefined {
  const list = workout.exercises
    .filter((e) => e.feedback && (e.feedback.effort || e.feedback.pain || e.feedback.techniqueUnsure) && e.sets.some((s) => s.completed))
    .map((e) => ({ exerciseId: e.exerciseId, ...e.feedback }));
  return list.length ? list : undefined;
}

/** Letzte protokollierte Sätze je Übung, um Vorschläge für das nächste Training zu machen. */
export function lastSetsByExercise(sessions: WorkoutSession[]): Record<string, SetLog[]> {
  const result: Record<string, SetLog[]> = {};
  const sorted = [...sessions].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  for (const s of sorted) {
    const grouped: Record<string, SetLog[]> = {};
    for (const set of s.sets) (grouped[set.exerciseId] ??= []).push(set);
    for (const [id, list] of Object.entries(grouped)) if (!result[id]) result[id] = list;
  }
  return result;
}
