import type { SetLog, WorkoutSession } from './types';

export const MAX_LEVEL = 100;

/**
 * Kumulative XP-Schwelle für `level`: XP(L) = 100 × (L − 1) + 25 × (L − 1)².
 * Level 1 = 0 XP, Level 2 = 125 XP, Level 3 = 300 XP.
 */
export function totalXpForLevel(level: number): number {
  const n = Math.max(0, level - 1);
  return 100 * n + 25 * n * n;
}

/** XP, die man braucht, um von `level` auf `level + 1` zu kommen. */
export function xpToNextLevel(level: number): number {
  return totalXpForLevel(level + 1) - totalXpForLevel(level);
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  /** XP innerhalb des aktuellen Levels */
  xpIntoLevel: number;
  /** XP, die das aktuelle Level insgesamt umfasst */
  xpForLevel: number;
  xpRemaining: number;
  /** 0–1 */
  progress: number;
  isMaxLevel: boolean;
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let floor = 0;
  while (level < MAX_LEVEL && xp >= floor + xpToNextLevel(level)) {
    floor += xpToNextLevel(level);
    level++;
  }
  if (level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, totalXp: xp, xpIntoLevel: 0, xpForLevel: 0, xpRemaining: 0, progress: 1, isMaxLevel: true };
  }
  const xpForLevel = xpToNextLevel(level);
  const xpIntoLevel = xp - floor;
  return {
    level,
    totalXp: xp,
    xpIntoLevel,
    xpForLevel,
    xpRemaining: xpForLevel - xpIntoLevel,
    progress: xpIntoLevel / xpForLevel,
    isMaxLevel: false,
  };
}

// --- XP-Werte ----------------------------------------------------------------

/** Konfigurierbare Startwerte. Jede Vergabe wird als XpEvent mit eindeutiger Referenz gespeichert. */
export const XP_REWARDS = {
  workout: 60,
  exercise: 10,
  weeklyGoal: 100,
  lesson: 20,
  milestone: 30,
  chapter: 150,
} as const;

export const XP_RULES = {
  /** Ein Training gilt erst ab so vielen abgeschlossenen Sätzen als Trainingseinheit. */
  minSetsForWorkout: 3,
  /** Mehr Übungen bringen keine zusätzlichen XP – Volumen um jeden Preis wird nicht belohnt. */
  maxCountedExercises: 10,
  /** Ab dem zweiten Training am selben Tag gibt es nur noch diesen Anteil. */
  repeatSameDayFactor: 0.25,
} as const;

export interface WorkoutXpBreakdown {
  base: number;
  exercises: number;
  completedExercises: number;
  sameDayPenalty: number;
  total: number;
  completedSets: number;
  plannedSets: number;
}

export function countCompletedSets(sets: SetLog[]): number {
  return sets.filter((s) => s.completed).length;
}

/** Eine Übung im Training: wie viele Sätze geplant und wie viele erledigt wurden. */
export interface ExerciseResult {
  plannedSets: number;
  completedSets: number;
}

/** Eine Übung gilt als abgeschlossen, wenn alle geplanten Sätze erledigt sind. */
export const isExerciseCompleted = (e: ExerciseResult) => e.plannedSets > 0 && e.completedSets >= e.plannedSets;

/**
 * XP eines abgeschlossenen Trainings: 60 XP für die Einheit (ab 3 Sätzen) plus 10 XP je abgeschlossener Übung.
 * @param workoutsEarlierSameDay Anzahl bereits abgeschlossener Trainings am selben Kalendertag.
 */
export function calculateWorkoutXp(exercises: ExerciseResult[], workoutsEarlierSameDay = 0): WorkoutXpBreakdown {
  const completedSets = exercises.reduce((n, e) => n + e.completedSets, 0);
  const plannedSets = exercises.reduce((n, e) => n + e.plannedSets, 0);
  const completedExercises = exercises.filter(isExerciseCompleted).length;
  if (completedSets < XP_RULES.minSetsForWorkout) {
    return { base: 0, exercises: 0, completedExercises, sameDayPenalty: 0, total: 0, completedSets, plannedSets };
  }
  const base = XP_REWARDS.workout;
  const exerciseXp = Math.min(completedExercises, XP_RULES.maxCountedExercises) * XP_REWARDS.exercise;
  const raw = base + exerciseXp;
  const total = workoutsEarlierSameDay > 0 ? Math.round(raw * XP_RULES.repeatSameDayFactor) : raw;
  return { base, exercises: exerciseXp, completedExercises, sameDayPenalty: total - raw, total, completedSets, plannedSets };
}

export function totalVolumeKg(sessions: Pick<WorkoutSession, 'sets'>[]): number {
  let volume = 0;
  for (const s of sessions) {
    for (const set of s.sets) {
      if (set.completed && set.reps && set.weightKg) volume += set.reps * set.weightKg;
    }
  }
  return Math.round(volume);
}
