import { addDays, isInWeek, startOfWeek, weekKey } from './dates';
import { getExercise } from '@/data/exercises';
import type { Experience, TrainingPlan, WorkoutSession, XpEvent } from './types';
import { getLevelProgress, totalVolumeKg, XP_REWARDS } from './xp';

// Quests, Achievements und Wochenstatistik als reine Funktionen.

export interface ProgressInput {
  sessions: WorkoutSession[];
  xpEvents: XpEvent[];
  plan: TrainingPlan | null;
  now: Date;
  /** Passt Quest-Ziele an die Erfahrung an. Ohne Angabe: Anfänger. */
  experience?: Experience;
  /** Beginn der Reise (Profil angelegt); Startzeitpunkt des ersten Kapitels. */
  startedAt?: string;
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

export type QuestState = 'locked' | 'active' | 'completed';

export interface QuestStatus {
  id: string;
  /** Eindeutig pro Woche bzw. Kapitel, wird für die XP-Vergabe genutzt. */
  rewardRef: string;
  title: string;
  description: string;
  /** Wie der Fortschritt gezählt wird. */
  condition: string;
  progress: number;
  target: number;
  rewardXp: number;
  completed: boolean;
  claimed: boolean;
  status: QuestState;
  startedAt: string | null;
  completedAt: string | null;
}

/** Abgeschlossene Plan-Einheiten: alle geplanten Sätze erledigt (laut Momentaufnahme, sonst laut aktuellem Plan). */
export function isFullWorkout(s: WorkoutSession, plan: TrainingPlan | null): boolean {
  if (s.exercises?.length) return s.exercises.every((e) => e.skipped ? false : e.completedSets >= e.plannedSets);
  const day = plan?.days.find((d) => d.id === s.planDayId);
  if (!day) return false;
  return s.sets.filter((x) => x.completed).length >= day.exercises.reduce((n, e) => n + e.sets, 0);
}

const pick = <T,>(experience: Experience | undefined, values: Record<Experience, T>) => values[experience ?? 'beginner'];

export function computeWeeklyQuests(input: ProgressInput): QuestStatus[] {
  const { sessions, plan, now, xpEvents, experience } = input;
  // Ohne Trainingsplan gibt es kein Wochenziel, also auch keine Wochenquests.
  if (!plan || plan.days.length === 0) return [];
  const week = summarizeWeek(sessions, plan, now);
  const inWeek = sessionsInWeek(sessions, week.weekStart);
  const key = weekKey(now);

  const fullWorkouts = inWeek.filter((s) => isFullWorkout(s, plan)).length;
  const mobilitySets = inWeek.reduce(
    (n, s) => n + s.sets.filter((x) => x.completed && getExercise(x.exerciseId)?.category === 'mobility').length,
    0,
  );
  const fullTarget = pick(experience, { beginner: 1, intermediate: 1, advanced: 2 });
  const mobilityTarget = pick(experience, { beginner: 2, intermediate: 4, advanced: 4 });

  const defs = [
    {
      id: 'weekly_workouts',
      title: `Wochenziel: ${week.goal} Trainings`,
      description: 'Erreiche dein persönliches Wochenziel aus dem Trainingsplan.',
      condition: 'Jedes abgeschlossene Training in dieser Kalenderwoche zählt. Das Ziel entspricht den Einheiten in deinem Plan, nicht mehr.',
      progress: week.workouts,
      target: week.goal,
      rewardXp: XP_REWARDS.weeklyGoal,
    },
    {
      id: 'weekly_full_workout',
      title: fullTarget === 1 ? 'Eine Einheit komplett' : `${fullTarget} Einheiten komplett`,
      description: 'Schließe alle geplanten Sätze einer Trainingseinheit ab.',
      condition: 'Zählt, wenn bei einer Einheit keine Übung übersprungen und jeder geplante Satz abgehakt wurde.',
      progress: fullWorkouts,
      target: fullTarget,
      rewardXp: 40,
    },
    {
      id: 'weekly_mobility',
      title: `${mobilityTarget} Mobilitätssätze`,
      description: 'Beweglichkeit schützt Gelenke und verbessert die Technik.',
      condition: 'Gezählt werden abgehakte Sätze von Mobilitätsübungen, z. B. Katze-Kuh oder Hüftbeuger-Dehnung.',
      progress: mobilitySets,
      target: mobilityTarget,
      rewardXp: 30,
    },
  ];

  return defs.map((d) => {
    const rewardRef = `${d.id}:${key}`;
    const event = xpEvents.find((e) => e.source === 'quest' && e.refId === rewardRef);
    const completed = d.progress >= d.target;
    return {
      ...d,
      progress: Math.min(d.progress, d.target),
      rewardRef,
      completed,
      claimed: !!event,
      status: completed ? 'completed' : 'active',
      startedAt: week.weekStart.toISOString(),
      completedAt: event?.createdAt ?? null,
    };
  });
}

// --- Quest-Kapitel (einmalig) --------------------------------------------------

export interface ChapterStep {
  id: string;
  title: string;
  progress: number;
  target: number;
  completed: boolean;
}

export interface ChapterStatus {
  id: string;
  title: string;
  description: string;
  steps: ChapterStep[];
  rewardXp: number;
  status: QuestState;
  claimed: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

interface ChapterFacts {
  hasPlan: boolean;
  workouts: number;
  fullWorkouts: number;
  lessons: number;
  goalWeeks: number;
  streak: number;
}

type StepDef = { id: string; title: (t: number) => string; value: (f: ChapterFacts) => number; target: Record<Experience, number> };
const same = (n: number): Record<Experience, number> => ({ beginner: n, intermediate: n, advanced: n });

export const CHAPTERS: { id: string; title: string; description: string; steps: StepDef[] }[] = [
  {
    id: 'chapter_1',
    title: 'Kapitel 1: Der Aufbruch',
    description: 'Erstelle deinen Plan, lerne eine Technik und absolviere dein erstes Training.',
    steps: [
      { id: 'plan', title: () => 'Eigenen Trainingsplan erstellen', value: (f) => (f.hasPlan ? 1 : 0), target: same(1) },
      { id: 'lesson', title: () => 'Eine Techniklektion abschließen', value: (f) => f.lessons, target: same(1) },
      { id: 'workout', title: () => 'Erste Trainingseinheit absolvieren', value: (f) => f.workouts, target: same(1) },
    ],
  },
  {
    id: 'chapter_2',
    title: 'Kapitel 2: Routine',
    description: 'Finde deinen Rhythmus, ohne mehr zu trainieren als geplant.',
    steps: [
      { id: 'goal_week', title: () => 'Einmal das Wochenziel erreichen', value: (f) => f.goalWeeks, target: same(1) },
      { id: 'workouts', title: (t) => `${t} Trainingseinheiten insgesamt`, value: (f) => f.workouts, target: { beginner: 4, intermediate: 6, advanced: 8 } },
      { id: 'lessons', title: (t) => `${t} Techniklektionen`, value: (f) => f.lessons, target: same(3) },
    ],
  },
  {
    id: 'chapter_3',
    title: 'Kapitel 3: Beständigkeit',
    description: 'Bleib dran: regelmäßig, vollständig und mit Erholung.',
    steps: [
      { id: 'streak', title: (t) => `Wochenziel ${t} Wochen in Folge`, value: (f) => f.streak, target: { beginner: 2, intermediate: 3, advanced: 3 } },
      { id: 'full', title: (t) => `${t} Einheiten komplett abschließen`, value: (f) => f.fullWorkouts, target: { beginner: 4, intermediate: 6, advanced: 8 } },
      { id: 'workouts', title: (t) => `${t} Trainingseinheiten insgesamt`, value: (f) => f.workouts, target: { beginner: 12, intermediate: 18, advanced: 24 } },
    ],
  },
  {
    id: 'chapter_4',
    title: 'Kapitel 4: Meisterschaft',
    description: 'Technik, Geduld und eine Routine, die hält.',
    steps: [
      { id: 'streak', title: (t) => `Wochenziel ${t} Wochen in Folge`, value: (f) => f.streak, target: { beginner: 4, intermediate: 6, advanced: 6 } },
      { id: 'lessons', title: (t) => `${t} Techniklektionen`, value: (f) => f.lessons, target: same(10) },
      { id: 'workouts', title: (t) => `${t} Trainingseinheiten insgesamt`, value: (f) => f.workouts, target: { beginner: 30, intermediate: 40, advanced: 50 } },
    ],
  },
];

/** Anzahl Kalenderwochen, in denen das Wochenziel erreicht wurde. */
function weeksWithGoal(sessions: WorkoutSession[], plan: TrainingPlan | null): number {
  if (!plan) return 0;
  const goal = weeklyGoal(plan);
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const k = weekKey(new Date(s.finishedAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.values()].filter((n) => n >= goal).length;
}

export function computeChapters(input: ProgressInput): ChapterStatus[] {
  const { sessions, plan, xpEvents, now, experience } = input;
  const facts: ChapterFacts = {
    hasPlan: !!plan && plan.days.length > 0,
    workouts: sessions.length,
    fullWorkouts: sessions.filter((s) => isFullWorkout(s, plan)).length,
    lessons: new Set(xpEvents.filter((e) => e.source === 'lesson').map((e) => e.refId)).size,
    goalWeeks: weeksWithGoal(sessions, plan),
    streak: plan ? weeklyStreak(sessions, plan, now) : 0,
  };
  const result: ChapterStatus[] = [];
  let previousDone = true;
  let previousCompletedAt: string | null = input.startedAt ?? null;
  for (const c of CHAPTERS) {
    const steps = c.steps.map((st) => {
      const target = pick(experience, st.target);
      const value = st.value(facts);
      return { id: st.id, title: st.title(target), progress: Math.min(value, target), target, completed: value >= target };
    });
    const event = xpEvents.find((e) => e.source === 'chapter' && e.refId === c.id);
    const done: boolean = !!event || (previousDone && steps.every((x) => x.completed));
    const status: QuestState = !previousDone ? 'locked' : done ? 'completed' : 'active';
    result.push({
      id: c.id,
      title: c.title,
      description: c.description,
      steps,
      rewardXp: XP_REWARDS.chapter,
      status,
      claimed: !!event,
      startedAt: previousDone ? previousCompletedAt : null,
      completedAt: event?.createdAt ?? null,
    });
    previousDone = done;
    previousCompletedAt = event?.createdAt ?? (done ? now.toISOString() : null);
  }
  return result;
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
  { id: 'first_workout', title: 'Erster Schritt', description: 'Schließe dein erstes Training ab.', rewardXp: XP_REWARDS.milestone, icon: 'star' },
  { id: 'workouts_10', title: 'Gewohnheit', description: 'Schließe 10 Trainings ab.', rewardXp: XP_REWARDS.milestone, icon: 'dumbbell' },
  { id: 'workouts_50', title: 'Eisern', description: 'Schließe 50 Trainings ab.', rewardXp: XP_REWARDS.milestone, icon: 'dumbbell' },
  { id: 'workouts_100', title: 'Hundert', description: 'Schließe 100 Trainings ab.', rewardXp: XP_REWARDS.milestone, icon: 'trophy' },
  { id: 'sets_100', title: 'Satz für Satz', description: 'Protokolliere 100 Sätze.', rewardXp: XP_REWARDS.milestone, icon: 'medal' },
  { id: 'sets_1000', title: 'Tausend Sätze', description: 'Protokolliere 1.000 Sätze.', rewardXp: XP_REWARDS.milestone, icon: 'medal' },
  { id: 'volume_10k', title: 'Schwergewicht', description: 'Bewege insgesamt 10.000 kg.', rewardXp: XP_REWARDS.milestone, icon: 'trophy' },
  { id: 'week_goal', title: 'Wochenheld', description: 'Erreiche einmal dein Wochenziel.', rewardXp: XP_REWARDS.milestone, icon: 'flame' },
  { id: 'streak_4', title: 'Vier Wochen stark', description: 'Erreiche dein Wochenziel 4 Wochen in Folge.', rewardXp: XP_REWARDS.milestone, icon: 'flame' },
  { id: 'early_bird', title: 'Frühaufsteher', description: 'Beende ein Training vor 8 Uhr.', rewardXp: XP_REWARDS.milestone, icon: 'sunrise' },
  { id: 'night_owl', title: 'Nachteule', description: 'Beende ein Training nach 21 Uhr.', rewardXp: XP_REWARDS.milestone, icon: 'moon' },
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
    for (const c of computeChapters(state)) {
      if (c.status === 'completed' && !c.claimed) {
        fresh.push({ id: createId(), source: 'chapter', refId: c.id, amount: c.rewardXp, createdAt: input.now.toISOString(), label: `Quest-Kapitel: ${c.title.replace(/^Kapitel \d+: /, '')}` });
      }
    }
    for (const a of computeAchievements(state)) {
      if (a.unlocked && !a.unlockedAt) {
        fresh.push({ id: createId(), source: 'achievement', refId: a.id, amount: a.rewardXp, createdAt: input.now.toISOString(), label: `Erfolg: ${a.title}` });
      }
    }
    if (fresh.length === 0) break;
    created.push(...fresh);
  }
  return created;
}
