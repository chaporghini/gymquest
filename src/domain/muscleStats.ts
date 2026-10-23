import { addDays, startOfWeek } from './dates';
import { MUSCLES, musclesOf, type Muscle, type MuscleLoad } from './muscles';
import type { PlanDay, TrainingPlan, WorkoutSession } from './types';

// Arbeitssätze je Muskel. Direkte Sätze (Muskel ist Hauptmuskel der Übung) werden getrennt von
// indirekter Beteiligung gezählt: ein Satz Bankdrücken ist ein direkter Satz für die Brust, für den
// Trizeps nur eine indirekte Beteiligung. Die Werte beschreiben Planung bzw. Historie, keine Messung
// von Muskelaktivität oder -entwicklung.

export interface MuscleSets {
  direct: number;
  indirect: number;
}

export type MuscleSetMap = Record<Muscle, MuscleSets>;

const emptyMap = (): MuscleSetMap => Object.fromEntries(MUSCLES.map((m) => [m, { direct: 0, indirect: 0 }])) as MuscleSetMap;

function addSets(map: MuscleSetMap, exerciseId: string, sets: number) {
  const { primary, secondary } = musclesOf(exerciseId);
  for (const m of primary) map[m].direct += sets;
  for (const m of secondary) if (!primary.includes(m)) map[m].indirect += sets;
}

/** Geplante Sätze pro Woche aus dem Trainingsplan. */
export function plannedMuscleSets(plan: Pick<TrainingPlan, 'days'> | null): MuscleSetMap {
  const map = emptyMap();
  for (const d of plan?.days ?? []) for (const e of d.exercises) addSets(map, e.exerciseId, e.sets);
  return map;
}

export function dayMuscleSets(day: Pick<PlanDay, 'exercises'>): MuscleSetMap {
  const map = emptyMap();
  for (const e of day.exercises) addSets(map, e.exerciseId, e.sets);
  return map;
}

/** Tatsächlich abgehakte Sätze im Zeitraum [from, to). */
export function doneMuscleSets(sessions: WorkoutSession[], from: Date, to: Date): MuscleSetMap {
  const map = emptyMap();
  for (const s of sessions) {
    const t = new Date(s.finishedAt).getTime();
    if (t < from.getTime() || t >= to.getTime()) continue;
    for (const set of s.sets) if (set.completed) addSets(map, set.exerciseId, 1);
  }
  return map;
}

/** Farbstufe für die Körperkarte: direkt > indirekt > nicht beansprucht. */
export function loadFromSets(map: MuscleSetMap): MuscleLoad {
  return Object.fromEntries(MUSCLES.map((m) => [m, map[m].direct > 0 ? 'primary' : map[m].indirect > 0 ? 'secondary' : 'none'])) as MuscleLoad;
}

export const hasAnySets = (map: MuscleSetMap) => MUSCLES.some((m) => map[m].direct > 0 || map[m].indirect > 0);

export type MapMode = 'planned' | 'done' | 'week';

export const MAP_MODE_LABELS: Record<MapMode, string> = {
  planned: 'Geplant',
  done: 'Absolviert (4 Wochen)',
  week: 'Diese Woche',
};

/** Sätze je Muskel für die drei Ansichten der Karte. */
export function muscleSetsFor(mode: MapMode, plan: TrainingPlan | null, sessions: WorkoutSession[], now: Date): MuscleSetMap {
  if (mode === 'planned') return plannedMuscleSets(plan);
  const weekStart = startOfWeek(now);
  if (mode === 'week') return doneMuscleSets(sessions, weekStart, addDays(weekStart, 7));
  return doneMuscleSets(sessions, addDays(weekStart, -21), addDays(weekStart, 7));
}

export interface MuscleExercise {
  exerciseId: string;
  role: 'primary' | 'secondary';
  /** Geplante Sätze pro Woche */
  sets: number;
  weekdays: number[];
}

export interface MuscleDetail {
  muscle: Muscle;
  exercises: MuscleExercise[];
  planned: MuscleSets;
  thisWeek: MuscleSets;
  /** Wochentage mit direkter oder indirekter Beanspruchung im Plan */
  weekdays: number[];
  /** Abgehakte Sätze der letzten Wochen, älteste zuerst */
  history: { weekStart: Date; direct: number; indirect: number }[];
}

export function muscleDetail(muscle: Muscle, plan: TrainingPlan | null, sessions: WorkoutSession[], now: Date, weeks = 6): MuscleDetail {
  const byExercise = new Map<string, MuscleExercise>();
  for (const d of plan?.days ?? []) {
    for (const e of d.exercises) {
      const { primary, secondary } = musclesOf(e.exerciseId);
      const role = primary.includes(muscle) ? 'primary' : secondary.includes(muscle) ? 'secondary' : null;
      if (!role) continue;
      const entry = byExercise.get(e.exerciseId) ?? { exerciseId: e.exerciseId, role, sets: 0, weekdays: [] };
      entry.sets += e.sets;
      if (!entry.weekdays.includes(d.weekday)) entry.weekdays.push(d.weekday);
      byExercise.set(e.exerciseId, entry);
    }
  }
  const exercises = [...byExercise.values()].sort((a, b) => (a.role === b.role ? b.sets - a.sets : a.role === 'primary' ? -1 : 1));
  const weekStart = startOfWeek(now);
  const history = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(weekStart, -7 * (weeks - 1 - i));
    const sets = doneMuscleSets(sessions, start, addDays(start, 7))[muscle];
    return { weekStart: start, ...sets };
  });
  return {
    muscle,
    exercises,
    planned: plannedMuscleSets(plan)[muscle],
    thisWeek: doneMuscleSets(sessions, weekStart, addDays(weekStart, 7))[muscle],
    weekdays: [...new Set(exercises.flatMap((e) => e.weekdays))].sort((a, b) => a - b),
    history,
  };
}

/** Hauptmuskeln des letzten Trainings, z. B. für „Zuletzt trainiert“ auf Home. */
export function lastTrainedMuscles(sessions: WorkoutSession[]): { session: WorkoutSession; muscles: Muscle[] } | null {
  const last = [...sessions].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
  if (!last) return null;
  const map = doneMuscleSets([last], new Date(0), new Date(8.64e15));
  const muscles = MUSCLES.filter((m) => map[m].direct > 0).sort((a, b) => map[b].direct - map[a].direct);
  return { session: last, muscles };
}

/** Verteilung direkter Sätze im Zeitraum, absteigend. Muskeln ohne Sätze bleiben drin (Wert 0). */
export function muscleDistribution(sessions: WorkoutSession[], from: Date, to: Date): { muscle: Muscle; direct: number; indirect: number }[] {
  const map = doneMuscleSets(sessions, from, to);
  return MUSCLES.map((m) => ({ muscle: m, ...map[m] })).sort((a, b) => b.direct - a.direct || b.indirect - a.indirect);
}
