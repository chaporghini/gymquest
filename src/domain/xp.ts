import type { SetLog, WorkoutSession } from './types';

export const MAX_LEVEL = 100;

/** XP, die man braucht, um von `level` auf `level + 1` zu kommen. */
export function xpToNextLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

/** Gesamt-XP, die nötig ist, um `level` zu erreichen (Level 1 = 0 XP). */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNextLevel(l);
  return total;
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

// --- Training-XP -------------------------------------------------------------

export const XP_RULES = {
  base: 40,
  perSet: 4,
  /** Mehr Sätze bringen keine zusätzlichen XP – Volumen um jeden Preis wird nicht belohnt. */
  maxCountedSets: 30,
  completionBonus: 20,
  /** Ein Training gilt erst ab so vielen Sätzen als vollwertig. */
  minSetsForWorkout: 3,
  /** Ab dem zweiten Training am selben Tag gibt es nur noch diesen Anteil. */
  repeatSameDayFactor: 0.25,
} as const;

export interface WorkoutXpBreakdown {
  base: number;
  sets: number;
  completion: number;
  sameDayPenalty: number;
  total: number;
  completedSets: number;
  plannedSets: number;
}

export function countCompletedSets(sets: SetLog[]): number {
  return sets.filter((s) => s.completed).length;
}

/**
 * Berechnet die XP eines abgeschlossenen Trainings.
 * @param workoutsEarlierSameDay Anzahl bereits abgeschlossener Trainings am selben Kalendertag.
 */
export function calculateWorkoutXp(
  sets: SetLog[],
  plannedSets: number,
  workoutsEarlierSameDay = 0,
): WorkoutXpBreakdown {
  const completedSets = countCompletedSets(sets);
  if (completedSets < XP_RULES.minSetsForWorkout) {
    return { base: 0, sets: completedSets * XP_RULES.perSet, completion: 0, sameDayPenalty: 0, total: completedSets * XP_RULES.perSet, completedSets, plannedSets };
  }
  const base = XP_RULES.base;
  const setXp = Math.min(completedSets, XP_RULES.maxCountedSets) * XP_RULES.perSet;
  const completion = plannedSets > 0 && completedSets >= plannedSets ? XP_RULES.completionBonus : 0;
  const raw = base + setXp + completion;
  const total = workoutsEarlierSameDay > 0 ? Math.round(raw * XP_RULES.repeatSameDayFactor) : raw;
  return { base, sets: setXp, completion, sameDayPenalty: total - raw, total, completedSets, plannedSets };
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
