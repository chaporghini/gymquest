import { getGreeting } from '../greeting';
import { getWeekOverview } from '../weekPlan';
import type { TrainingPlan, WorkoutSession } from '../types';

const ctx = { name: 'Alex', date: new Date(2026, 9, 22), hasSessions: true, hasActiveWorkout: false, trainingToday: false, trainedToday: false, openQuests: 0 };

describe('Begrüßung', () => {
  it('nutzt den Spielernamen', () => {
    expect(getGreeting(ctx).title).toBe('Willkommen zurück, Alex.');
    expect(getGreeting({ ...ctx, hasSessions: false }).title).toBe('Willkommen, Alex.');
    expect(getGreeting({ ...ctx, name: '  ' }).title).toContain('Abenteurer');
  });

  it('bleibt am selben Tag gleich und wechselt über die Tage', () => {
    const a = getGreeting({ ...ctx, trainingToday: true });
    expect(getGreeting({ ...ctx, trainingToday: true, date: new Date(2026, 9, 22, 20) })).toEqual(a);
    const week = new Set(Array.from({ length: 7 }, (_, i) => getGreeting({ ...ctx, trainingToday: true, date: new Date(2026, 9, 22 + i) }).subtitle));
    expect(week.size).toBeGreaterThan(1);
  });

  it('passt zur Situation', () => {
    expect(getGreeting({ ...ctx, hasActiveWorkout: true }).subtitle).toContain('Training läuft');
    expect(getGreeting(ctx).subtitle).toMatch(/Ruhetag|Erholung|Kein Training/);
    expect(getGreeting({ ...ctx, trainedToday: true, openQuests: 2 }).subtitle).not.toContain('Ruhetag');
  });
});

const plan: TrainingPlan = {
  id: 'p', name: 'P', createdAt: '', split: '',
  days: [
    { id: 'a', name: 'A', weekday: 0, focus: '', exercises: [] },
    { id: 'b', name: 'B', weekday: 2, focus: '', exercises: [] },
    { id: 'c', name: 'C', weekday: 4, focus: '', exercises: [] },
  ],
};
const session = (id: string, planDayId: string | null, d: Date): WorkoutSession => ({
  id, planDayId, name: id, startedAt: d.toISOString(), finishedAt: d.toISOString(), durationSec: 60, xpEarned: 0, sets: [],
});
const thursday = new Date(2026, 9, 22, 10);

describe('Wochenübersicht', () => {
  it('zeigt erledigt, verpasst, heute, geplant und Ruhetage aus echten Daten', () => {
    const w = getWeekOverview(plan, [session('s1', 'a', new Date(2026, 9, 19, 18))], thursday, thursday);
    expect(w.label).toBe('KW 43');
    expect(w.isCurrentWeek).toBe(true);
    expect(w.days.map((d) => d.status)).toEqual(['done', 'rest', 'missed', 'rest', 'planned', 'rest', 'rest']);
    expect(w.planned).toBe(3);
    expect(w.completed).toBe(1);
  });

  it('zählt eine nachgeholte Einheit als erledigt', () => {
    const w = getWeekOverview(plan, [session('s1', 'b', new Date(2026, 9, 22, 9))], thursday, thursday);
    expect(w.days[2].status).toBe('done');
    expect(w.days[3].sessions).toHaveLength(1);
  });

  it('wechselt zwischen Kalenderwochen', () => {
    const prev = getWeekOverview(plan, [], new Date(2026, 9, 15), thursday);
    expect(prev.isPast).toBe(true);
    expect(prev.days.filter((d) => d.status === 'missed')).toHaveLength(3);
    const next = getWeekOverview(plan, [], new Date(2026, 9, 29), thursday);
    expect(next.days.filter((d) => d.status === 'planned')).toHaveLength(3);
    expect(next.rangeLabel).toBe('26. Okt. – 1. Nov. 2026');
  });

  it('erkennt ungeplante Zusatztrainings', () => {
    const w = getWeekOverview(plan, [session('x', null, new Date(2026, 9, 20, 18))], thursday, thursday);
    expect(w.extraSessions).toBe(1);
    expect(w.days[1].sessions).toHaveLength(1);
  });

  it('funktioniert ohne Plan', () => {
    const w = getWeekOverview(null, [], thursday, thursday);
    expect(w.days.every((d) => d.status === 'rest')).toBe(true);
  });
});
