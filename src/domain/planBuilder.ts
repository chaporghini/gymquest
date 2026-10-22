import { WEEKDAYS_LONG } from './dates';
import { MUSCLE_LABELS, muscleLoad, musclesOf, type Muscle } from './muscles';
import { DAY_FOCUS_LABELS, estimateDayMinutes, isExerciseAllowed, prescribe, suggestDay, type DayFocus } from './planGenerator';
import type { Exercise, MuscleGroup, PlanDay, Profile, TrainingPlan } from './types';

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

// --- „Neue Übung“: Vorschläge für eine Einheit mit Begründung -------------------

export interface ExerciseSuggestion {
  exercise: Exercise;
  reason: string;
}

const join = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} und ${list[list.length - 1]}`);

/**
 * Schlägt Übungen vor, die eine Einheit sinnvoll ergänzen. Ohne `group`: zuerst Muskeln, die in der
 * ganzen Woche fehlen, dann solche, die in dieser Einheit fehlen. Mit `group`: passend zur Muskelgruppe.
 * `offset` blättert durch weitere Vorschläge.
 */
export function suggestForDay(
  day: PlanDay,
  allDays: PlanDay[],
  profile: Profile,
  library: Exercise[],
  group: MuscleGroup | null = null,
  offset = 0,
  limit = 3,
): ExerciseSuggestion[] {
  const inDay = new Set(day.exercises.map((e) => e.exerciseId));
  const inWeek = new Set(allDays.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
  const dayLoad = muscleLoad([...inDay]);
  const weekLoad = muscleLoad([...inWeek]);
  const maxDiff = profile.experience === 'beginner' ? 1 : profile.experience === 'intermediate' ? 2 : 3;

  const scored = library
    .filter((e) => isExerciseAllowed(e, profile) && !inDay.has(e.id) && (!group || e.muscleGroup === group || e.secondaryMuscles.includes(group)))
    .map((e) => {
      const primary = musclesOf(e.id).primary;
      const newInWeek = primary.filter((m) => weekLoad[m] === 'none');
      const newInDay = primary.filter((m) => dayLoad[m] === 'none' && weekLoad[m] !== 'none');
      let score = newInWeek.length * 5 + newInDay.length * 3;
      if (group && e.muscleGroup === group) score += 6;
      if (e.difficulty > maxDiff) score -= 4;
      if (inWeek.has(e.id)) score -= 2;
      if (e.category === 'mobility') score -= 1;
      const names = (list: Muscle[]) => join(list.map((m) => MUSCLE_LABELS[m]));
      const reason = newInWeek.length
        ? `Trainiert ${names(newInWeek)}, das kommt in deiner Woche bisher gar nicht vor.`
        : newInDay.length
          ? `Ergänzt ${names(newInDay)}, das fehlt in dieser Einheit noch.`
          : primary.length
            ? `Mehr für ${names(primary)}${inWeek.has(e.id) ? ' (machst du schon an einem anderen Tag)' : ''}.`
            : 'Lockert und verbessert die Beweglichkeit.';
      return { exercise: e, reason, score };
    })
    .filter((x) => group || x.score > 0)
    .sort((a, b) => b.score - a.score || a.exercise.difficulty - b.exercise.difficulty || a.exercise.id.localeCompare(b.exercise.id));
  if (scored.length === 0) return [];
  const start = (offset * limit) % scored.length;
  return [...scored.slice(start), ...scored.slice(0, start)].slice(0, Math.min(limit, scored.length)).map(({ exercise, reason }) => ({ exercise, reason }));
}

/** Wie lange die Einheit mit einer zusätzlichen Übung ungefähr dauert. */
export function minutesWith(day: PlanDay, exercise: Exercise, profile: Profile): number {
  return estimateDayMinutes({ exercises: [...day.exercises, prescribe(exercise, profile)] });
}
