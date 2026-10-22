import type { Exercise, LoadType, Settings } from '../types';

// Steigerungsschritte je Gerät. Gewichte verschiedener Geräte werden nie ineinander umgerechnet.

const BARBELL = new Set(['back_squat', 'deadlift', 'bench_press']);
const MACHINE = new Set(['leg_press', 'seated_cable_row', 'lat_pulldown']);
const KETTLEBELL = new Set(['kettlebell_swing']);

export const DEFAULT_LOAD_STEPS: Record<LoadType, number> = {
  barbell: 2.5, // 2 × 1,25 kg Scheiben
  dumbbell: 2, // je Hand
  machine: 5, // typische Steckgewicht-Stufe
  kettlebell: 4,
  bodyweight: 0,
};

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  barbell: 'Langhantel',
  dumbbell: 'Kurzhantel (je Hand)',
  machine: 'Maschine / Kabelzug',
  kettlebell: 'Kettlebell',
  bodyweight: 'Körpergewicht',
};

export function loadTypeOf(exercise: Pick<Exercise, 'id' | 'usesWeight'>): LoadType {
  if (!exercise.usesWeight) return 'bodyweight';
  if (BARBELL.has(exercise.id)) return 'barbell';
  if (MACHINE.has(exercise.id)) return 'machine';
  if (KETTLEBELL.has(exercise.id)) return 'kettlebell';
  return 'dumbbell';
}

export function loadStepFor(type: LoadType, settings?: Pick<Settings, 'loadSteps'> | null): number {
  const custom = settings?.loadSteps?.[type];
  return custom && custom > 0 ? custom : DEFAULT_LOAD_STEPS[type];
}

const clean = (n: number) => Math.round(n * 100) / 100;

/** Rundet auf die verfügbare Gewichtsstufe. */
export function roundToStep(weight: number, step: number): number {
  if (step <= 0) return clean(weight);
  return clean(Math.round(weight / step) * step);
}

/** Nächstkleinere Stufe, mindestens eine Stufe unter `weight`, nie unter 0. */
export function reduceLoad(weight: number, step: number, factor: number): number {
  const target = roundToStep(weight * factor, step);
  const atLeastOneStep = clean(weight - step);
  return Math.max(0, Math.min(target, atLeastOneStep));
}
