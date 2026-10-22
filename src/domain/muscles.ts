import type { Exercise, PlanDay, TrainingPlan } from './types';

// Feine Muskelgruppen für die Körperkarte. Pro Übung: direkt (Hauptmuskeln) und indirekt beansprucht.

export type Muscle =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'traps'
  | 'upper_back'
  | 'lats'
  | 'lower_back'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export const MUSCLES: Muscle[] = [
  'chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'forearms', 'abs', 'obliques',
  'traps', 'upper_back', 'lats', 'lower_back', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves',
];

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Brust',
  front_delts: 'Vordere Schulter',
  side_delts: 'Seitliche Schulter',
  rear_delts: 'Hintere Schulter',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  abs: 'Bauch',
  obliques: 'Seitlicher Bauch',
  traps: 'Nacken (Trapez)',
  upper_back: 'Oberer Rücken',
  lats: 'Latissimus',
  lower_back: 'Unterer Rücken',
  glutes: 'Gesäß',
  quads: 'Oberschenkel vorne',
  hamstrings: 'Oberschenkel hinten',
  adductors: 'Innenschenkel',
  calves: 'Waden',
};

type Map = { primary: Muscle[]; secondary: Muscle[] };
const m = (primary: Muscle[], secondary: Muscle[] = []): Map => ({ primary, secondary });

export const EXERCISE_MUSCLES: Record<string, Map> = {
  goblet_squat: m(['quads', 'glutes'], ['adductors', 'abs', 'upper_back']),
  back_squat: m(['quads', 'glutes'], ['adductors', 'hamstrings', 'lower_back', 'abs']),
  leg_press: m(['quads', 'glutes'], ['adductors', 'hamstrings']),
  bodyweight_squat: m(['quads', 'glutes'], ['adductors', 'calves']),
  box_squat: m(['quads', 'glutes'], ['adductors', 'hamstrings']),
  romanian_deadlift: m(['hamstrings', 'glutes'], ['lower_back', 'forearms', 'upper_back']),
  deadlift: m(['glutes', 'hamstrings', 'lower_back'], ['quads', 'traps', 'upper_back', 'forearms', 'lats']),
  glute_bridge: m(['glutes'], ['hamstrings', 'abs']),
  kettlebell_swing: m(['glutes', 'hamstrings'], ['lower_back', 'abs', 'front_delts', 'forearms']),
  reverse_lunge: m(['quads', 'glutes'], ['hamstrings', 'adductors', 'calves']),
  bulgarian_split_squat: m(['quads', 'glutes'], ['hamstrings', 'adductors']),
  bench_press: m(['chest'], ['front_delts', 'triceps']),
  dumbbell_bench_press: m(['chest'], ['front_delts', 'triceps']),
  push_up: m(['chest', 'triceps'], ['front_delts', 'abs']),
  incline_push_up: m(['chest'], ['front_delts', 'triceps', 'abs']),
  band_chest_press: m(['chest'], ['front_delts', 'triceps']),
  overhead_press: m(['front_delts', 'side_delts'], ['triceps', 'traps', 'abs']),
  pike_push_up: m(['front_delts'], ['triceps', 'side_delts', 'chest']),
  band_overhead_press: m(['front_delts', 'side_delts'], ['triceps', 'traps']),
  lateral_raise: m(['side_delts'], ['traps']),
  dumbbell_row: m(['lats', 'upper_back'], ['biceps', 'rear_delts', 'forearms']),
  seated_cable_row: m(['upper_back', 'lats'], ['biceps', 'rear_delts', 'forearms']),
  inverted_row: m(['upper_back', 'lats'], ['biceps', 'rear_delts', 'abs']),
  band_row: m(['upper_back', 'lats'], ['biceps', 'rear_delts']),
  lat_pulldown: m(['lats'], ['biceps', 'upper_back', 'forearms']),
  pull_up: m(['lats'], ['biceps', 'upper_back', 'forearms', 'abs']),
  negative_pull_up: m(['lats'], ['biceps', 'upper_back', 'forearms']),
  band_pulldown: m(['lats'], ['biceps', 'upper_back']),
  prone_y_raise: m(['upper_back', 'rear_delts'], ['traps', 'lower_back']),
  biceps_curl: m(['biceps'], ['forearms']),
  triceps_extension: m(['triceps'], []),
  bench_dip: m(['triceps'], ['chest', 'front_delts']),
  plank: m(['abs'], ['obliques', 'front_delts', 'glutes']),
  dead_bug: m(['abs'], ['obliques']),
  side_plank: m(['obliques'], ['abs', 'side_delts', 'glutes']),
  hanging_knee_raise: m(['abs'], ['obliques', 'forearms', 'lats']),
  cat_cow: m([], ['lower_back', 'abs']),
  worlds_greatest_stretch: m([], ['hamstrings', 'glutes', 'adductors', 'upper_back']),
  hip_flexor_stretch: m([], ['quads', 'glutes']),
  thoracic_rotation: m([], ['upper_back', 'obliques']),
  band_pull_apart: m(['rear_delts', 'upper_back'], ['traps']),
};

export function musclesOf(exerciseId: string): Map {
  return EXERCISE_MUSCLES[exerciseId] ?? { primary: [], secondary: [] };
}

export type MuscleLevel = 'primary' | 'secondary' | 'none';
export type MuscleLoad = Record<Muscle, MuscleLevel>;

/** Zusammengefasste Beanspruchung mehrerer Übungen: direkt schlägt indirekt. */
export function muscleLoad(exerciseIds: string[]): MuscleLoad {
  const load = Object.fromEntries(MUSCLES.map((x) => [x, 'none'])) as MuscleLoad;
  for (const id of exerciseIds) {
    const { primary, secondary } = musclesOf(id);
    for (const x of secondary) if (load[x] === 'none') load[x] = 'secondary';
    for (const x of primary) load[x] = 'primary';
  }
  return load;
}

export const dayMuscleLoad = (day: Pick<PlanDay, 'exercises'>) => muscleLoad(day.exercises.map((e) => e.exerciseId));
export const planMuscleLoad = (plan: Pick<TrainingPlan, 'days'> | null) => muscleLoad((plan?.days ?? []).flatMap((d) => d.exercises.map((e) => e.exerciseId)));

export function musclesWith(load: MuscleLoad, level: MuscleLevel): Muscle[] {
  return MUSCLES.filter((x) => load[x] === level);
}

/**
 * Vorschläge für Muskeln, die noch gar nicht trainiert werden: Übungen, die möglichst viele davon
 * direkt treffen. `allowed` filtert nach Equipment und Einschränkungen.
 */
export function suggestForMissing(load: MuscleLoad, library: Exercise[], allowed: (e: Exercise) => boolean, exclude: Set<string>, limit = 4): { exercise: Exercise; covers: Muscle[] }[] {
  const missing = new Set(musclesWith(load, 'none'));
  if (missing.size === 0) return [];
  return library
    .filter((e) => allowed(e) && !exclude.has(e.id))
    .map((e) => ({ exercise: e, covers: musclesOf(e.id).primary.filter((x) => missing.has(x)) }))
    .filter((x) => x.covers.length > 0)
    .sort((a, b) => b.covers.length - a.covers.length || a.exercise.difficulty - b.exercise.difficulty || a.exercise.id.localeCompare(b.exercise.id))
    // Pro fehlendem Muskel nur ein Vorschlag, damit die Liste kurz bleibt.
    .filter((x, i, list) => list.findIndex((y) => y.covers[0] === x.covers[0]) === i)
    .slice(0, limit);
}
