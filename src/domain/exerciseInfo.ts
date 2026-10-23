import { isExerciseAllowed } from './planGenerator';
import { recommendPrescription } from './training/prescription';
import type { Equipment, Exercise, Goal, Profile, TrainingLocation } from './types';

// Abgeleitete Übungsmetadaten für Bibliothek, Plan-Ersteller und Muskelkarte. Alles stammt aus
// denselben Stammdaten (data/exercises.ts, domain/muscles.ts).

const HOME_EQUIPMENT: Equipment[] = ['dumbbells', 'bodyweight', 'kettlebell', 'bands', 'pullup_bar'];
const OUTDOOR_EQUIPMENT: Equipment[] = ['bodyweight', 'bands', 'pullup_bar'];

/** Wo die Übung mit üblicher Ausstattung machbar ist. */
export function exerciseLocations(e: Pick<Exercise, 'equipment'>): TrainingLocation[] {
  const result: TrainingLocation[] = ['gym'];
  if (e.equipment.some((x) => HOME_EQUIPMENT.includes(x))) result.push('home');
  if (e.equipment.some((x) => OUTDOOR_EQUIPMENT.includes(x))) result.push('outdoor');
  return result;
}

/** Für welche Trainingsziele sich die Übung gut eignet. */
export function exerciseGoals(e: Pick<Exercise, 'category' | 'difficulty'>): Goal[] {
  switch (e.category) {
    case 'compound':
      return e.difficulty === 1 ? ['general', 'strength', 'hypertrophy', 'full_body', 'mobility'] : ['general', 'strength', 'hypertrophy', 'full_body'];
    case 'isolation':
      return ['general', 'hypertrophy'];
    case 'core':
      return ['general', 'full_body', 'mobility', 'strength', 'hypertrophy'];
    case 'mobility':
      return ['general', 'mobility'];
  }
}

/**
 * Alternativen mit gleichem Bewegungsmuster. Mit Profil nur solche, die zur Ausstattung und zu den
 * Einschränkungen passen.
 */
export function alternativesFor(exercise: Exercise, library: Exercise[], profile: Profile | null = null): Exercise[] {
  return library
    .filter((e) => e.id !== exercise.id && e.pattern === exercise.pattern && (!profile || isExerciseAllowed(e, profile)))
    .sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name));
}

export interface GoalRange {
  goal: Goal;
  sets: number;
  reps: string;
  rest: string;
}

const fmtRest = ([a, b]: [number, number]) => (a === b ? `${a} s` : `${a}–${b} s`);

/** Empfohlene Bereiche je Ziel für einen fortgeschrittenen Durchschnitt (Ausgangswerte, keine Vorgabe). */
export function recommendedRanges(exercise: Exercise, goals: Goal[] = ['hypertrophy', 'strength', 'general']): GoalRange[] {
  return goals.map((goal) => {
    const p = recommendPrescription(exercise, { goal, experience: 'intermediate', daysPerWeek: 3, limitations: [], ageYears: null, ageRecordedAt: null });
    return { goal, sets: p.sets, reps: p.durationSec ? `${p.durationSec} s` : `${p.repsMin}–${p.repsMax} Wdh.`, rest: fmtRest(p.restRange) };
  });
}
