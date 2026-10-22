import { addDays, isInWeek, startOfWeek, weekKey } from './dates';
import { getExercise } from '@/data/exercises';
import type { TrainingPlan, WorkoutSession, XpEvent } from './types';
import { getLevelProgress, totalVolumeKg } from './xp';

// Quests, Achievements und Wochenstatistik als reine Funktionen.

export interface ProgressInput {
  sessions: WorkoutSession[];
  xpEvents: XpEvent[];
  plan: TrainingPlan | null;
  now: Date;
}

// --- Wochenstatistik --------------------------------------------------------

export interface WeekSummary {
  weekStart: Date;
  workouts: number;
  sets: number;
  minutes: number;
  goal: number;
}

export function weeklyGoal(plan: TrainingPlan | null): number {
  return plan?.days.length ?? 3;
}

export function sessionsInWeek(sessions: WorkoutSession[], weekStart: Date): WorkoutSession[] {
  return sessions.filter((s) => isInWeek(new Date(s.finishedAt), weekStart));
}

export function summarizeWeek(sessions: WorkoutSession[], plan: TrainingPlan | null, date: Date): WeekSummary {
  const weekStart = startOfWeek(date);
  const inWeek = sessionsInWeek(sessions, weekStart);
  return {
    weekStart,
    workouts: inWeek.length,
    sets: inWeek.reduce((n, s) => n + s.sets.filter((x) => x.completed).length, 0),
    minutes: Math.round(inWeek.reduce((n, s) => n + s.durationSec, 0) / 60),
    goal: weeklyGoal(plan),
  };
}

/** Anzahl aufeinanderfolgender Wochen mit erreichtem Wochenziel. Die laufende Woche zählt nur, wenn sie bereits erfüllt ist. */
export function weeklyStreak(sessions: WorkoutSession[], plan: TrainingPlan | null, now: Date): number {
  const goal = weeklyGoal(plan);
  let streak = 0;
  let week = startOfWeek(now);
  if (sessionsInWeek(sessions, week).length < goal) week = addDays(week, -7);
  while (sessionsInWeek(sessions, week).length >= goal && streak < 520) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

// --- Quests -----------------------------------------------------------------

export interface QuestStatus {
  id: string;
  /** Eindeutig pro Woche, wird für die XP-Vergabe genutzt. */
  rewardRef: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardXp: number;
  completed: boolean;
  claimed: boolean;
}

export function computeWeeklyQuests(input: ProgressInput): QuestStatus[] {
  const { sessions, plan, now, xpEvents } = input;
  const week = summarizeWeek(sessions, plan, now);
  const inWeek = sessionsInWeek(sessions, week.weekStart);
  const key = weekKey(now);

  const fullWorkouts = inWeek.filter((s) => {
    const day = plan?.days.find((d) => d.id === s.planDayId);
    if (!day) return false;
    const planned = day.exercises.reduce((n, e) => n + e.sets, 0);
    return s.sets.filter((x) => x.completed).length >= planned;
  }).length;

  const mobilitySets = inWeek.reduce(
    (n, s) => n + s.sets.filter((x) => x.completed && getExercise(x.exerciseId)?.category === 'mobility').length,
    0,
  );

  const setTarget = Math.max(20, week.goal * 10);
  const defs: Omit<QuestStatus, 'completed' | 'claimed' | 'rewardRef'>[] = [
    {
      id: 'weekly_workouts',
      title: `${week.goal} Trainings diese Woche`,
      description: 'Erreiche dein Wochenziel aus dem Trainingsplan.',
      progress: week.workouts,
      target: week.goal,
      rewardXp: 100,
    },
    {
      id: 'weekly_sets',
      title: `${setTarget} Sätze protokollieren`,
      description: 'Jeder abgeschlossene Satz zählt.',
      progress: week.sets,
      target: setTarget,
      rewardXp: 60,
    },
    {
      id: 'weekly_full_workout',
      title: 'Ein Plantraining komplett',
      description: 'Schließe alle geplanten Sätze einer Trainingseinheit ab.',
      progress: fullWorkouts,
      target: 1,
      rewardXp: 40,
    },
    {
      id: 'weekly_mobility',
      title: '4 Mobilitätssätze',
      description: 'Beweglichkeit schützt Gelenke und verbessert die Technik.',
      progress: mobilitySets,
      target: 4,
      rewardXp: 30,
    },
  ];

  return defs.map((d) => {
    const rewardRef = `${d.id}:${key}`;
    return {
      ...d,
      progress: Math.min(d.progress, d.target),
      rewardRef,
      completed: d.progress >= d.target,
      claimed: xpEvents.some((e) => e.source === 'quest' && e.refId === rewardRef),
    };
  });
}

// --- Achievements -----------------------------------------------------------

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardXp: number;
  icon: 'trophy' | 'flame' | 'dumbbell' | 'star' | 'sunrise' | 'moon' | 'medal';
}

export interface AchievementStatus extends AchievementDef {
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  target: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_workout', title: 'Erster Schritt', description: 'Schließe dein erstes Training ab.', rewardXp: 50, icon: 'star' },
  { id: 'workouts_10', title: 'Gewohnheit', description: 'Schließe 10 Trainings ab.', rewardXp: 75, icon: 'dumbbell' },
  { id: 'workouts_50', title: 'Eisern', description: 'Schließe 50 Trainings ab.', rewardXp: 150, icon: 'dumbbell' },
  { id: 'workouts_100', title: 'Hundert', description: 'Schließe 100 Trainings ab.', rewardXp: 250, icon: 'trophy' },
  { id: 'sets_100', title: 'Satz für Satz', description: 'Protokolliere 100 Sätze.', rewardXp: 50, icon: 'medal' },
  { id: 'sets_1000', title: 'Tausend Sätze', description: 'Protokolliere 1.000 Sätze.', rewardXp: 200, icon: 'medal' },
  { id: 'volume_10k', title: 'Schwergewicht', description: 'Bewege insgesamt 10.000 kg.', rewardXp: 100, icon: 'trophy' },
  { id: 'week_goal', title: 'Wochenheld', description: 'Erreiche einmal dein Wochenziel.', rewardXp: 50, icon: 'flame' },
  { id: 'streak_4', title: 'Vier Wochen stark', description: 'Erreiche dein Wochenziel 4 Wochen in Folge.', rewardXp: 150, icon: 'flame' },
  { id: 'early_bird', title: 'Frühaufsteher', description: 'Beende ein Training vor 8 Uhr.', rewardXp: 25, icon: 'sunrise' },
  { id: 'night_owl', title: 'Nachteule', description: 'Beende ein Training nach 21 Uhr.', rewardXp: 25, icon: 'moon' },
  { id: 'level_5', title: 'Level 5', description: 'Erreiche Level 5.', rewardXp: 0, icon: 'star' },
  { id: 'level_10', title: 'Level 10', description: 'Erreiche Level 10.', rewardXp: 0, icon: 'star' },
];

export function computeAchievements(input: ProgressInput): AchievementStatus[] {
  const { sessions, xpEvents, plan, now } = input;
  const workouts = sessions.length;
  const sets = sessions.reduce((n, s) => n + s.sets.filter((x) => x.completed).length, 0);
  const volume = totalVolumeKg(sessions);
  const streak = weeklyStreak(sessions, plan, now);
  const level = getLevelProgress(xpEvents.reduce((n, e) => n + e.amount, 0)).level;
  const hours = sessions.map((s) => new Date(s.finishedAt).getHours());

  const progressFor: Record<string, [number, number]> = {
    first_workout: [workouts, 1],
    workouts_10: [workouts, 10],
    workouts_50: [workouts, 50],
    workouts_100: [workouts, 100],
    sets_100: [sets, 100],
    sets_1000: [sets, 1000],
    volume_10k: [volume, 10000],
    week_goal: [streak > 0 || summarizeWeek(sessions, plan, now).workouts >= weeklyGoal(plan) ? 1 : 0, 1],
    streak_4: [streak, 4],
    early_bird: [hours.some((h) => h < 8) ? 1 : 0, 1],
    night_owl: [hours.some((h) => h >= 21) ? 1 : 0, 1],
    level_5: [level, 5],
    level_10: [level, 10],
  };

  return ACHIEVEMENTS.map((a) => {
    const [progress, target] = progressFor[a.id] ?? [0, 1];
    const event = xpEvents.find((e) => e.source === 'achievement' && e.refId === a.id);
    return {
      ...a,
      progress: Math.min(progress, target),
      target,
      unlocked: !!event || progress >= target,
      unlockedAt: event?.createdAt ?? null,
    };
  });
}

/**
 * Liefert alle Belohnungen, die noch nicht verbucht wurden.
 * Läuft mehrfach, weil Achievement-XP neue Level-Achievements auslösen können.
 */
export function collectPendingRewards(input: ProgressInput, createId: () => string): XpEvent[] {
  const created: XpEvent[] = [];
  for (let round = 0; round < 5; round++) {
    const state = { ...input, xpEvents: [...input.xpEvents, ...created] };
    const fresh: XpEvent[] = [];
    for (const q of computeWeeklyQuests(state)) {
      if (q.completed && !q.claimed) {
        fresh.push({ id: createId(), source: 'quest', refId: q.rewardRef, amount: q.rewardXp, createdAt: input.now.toISOString(), label: `Quest: ${q.title}` });
      }
    }
    for (const a of computeAchievements(state)) {
      if (a.unlocked && !a.unlockedAt) {
        fresh.push({ id: createId(), source: 'achievement', refId: a.id, amount: a.rewardXp, createdAt: input.now.toISOString(), label: `Achievement: ${a.title}` });
      }
    }
    if (fresh.length === 0) break;
    created.push(...fresh);
  }
  return created;
}
