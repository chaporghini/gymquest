import { addDays, isSameDay, startOfDay, startOfWeek, weekdayIndex } from './dates';
import { sessionsInWeek } from './progression';
import type { ActiveWorkout, PlanDay, SetLog, TrainingPlan, WorkoutSession } from './types';
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

export function createActiveWorkout(day: PlanDay, id: string, now: Date, lastSets: Record<string, SetLog[]> = {}): ActiveWorkout {
  return {
    id,
    planDayId: day.id,
    name: day.name,
    startedAt: now.toISOString(),
    currentExerciseIndex: 0,
    restEndsAt: null,
    exercises: day.exercises.map((pe) => {
      const previous = lastSets[pe.exerciseId] ?? [];
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
          weightKg: previous[i]?.weightKg ?? null,
          durationSec: pe.durationSec ?? null,
          completed: false,
        })),
      };
    }),
  };
}

export function plannedSetCount(workout: ActiveWorkout): number {
  return workout.exercises.reduce((n, e) => n + e.sets.length, 0);
}

export function completedSetCount(workout: ActiveWorkout): number {
  return workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
}

export function finishWorkout(
  workout: ActiveWorkout,
  previousSessions: WorkoutSession[],
  now: Date,
): { session: WorkoutSession; xp: WorkoutXpBreakdown } {
  const sets = workout.exercises.flatMap((e) => e.sets);
  const earlierToday = previousSessions.filter((s) => isSameDay(new Date(s.finishedAt), now)).length;
  const xp = calculateWorkoutXp(sets, plannedSetCount(workout), earlierToday);
  const durationSec = Math.max(0, Math.round((now.getTime() - new Date(workout.startedAt).getTime()) / 1000));
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
    },
    xp,
  };
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
