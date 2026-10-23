import { collectPendingRewards, computeAchievements, computeWeeklyQuests, summarizeWeek, weeklyStreak } from '../progression';
import { finishWorkout, createActiveWorkout, getNextSession } from '../workout';
import type { PlanDay, TrainingPlan, WorkoutSession, XpEvent } from '../types';

const day = (id: string, weekday: number): PlanDay => ({
  id,
  name: id,
  weekday,
  focus: '',
  exercises: [
    { exerciseId: 'goblet_squat', sets: 2, repsMin: 8, repsMax: 12, restSec: 60 },
    { exerciseId: 'cat_cow', sets: 2, repsMin: 0, repsMax: 0, durationSec: 45, restSec: 30 },
  ],
});

const plan: TrainingPlan = { id: 'p', name: 'Test', createdAt: '', split: 'Ganzkörper', days: [day('a', 0), day('b', 2), day('c', 4)] };

// Donnerstag, 22.10.2026, 10:00 Ortszeit
const thursday = new Date(2026, 9, 22, 10, 0, 0);

function session(id: string, planDayId: string | null, finished: Date, setsDone = 4): WorkoutSession {
  return {
    id,
    planDayId,
    name: id,
    startedAt: new Date(finished.getTime() - 3600_000).toISOString(),
    finishedAt: finished.toISOString(),
    durationSec: 3600,
    xpEarned: 0,
    sets: [
      ...Array.from({ length: Math.min(2, setsDone) }, (_, i) => ({ exerciseId: 'goblet_squat', setIndex: i, reps: 10, weightKg: 20, durationSec: null, completed: true })),
      ...Array.from({ length: Math.max(0, setsDone - 2) }, (_, i) => ({ exerciseId: 'cat_cow', setIndex: i, reps: null, weightKg: null, durationSec: 45, completed: true })),
    ],
  };
}

let n = 0;
const id = () => `x${n++}`;

describe('Wochenübersicht', () => {
  it('zählt Trainings und Sätze der laufenden Woche', () => {
    const sessions = [session('1', 'a', new Date(2026, 9, 19, 18)), session('old', 'a', new Date(2026, 9, 12, 18))];
    const s = summarizeWeek(sessions, plan, thursday);
    expect(s.workouts).toBe(1);
    expect(s.sets).toBe(4);
    expect(s.goal).toBe(3);
  });

  it('berechnet die Serie erfüllter Wochen', () => {
    const sessions = [
      // Woche davor: 3 Trainings
      session('1', 'a', new Date(2026, 9, 12, 18)),
      session('2', 'b', new Date(2026, 9, 14, 18)),
      session('3', 'c', new Date(2026, 9, 16, 18)),
      // laufende Woche: 1 Training
      session('4', 'a', new Date(2026, 9, 19, 18)),
    ];
    expect(weeklyStreak(sessions, plan, thursday)).toBe(1);
  });
});

describe('Nächste Einheit', () => {
  it('liefert die nächste offene Einheit ab heute', () => {
    const next = getNextSession(plan, [session('1', 'a', new Date(2026, 9, 19, 18))], thursday);
    expect(next?.day.id).toBe('c');
    expect(next?.isToday).toBe(false);
  });

  it('bietet verpasste Einheiten an, wenn danach nichts mehr geplant ist', () => {
    const saturday = new Date(2026, 9, 24, 10);
    const next = getNextSession(plan, [session('1', 'a', new Date(2026, 9, 19, 18))], saturday);
    expect(next?.day.id).toBe('b');
    expect(next?.isToday).toBe(true);
  });

  it('springt in die nächste Woche, wenn alles erledigt ist', () => {
    const sessions = ['a', 'b', 'c'].map((d, i) => session(d, d, new Date(2026, 9, 19 + i, 18)));
    const next = getNextSession(plan, sessions, thursday);
    expect(next?.nextWeek).toBe(true);
    expect(next?.day.id).toBe('a');
  });

  it('liefert null ohne Plan', () => {
    expect(getNextSession(null, [], thursday)).toBeNull();
  });
});

describe('Quests und Achievements', () => {
  it('erkennt abgeschlossene Wochenquests und vergibt XP nur einmal', () => {
    const sessions = [session('1', 'a', new Date(2026, 9, 19, 18))];
    const quests = computeWeeklyQuests({ sessions, xpEvents: [], plan, now: thursday });
    expect(quests.find((q) => q.id === 'weekly_full_workout')?.completed).toBe(true);
    expect(quests.find((q) => q.id === 'weekly_workouts')?.completed).toBe(false);

    const rewards = collectPendingRewards({ sessions, xpEvents: [], plan, now: thursday }, id);
    const refs = rewards.map((r) => r.refId);
    expect(refs).toContain('weekly_full_workout:2026-W43');
    expect(refs).toContain('first_workout');

    const again = collectPendingRewards({ sessions, xpEvents: rewards, plan, now: thursday }, id);
    expect(again).toEqual([]);
  });

  it('schaltet Level-Achievements über Achievement-XP frei', () => {
    // 760 + 40 (Quest) + 30 (Meilenstein erstes Training) = 830 XP ≥ 800 XP für Level 5
    const xpEvents: XpEvent[] = [{ id: 'w', source: 'workout', refId: 'w', amount: 760, createdAt: '', label: '' }];
    const rewards = collectPendingRewards({ sessions: [session('1', 'a', new Date(2026, 9, 19, 18))], xpEvents, plan, now: thursday }, id);
    expect(rewards.map((r) => r.refId)).toContain('level_5');
  });

  it('zeigt Fortschritt für gesperrte Achievements', () => {
    const list = computeAchievements({ sessions: [], xpEvents: [], plan, now: thursday });
    const ten = list.find((a) => a.id === 'workouts_10')!;
    expect(ten.unlocked).toBe(false);
    expect(ten.progress).toBe(0);
    expect(ten.target).toBe(10);
  });
});

describe('Trainingsablauf', () => {
  it('erstellt Sätze aus dem Plan und übernimmt Werte vom letzten Mal', () => {
    const w = createActiveWorkout(plan.days[0], 'w1', thursday, {
      goblet_squat: [{ exerciseId: 'goblet_squat', setIndex: 0, reps: 9, weightKg: 24, durationSec: null, completed: true }],
    });
    expect(w.exercises[0].sets).toHaveLength(2);
    expect(w.exercises[0].sets[0].weightKg).toBe(24);
    expect(w.exercises[0].sets[0].reps).toBe(9);
    expect(w.exercises[0].sets[1].reps).toBe(12);
    expect(w.exercises[1].sets[0].durationSec).toBe(45);
  });

  it('speichert nur abgeschlossene Sätze und berechnet XP', () => {
    const w = createActiveWorkout(plan.days[0], 'w1', thursday);
    w.exercises[0].sets.forEach((s) => (s.completed = true));
    w.exercises[1].sets[0].completed = true;
    const end = new Date(thursday.getTime() + 40 * 60_000);
    const { session: s, xp } = finishWorkout(w, [], end);
    expect(s.sets).toHaveLength(3);
    expect(s.durationSec).toBe(2400);
    expect(xp.total).toBe(s.xpEarned);
    expect(xp.completedExercises).toBe(1);
    expect(s.exercises?.map((e) => e.completedSets)).toEqual([2, 1]);
  });
});
