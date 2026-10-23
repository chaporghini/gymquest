import type {
  Equipment,
  Exercise,
  Experience,
  MovementPattern,
  PlanDay,
  PlannedExercise,
  Profile,
  TrainingPlan,
} from './types';
import { musclesOf, type Muscle } from './muscles';
import { recommendPrescription } from './training/prescription';

// Regelbasierte Trainingsplanerstellung – vollständig lokal, ohne externe KI-API.

type Slot = MovementPattern;

interface DayTemplate {
  name: string;
  focus: string;
  slots: Slot[];
}

const FULL_BODY: DayTemplate[] = [
  { name: 'Ganzkörper A', focus: 'Kniebeuge, Drücken, Rudern', slots: ['squat', 'push_horizontal', 'pull_horizontal', 'hinge', 'core', 'push_vertical', 'arms', 'lunge'] },
  { name: 'Ganzkörper B', focus: 'Hüfte, Schultern, Ziehen', slots: ['hinge', 'push_vertical', 'pull_vertical', 'lunge', 'core', 'push_horizontal', 'arms', 'pull_horizontal', 'carry'] },
  { name: 'Ganzkörper C', focus: 'Einbeinig, Drücken, Ziehen', slots: ['lunge', 'push_horizontal', 'pull_vertical', 'squat', 'core', 'pull_horizontal', 'arms', 'push_vertical', 'calves'] },
];

const UPPER_LOWER: DayTemplate[] = [
  { name: 'Oberkörper A', focus: 'Brust, Rücken, Schultern', slots: ['push_horizontal', 'pull_horizontal', 'push_vertical', 'pull_vertical', 'arms', 'core', 'arms', 'pull_horizontal'] },
  { name: 'Unterkörper A', focus: 'Beine, Gesäß, Rumpf', slots: ['squat', 'hinge', 'lunge', 'calves', 'core', 'hinge', 'core', 'squat', 'mobility'] },
  { name: 'Oberkörper B', focus: 'Schultern, Rücken, Arme', slots: ['push_vertical', 'pull_vertical', 'push_horizontal', 'pull_horizontal', 'arms', 'core', 'arms', 'push_horizontal'] },
  { name: 'Unterkörper B', focus: 'Hüfte, Beine, Rumpf', slots: ['hinge', 'lunge', 'squat', 'calves', 'core', 'lunge', 'core', 'hinge', 'mobility'] },
];

const PUSH: DayTemplate = { name: 'Push', focus: 'Brust, Schultern, Trizeps', slots: ['push_horizontal', 'push_vertical', 'push_horizontal', 'arms', 'core', 'push_vertical', 'arms', 'mobility'] };
const PULL: DayTemplate = { name: 'Pull', focus: 'Rücken, Bizeps', slots: ['pull_vertical', 'pull_horizontal', 'pull_vertical', 'arms', 'core', 'pull_horizontal', 'arms', 'mobility'] };
const LEGS: DayTemplate = { name: 'Beine', focus: 'Beine, Gesäß, Rumpf', slots: ['squat', 'hinge', 'lunge', 'calves', 'core', 'squat', 'hinge', 'core', 'mobility'] };
const MOBILITY_DAY: DayTemplate = { name: 'Aktive Erholung', focus: 'Mobilität und Rumpf', slots: ['mobility', 'mobility', 'core', 'mobility', 'core', 'mobility', 'mobility', 'core'] };

/** Verteilt Trainingstage so, dass möglichst Ruhetage dazwischen liegen (0 = Montag). */
export const WEEKDAY_LAYOUTS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

const MAX_DIFFICULTY: Record<Experience, number> = { beginner: 1, intermediate: 2, advanced: 3 };
/** Anfänger bekommen höchstens so viele Krafttage; zusätzliche Tage werden zu Erholungstagen. */
const MAX_STRENGTH_DAYS: Record<Experience, number> = { beginner: 3, intermediate: 5, advanced: 6 };

const EQUIPMENT_PRIORITY: Equipment[] = ['gym', 'dumbbells', 'kettlebell', 'pullup_bar', 'bands', 'bodyweight'];

export function clampDays(days: number): number {
  return Math.min(6, Math.max(2, Math.round(days)));
}

function chooseTemplates(profile: Profile): { split: string; templates: DayTemplate[] } {
  const days = clampDays(profile.daysPerWeek);
  const strengthDays = Math.min(days, MAX_STRENGTH_DAYS[profile.experience]);
  const recoveryDays = days - strengthDays;

  let split: string;
  let templates: DayTemplate[];
  if (profile.goal === 'full_body') {
    split = 'Ganzkörper';
    templates = Array.from({ length: strengthDays }, (_, i) => ({ ...FULL_BODY[i % 3], name: `Ganzkörper ${'ABCDEF'[i]}` }));
  } else if (strengthDays <= 3) {
    split = 'Ganzkörper';
    templates = FULL_BODY.slice(0, strengthDays);
  } else if (strengthDays === 4) {
    split = 'Oberkörper/Unterkörper';
    templates = UPPER_LOWER;
  } else if (strengthDays === 5) {
    split = 'Oberkörper/Unterkörper + Push/Pull/Beine';
    templates = [UPPER_LOWER[0], UPPER_LOWER[1], PUSH, PULL, LEGS];
  } else {
    split = 'Push/Pull/Beine';
    templates = [PUSH, PULL, LEGS, { ...PUSH, name: 'Push B' }, { ...PULL, name: 'Pull B' }, { ...LEGS, name: 'Beine B' }];
  }

  // Erholungstage gleichmäßig einstreuen.
  const result = [...templates];
  for (let i = 0; i < recoveryDays; i++) {
    const pos = Math.min(result.length, 2 + i * 2);
    result.splice(pos, 0, MOBILITY_DAY);
  }

  if (profile.goal === 'mobility') {
    split += ' mit Mobilitätsfokus';
    return {
      split,
      templates: result.map((t) =>
        t === MOBILITY_DAY ? t : { ...t, slots: ['mobility', ...t.slots.filter((s) => s !== 'mobility').slice(0, 5), 'mobility', 'mobility'] },
      ),
    };
  }
  return { split, templates: result };
}

export function isExerciseAllowed(exercise: Exercise, profile: Profile): boolean {
  const available = new Set<Equipment>([...profile.equipment, 'bodyweight']);
  if (!exercise.equipment.some((e) => available.has(e))) return false;
  if (exercise.stresses.some((s) => profile.limitations.includes(s))) return false;
  if (profile.excludedExerciseIds.includes(exercise.id)) return false;
  return true;
}

function scoreExercise(exercise: Exercise, profile: Profile): number {
  const maxDiff = MAX_DIFFICULTY[profile.experience];
  let score = 0;
  // Schwierigkeitsgrad passend zur Erfahrung
  if (exercise.difficulty > maxDiff) score -= 100;
  else score += 10 - (maxDiff - exercise.difficulty) * 3;
  // Bestes verfügbares Equipment bevorzugen
  const bestRank = Math.min(
    ...exercise.equipment.filter((e) => e === 'bodyweight' || profile.equipment.includes(e)).map((e) => EQUIPMENT_PRIORITY.indexOf(e)),
  );
  score += (EQUIPMENT_PRIORITY.length - bestRank) * 2;
  if (exercise.category === 'compound') score += 2;
  return score;
}

export function pickExercise(
  slot: Slot,
  profile: Profile,
  library: Exercise[],
  used: Set<string>,
  variant: number,
): Exercise | null {
  const candidates = library
    .filter(
      (e) =>
        e.pattern === slot &&
        !used.has(e.id) &&
        e.difficulty <= MAX_DIFFICULTY[profile.experience] + 1 &&
        isExerciseAllowed(e, profile),
    )
    .map((e) => ({ e, score: scoreExercise(e, profile) }))
    .sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));
  if (candidates.length === 0) return null;
  // Gleichwertige Top-Kandidaten über die Tage rotieren, damit es Abwechslung gibt.
  const top = candidates.filter((c) => c.score >= candidates[0].score - 2);
  return top[variant % top.length].e;
}

export function prescribe(exercise: Exercise, profile: Profile): PlannedExercise {
  // Regeln in training/prescription.ts (Ziel, Übungstyp, Erfahrung, Häufigkeit, Alter, Einschränkungen).
  const p = recommendPrescription(exercise, profile);
  return {
    exerciseId: exercise.id,
    sets: p.sets,
    repsMin: p.repsMin,
    repsMax: p.repsMax,
    ...(p.durationSec ? { durationSec: p.durationSec } : {}),
    restSec: p.restSec,
  };
}

/** Geschätzte Dauer in Minuten inkl. 5 Minuten Aufwärmen. */
export function estimateDayMinutes(day: Pick<PlanDay, 'exercises'>): number {
  let seconds = 5 * 60;
  for (const ex of day.exercises) {
    const work = ex.durationSec ?? ((ex.repsMin + ex.repsMax) / 2) * 4;
    seconds += 60 + ex.sets * work + Math.max(0, ex.sets - 1) * ex.restSec + ex.restSec;
  }
  return Math.round(seconds / 60);
}

function buildDay(template: DayTemplate, index: number, weekday: number, profile: Profile, library: Exercise[]): PlanDay {
  const used = new Set<string>();
  const exercises: PlannedExercise[] = [];
  const fits = (candidate: PlannedExercise[]) => estimateDayMinutes({ exercises: candidate }) <= profile.sessionMinutes;
  for (const slot of template.slots) {
    const ex = pickExercise(slot, profile, library, used, index);
    if (!ex) continue;
    const planned = prescribe(ex, profile);
    // Mindestens drei Übungen, danach nur so viele, wie in die verfügbare Zeit passen.
    if (exercises.length >= 3 && !fits([...exercises, planned])) break;
    used.add(ex.id);
    exercises.push(planned);
  }
  // Schwerpunkt-Muskeln aus dem Profil: fehlt einer direkt, eine passende Übung ergänzen oder die letzte ersetzen.
  for (const muscle of profile.focusMuscles ?? []) {
    if (exercises.some((e) => musclesOf(e.exerciseId).primary.includes(muscle as Muscle))) continue;
    const extra = library
      .filter((e) => !used.has(e.id) && isExerciseAllowed(e, profile) && e.difficulty <= MAX_DIFFICULTY[profile.experience] + 1 && musclesOf(e.id).primary.includes(muscle as Muscle))
      .sort((a, b) => scoreExercise(b, profile) - scoreExercise(a, profile) || a.id.localeCompare(b.id))[0];
    if (!extra || template === MOBILITY_DAY) continue;
    const planned = prescribe(extra, profile);
    if (fits([...exercises, planned])) exercises.push(planned);
    else if (exercises.length > 3) exercises[exercises.length - 1] = planned;
    else continue;
    used.add(extra.id);
  }
  return {
    id: `day_${index + 1}`,
    name: template.name,
    weekday,
    focus: template.focus,
    exercises,
  };
}

export function generateTrainingPlan(profile: Profile, library: Exercise[], now: Date = new Date()): TrainingPlan {
  const { split, templates } = chooseTemplates(profile);
  const weekdays = WEEKDAY_LAYOUTS[templates.length] ?? WEEKDAY_LAYOUTS[3];
  // Gleiche Vorlagen (z. B. mehrere Erholungstage) bekommen unterschiedliche Varianten.
  const days = templates.map((t, i) => buildDay(t, i, weekdays[i], profile, library));
  return {
    id: `plan_${now.getTime().toString(36)}`,
    name: `${split} · ${templates.length}× pro Woche`,
    createdAt: now.toISOString(),
    split,
    days,
  };
}

// --- Eigener Plan: Vorschläge für einzelne Tage -------------------------------

export type DayFocus = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'mobility';

export const DAY_FOCUS: Record<DayFocus, DayTemplate> = {
  full: FULL_BODY[0],
  upper: UPPER_LOWER[0],
  lower: UPPER_LOWER[1],
  push: PUSH,
  pull: PULL,
  legs: LEGS,
  mobility: MOBILITY_DAY,
};

export const DAY_FOCUS_LABELS: Record<DayFocus, string> = {
  full: 'Ganzkörper',
  upper: 'Oberkörper',
  lower: 'Unterkörper',
  push: 'Drücken',
  pull: 'Ziehen',
  legs: 'Beine',
  mobility: 'Mobilität',
};

/** Vorschlag für einen Trainingstag mit Schwerpunkt; `variant` sorgt für Abwechslung. */
export function suggestDay(focus: DayFocus, profile: Profile, library: Exercise[], weekday: number, variant = 0): PlanDay {
  // Mehrere Tage mit gleichem Schwerpunkt bekommen die Varianten A, B, C.
  const t = focus === 'full' ? FULL_BODY[variant % 3] : focus === 'upper' ? UPPER_LOWER[(variant % 2) * 2] : focus === 'lower' ? UPPER_LOWER[(variant % 2) * 2 + 1] : DAY_FOCUS[focus];
  const day = buildDay({ ...t, name: `${DAY_FOCUS_LABELS[focus]}${focus === 'full' || focus === 'upper' || focus === 'lower' || variant > 0 ? ` ${'ABCDEF'[variant]}` : ''}` }, variant, weekday, profile, library);
  return { ...day, id: `day_${weekday}_${focus}_${variant}` };
}

/** Sinnvolle Schwerpunkte für n Trainingstage (wie beim automatischen Plan). */
export function suggestFocuses(days: number, experience: Profile['experience']): DayFocus[] {
  const strength = Math.min(days, MAX_STRENGTH_DAYS[experience]);
  const base: DayFocus[] = strength <= 3 ? Array(strength).fill('full') : strength === 4 ? ['upper', 'lower', 'upper', 'lower'] : strength === 5 ? ['upper', 'lower', 'push', 'pull', 'legs'] : ['push', 'pull', 'legs', 'push', 'pull', 'legs'];
  return [...base, ...Array(days - strength).fill('mobility')];
}

// --- Plan-Ersteller: Aufteilung wählen ---------------------------------------------

export type SplitId = 'full' | 'upper_lower' | 'ppl' | 'custom';

export interface SplitOption {
  id: SplitId;
  label: string;
  description: string;
  recommended: boolean;
}

/** Wie viele der Tage Krafttage sind; weitere Tage werden bei Anfängern zu Erholungstagen. */
export function strengthDayCount(days: number, experience: Experience): number {
  return Math.min(clampDays(days), MAX_STRENGTH_DAYS[experience]);
}

/** Aufteilungen, die zur Trainingshäufigkeit passen, mit kurzer Begründung. */
export function splitOptions(days: number, experience: Experience, goal: Profile['goal']): SplitOption[] {
  const n = strengthDayCount(days, experience);
  const recovery = clampDays(days) - n;
  const extra = recovery > 0 ? ` Dazu ${recovery === 1 ? 'ein Tag' : `${recovery} Tage`} aktive Erholung, weil mehr Krafttage für den Einstieg nicht nötig sind.` : '';
  const recommended: SplitId = goal === 'full_body' && n <= 4 ? 'full' : n <= 3 ? 'full' : n === 4 ? 'upper_lower' : 'ppl';
  const options: SplitOption[] = [];
  if (n <= 4) {
    options.push({ id: 'full', label: 'Ganzkörper', description: `Jede Einheit trainiert den ganzen Körper, so kommt jede Muskelgruppe ${n}× pro Woche dran. Einfach zu planen und ideal bei 2–3 Tagen.${extra}`, recommended: false });
  }
  if (n === 2 || n === 4) {
    options.push({ id: 'upper_lower', label: 'Oberkörper/Unterkörper', description: `Abwechselnd Ober- und Unterkörper. ${n === 4 ? 'Jede Muskelgruppe 2× pro Woche mit mehr Übungen pro Bereich.' : 'Bei 2 Tagen nur 1× pro Woche je Bereich, Ganzkörper ist meist besser.'}${extra}`, recommended: false });
  }
  if (n === 3 || n >= 5) {
    options.push({
      id: 'ppl',
      label: 'Push/Pull/Legs',
      description:
        n === 3
          ? 'Drücken, Ziehen, Beine an je einem Tag. Jede Muskelgruppe nur 1× pro Woche, eher für Fortgeschrittene.'
          : n === 5
            ? 'Oberkörper, Unterkörper, dann Drücken, Ziehen, Beine. Jede Muskelgruppe etwa 2× pro Woche.'
            : 'Drücken, Ziehen, Beine, zweimal pro Woche. Viel Volumen, braucht gute Erholung.',
      recommended: false,
    });
  }
  options.push({ id: 'custom', label: 'Individuell', description: 'Du legst den Schwerpunkt jedes Trainingstags selbst fest.', recommended: false });
  return options.map((o) => ({ ...o, recommended: o.id === recommended }));
}

export const SPLIT_LABELS: Record<SplitId, string> = { full: 'Ganzkörper', upper_lower: 'Oberkörper/Unterkörper', ppl: 'Push/Pull/Legs', custom: 'Individuell' };

/** Schwerpunkte je Trainingstag für eine Aufteilung (ohne Erholungstage). */
function splitFocuses(split: SplitId, n: number): DayFocus[] {
  switch (split) {
    case 'full':
      return Array(n).fill('full');
    case 'upper_lower':
      return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'upper' : 'lower'));
    case 'ppl':
      return n === 5 ? ['upper', 'lower', 'push', 'pull', 'legs'] : Array.from({ length: n }, (_, i) => (['push', 'pull', 'legs'] as DayFocus[])[i % 3]);
    case 'custom':
      return suggestFocuses(n, 'advanced');
  }
}

/**
 * Trainingstage für die gewählte Aufteilung. `weekdays` legt die Wochentage fest (sortiert).
 * Bei „Individuell“ bleiben die Tage leer, der Nutzer wählt pro Tag einen Schwerpunkt.
 */
export function buildSplitDays(split: SplitId, profile: Profile, library: Exercise[], weekdays: number[]): PlanDay[] {
  const n = strengthDayCount(weekdays.length, profile.experience);
  const focuses: DayFocus[] = [...splitFocuses(split, n)];
  // Erholungstage gleichmäßig einstreuen (wie beim automatischen Plan).
  for (let i = 0; i < weekdays.length - n; i++) focuses.splice(Math.min(focuses.length, 2 + i * 2), 0, 'mobility');
  const sorted = [...weekdays].sort((a, b) => a - b);
  const seen: Partial<Record<DayFocus, number>> = {};
  return sorted.map((weekday, i) => {
    const focus = focuses[i] ?? 'full';
    if (split === 'custom') return { id: `day_${weekday}_custom`, name: `Training ${i + 1}`, weekday, focus: '', exercises: [] };
    const variant = seen[focus] ?? 0;
    seen[focus] = variant + 1;
    return { ...suggestDay(focus, profile, library, weekday, variant), focus: DAY_FOCUS_LABELS[focus] };
  });
}
