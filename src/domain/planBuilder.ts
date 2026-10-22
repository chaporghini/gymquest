import { WEEKDAYS_LONG } from './dates';
import { DAY_FOCUS_LABELS, isExerciseAllowed, prescribe, suggestDay, type DayFocus } from './planGenerator';
import type { Exercise, PlanDay, Profile, TrainingPlan } from './types';

// Eigener Trainingsplan: einfache, reine Funktionen für den Plan-Baukasten.

export const MAX_TRAINING_DAYS = 6;

const sortDays = (days: PlanDay[]) => [...days].sort((a, b) => a.weekday - b.weekday);

/** Wie viele Tage vor diesem Tag haben schon denselben Schwerpunkt? Ergibt Variante A, B, C. */
function variantFor(days: PlanDay[], focus: DayFocus, weekday: number): number {
  return days.filter((d) => d.weekday < weekday && d.focus === DAY_FOCUS_LABELS[focus]).length;
}

/** Schwerpunkt für einen neu hinzugefügten Tag, passend zur Anzahl der Trainingstage. */
export function defaultFocus(dayCount: number): DayFocus {
  return dayCount <= 3 ? 'full' : 'upper';
}

/** Trainingstag an- oder abwählen. Neue Tage bekommen direkt einen Übungsvorschlag. */
export function toggleWeekday(days: PlanDay[], weekday: number, profile: Profile, library: Exercise[]): PlanDay[] {
  if (days.some((d) => d.weekday === weekday)) return days.filter((d) => d.weekday !== weekday);
  if (days.length >= MAX_TRAINING_DAYS) return days;
  const focus = defaultFocus(days.length + 1);
  return sortDays([...days, withFocus(suggestDay(focus, profile, library, weekday, variantFor(days, focus, weekday)), focus)]);
}

function withFocus(day: PlanDay, focus: DayFocus): PlanDay {
  return { ...day, focus: DAY_FOCUS_LABELS[focus] };
}

/** Ersetzt die Übungen eines Tages durch einen Vorschlag mit dem gewählten Schwerpunkt. */
export function applyFocus(days: PlanDay[], weekday: number, focus: DayFocus, profile: Profile, library: Exercise[]): PlanDay[] {
  const others = days.filter((d) => d.weekday !== weekday);
  const current = days.find((d) => d.weekday === weekday);
  const suggested = withFocus(suggestDay(focus, profile, library, weekday, variantFor(others, focus, weekday)), focus);
  return sortDays([...others, { ...suggested, id: current?.id ?? suggested.id }]);
}

export function updateDay(days: PlanDay[], weekday: number, patch: Partial<PlanDay>): PlanDay[] {
  return days.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d));
}

export function addExercise(days: PlanDay[], weekday: number, exercise: Exercise, profile: Profile): PlanDay[] {
  return days.map((d) =>
    d.weekday !== weekday || d.exercises.some((e) => e.exerciseId === exercise.id) ? d : { ...d, exercises: [...d.exercises, prescribe(exercise, profile)] },
  );
}

export function removeExercise(days: PlanDay[], weekday: number, index: number): PlanDay[] {
  return days.map((d) => (d.weekday !== weekday ? d : { ...d, exercises: d.exercises.filter((_, i) => i !== index) }));
}

/** Tauscht eine Übung gegen die nächste Alternative mit gleichem Bewegungsmuster. Null, wenn es keine gibt. */
export function swapExercise(days: PlanDay[], weekday: number, index: number, profile: Profile, library: Exercise[]): PlanDay[] | null {
  const day = days.find((d) => d.weekday === weekday);
  const current = day && library.find((e) => e.id === day.exercises[index]?.exerciseId);
  if (!day || !current) return null;
  const used = new Set(day.exercises.map((e) => e.exerciseId));
  const options = library.filter((e) => e.pattern === current.pattern && isExerciseAllowed(e, profile) && (!used.has(e.id) || e.id === current.id));
  if (options.length <= 1) return null;
  const next = options[(options.findIndex((o) => o.id === current.id) + 1) % options.length];
  return updateDay(days, weekday, { exercises: day.exercises.map((e, i) => (i === index ? prescribe(next, profile) : e)) });
}

export function moveExercise(days: PlanDay[], weekday: number, index: number, dir: -1 | 1): PlanDay[] {
  return days.map((d) => {
    if (d.weekday !== weekday) return d;
    const target = index + dir;
    if (target < 0 || target >= d.exercises.length) return d;
    const list = [...d.exercises];
    [list[index], list[target]] = [list[target], list[index]];
    return { ...d, exercises: list };
  });
}

export function validateDraft(days: PlanDay[]): string | null {
  if (days.length === 0) return 'Wähle mindestens einen Trainingstag.';
  if (days.length > MAX_TRAINING_DAYS) return 'Mindestens ein Ruhetag pro Woche.';
  const empty = days.find((d) => d.exercises.length === 0);
  if (empty) return `${WEEKDAYS_LONG[empty.weekday]} hat noch keine Übungen.`;
  return null;
}

export function buildCustomPlan(days: PlanDay[], now: Date): TrainingPlan {
  const sorted = sortDays(days).map((d, i) => ({ ...d, id: d.id || `day_${i + 1}`, name: d.name.trim() || `Training ${i + 1}` }));
  return {
    id: `plan_${now.getTime().toString(36)}`,
    name: `Eigener Plan · ${sorted.length}× pro Woche`,
    createdAt: now.toISOString(),
    split: 'Eigener Plan',
    days: sorted,
  };
}
