import { EXERCISES, getExercise } from '@/data/exercises';
import { estimateDayMinutes, generateTrainingPlan, isExerciseAllowed } from '../planGenerator';
import type { Profile } from '../types';

const base: Profile = {
  displayName: 'Test',
  experience: 'beginner',
  goal: 'general',
  daysPerWeek: 3,
  sessionMinutes: 45,
  equipment: ['bodyweight'],
  limitations: [],
  excludedExerciseIds: [],
  onboardingCompleted: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const now = new Date('2026-10-22T10:00:00Z');

describe('generateTrainingPlan', () => {
  it('erstellt so viele Tage wie gewünscht', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const plan = generateTrainingPlan({ ...base, experience: 'advanced', daysPerWeek: days }, EXERCISES, now);
      expect(plan.days).toHaveLength(days);
    }
  });

  it('lässt immer mindestens einen Ruhetag und keine doppelten Wochentage', () => {
    const plan = generateTrainingPlan({ ...base, experience: 'advanced', daysPerWeek: 6 }, EXERCISES, now);
    const weekdays = plan.days.map((d) => d.weekday);
    expect(new Set(weekdays).size).toBe(weekdays.length);
    expect(weekdays.every((w) => w >= 0 && w <= 6)).toBe(true);
    expect(weekdays.length).toBeLessThan(7);
  });

  it('legt bei 3 Tagen Ruhetage zwischen die Einheiten', () => {
    const plan = generateTrainingPlan(base, EXERCISES, now);
    expect(plan.days.map((d) => d.weekday)).toEqual([0, 2, 4]);
  });

  it('wandelt bei Anfängern überzählige Tage in Erholungstage um', () => {
    const plan = generateTrainingPlan({ ...base, daysPerWeek: 5 }, EXERCISES, now);
    expect(plan.days.filter((d) => d.name === 'Aktive Erholung')).toHaveLength(2);
  });

  it('verwendet nur verfügbares Equipment', () => {
    const plan = generateTrainingPlan(base, EXERCISES, now);
    for (const day of plan.days) {
      for (const pe of day.exercises) {
        expect(getExercise(pe.exerciseId)?.equipment).toContain('bodyweight');
      }
    }
  });

  it('meidet Übungen, die angegebene Einschränkungen belasten', () => {
    const profile: Profile = { ...base, equipment: ['gym', 'dumbbells'], limitations: ['knees', 'lower_back'], experience: 'intermediate', daysPerWeek: 4 };
    const plan = generateTrainingPlan(profile, EXERCISES, now);
    const all = plan.days.flatMap((d) => d.exercises.map((e) => getExercise(e.exerciseId)!));
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((e) => e.stresses.includes('knees') || e.stresses.includes('lower_back'))).toBe(false);
  });

  it('respektiert ausgeschlossene Übungen', () => {
    const profile: Profile = { ...base, excludedExerciseIds: ['push_up', 'incline_push_up'] };
    const plan = generateTrainingPlan(profile, EXERCISES, now);
    const ids = plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain('push_up');
    expect(ids).not.toContain('incline_push_up');
  });

  it('gibt Anfängern keine anspruchsvollsten Übungen', () => {
    const plan = generateTrainingPlan({ ...base, equipment: ['gym', 'pullup_bar'] }, EXERCISES, now);
    const all = plan.days.flatMap((d) => d.exercises.map((e) => getExercise(e.exerciseId)!));
    expect(all.every((e) => e.difficulty <= 2)).toBe(true);
  });

  it('passt die Einheiten an die verfügbare Zeit an', () => {
    for (const minutes of [30, 45, 60, 90]) {
      const plan = generateTrainingPlan({ ...base, equipment: ['gym', 'dumbbells'], experience: 'intermediate', sessionMinutes: minutes }, EXERCISES, now);
      for (const day of plan.days) {
        expect(day.exercises.length).toBeGreaterThanOrEqual(3);
        if (day.exercises.length > 3) expect(estimateDayMinutes(day)).toBeLessThanOrEqual(minutes);
      }
    }
  });

  it('nutzt bei Kraftziel niedrigere Wiederholungen und längere Pausen', () => {
    const strength = generateTrainingPlan({ ...base, goal: 'strength', equipment: ['gym'], experience: 'intermediate' }, EXERCISES, now);
    const first = strength.days[0].exercises[0];
    expect(first.repsMax).toBeLessThanOrEqual(6);
    expect(first.restSec).toBeGreaterThanOrEqual(120);
  });

  it('enthält bei Mobilitätsziel Mobilitätsübungen', () => {
    const plan = generateTrainingPlan({ ...base, goal: 'mobility' }, EXERCISES, now);
    for (const day of plan.days) {
      expect(day.exercises.some((e) => getExercise(e.exerciseId)?.category === 'mobility')).toBe(true);
    }
  });

  it('ist deterministisch', () => {
    expect(generateTrainingPlan(base, EXERCISES, now)).toEqual(generateTrainingPlan(base, EXERCISES, now));
  });

  it('isExerciseAllowed erlaubt Körpergewicht immer', () => {
    expect(isExerciseAllowed(getExercise('plank')!, { ...base, equipment: ['gym'] })).toBe(true);
  });
});
