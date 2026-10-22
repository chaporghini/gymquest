import { EXERCISES } from '@/data/exercises';
import { EXERCISE_MUSCLES, muscleLoad, musclesWith, suggestForMissing } from '../muscles';
import { addExercise, applyFocus, buildCustomPlan, moveExercise, removeExercise, swapExercise, toggleWeekday, validateDraft } from '../planBuilder';
import { isExerciseAllowed } from '../planGenerator';
import type { PlanDay, Profile } from '../types';

const profile: Profile = {
  displayName: 'Luis',
  experience: 'intermediate',
  goal: 'hypertrophy',
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipment: ['gym', 'dumbbells'],
  limitations: [],
  excludedExerciseIds: [],
  onboardingCompleted: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const allowed = (e: (typeof EXERCISES)[number]) => isExerciseAllowed(e, profile);

describe('Muskelkarte', () => {
  it('kennt für jede Übung die beanspruchten Muskeln', () => {
    for (const e of EXERCISES) expect(EXERCISE_MUSCLES[e.id]).toBeDefined();
  });

  it('färbt direkt vor indirekt und den Rest als nicht beansprucht', () => {
    const load = muscleLoad(['bench_press', 'biceps_curl']);
    expect(load.chest).toBe('primary');
    expect(load.triceps).toBe('secondary');
    expect(load.biceps).toBe('primary'); // beim Curl direkt, auch wenn anderswo indirekt
    expect(load.quads).toBe('none');
    expect(musclesWith(muscleLoad([]), 'none')).toHaveLength(18);
  });

  it('schlägt Übungen für noch nicht trainierte Muskeln vor', () => {
    const load = muscleLoad(['bench_press', 'lat_pulldown']);
    const s = suggestForMissing(load, EXERCISES, allowed, new Set());
    expect(s.length).toBeGreaterThan(0);
    for (const { covers } of s) for (const m of covers) expect(load[m]).toBe('none');
  });
});

describe('Plan-Baukasten', () => {
  it('legt beim Antippen eines Tages direkt einen Vorschlag an und entfernt ihn wieder', () => {
    let days: PlanDay[] = [];
    days = toggleWeekday(days, 0, profile, EXERCISES);
    days = toggleWeekday(days, 3, profile, EXERCISES);
    expect(days.map((d) => d.weekday)).toEqual([0, 3]);
    expect(days.every((d) => d.exercises.length >= 3)).toBe(true);
    expect(days[0].name).not.toBe(days[1].name); // Varianten A/B
    days = toggleWeekday(days, 0, profile, EXERCISES);
    expect(days.map((d) => d.weekday)).toEqual([3]);
  });

  it('lässt immer mindestens einen Ruhetag', () => {
    let days: PlanDay[] = [];
    for (let w = 0; w < 7; w++) days = toggleWeekday(days, w, profile, EXERCISES);
    expect(days).toHaveLength(6);
  });

  it('übernimmt Schwerpunkte und erlaubt Hinzufügen, Entfernen, Tauschen, Sortieren', () => {
    let days = toggleWeekday([], 1, profile, EXERCISES);
    days = applyFocus(days, 1, 'push', profile, EXERCISES);
    expect(days[0].name).toBe('Drücken');
    const ids = muscleLoad(days[0].exercises.map((e) => e.exerciseId));
    expect(ids.chest).toBe('primary');
    const curl = EXERCISES.find((e) => e.id === 'glute_bridge')!;
    days = addExercise(days, 1, curl, profile);
    expect(days[0].exercises.at(-1)?.exerciseId).toBe('glute_bridge');
    expect(addExercise(days, 1, curl, profile)[0].exercises).toHaveLength(days[0].exercises.length);
    const first = days[0].exercises[0].exerciseId;
    expect(moveExercise(days, 1, 0, 1)[0].exercises[1].exerciseId).toBe(first);
    const swapped = swapExercise(days, 1, 0, profile, EXERCISES);
    expect(swapped?.[0].exercises[0].exerciseId).not.toBe(first);
    days = removeExercise(days, 1, 0);
    expect(days[0].exercises.some((e) => e.exerciseId === first)).toBe(false);
  });

  it('prüft den Entwurf und baut daraus einen Plan', () => {
    expect(validateDraft([])).toMatch(/mindestens einen/);
    const empty: PlanDay = { id: 'x', name: 'Leer', weekday: 2, focus: '', exercises: [] };
    expect(validateDraft([empty])).toMatch(/Mittwoch/);
    const days = toggleWeekday(toggleWeekday([], 4, profile, EXERCISES), 0, profile, EXERCISES);
    const plan = buildCustomPlan(days, new Date('2026-10-22'));
    expect(plan.split).toBe('Eigener Plan');
    expect(plan.days.map((d) => d.weekday)).toEqual([0, 4]);
    expect(new Set(plan.days.map((d) => d.id)).size).toBe(2);
  });
});
