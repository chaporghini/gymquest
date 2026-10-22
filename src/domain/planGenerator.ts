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
  { name: 'Ganzkörper B', focus: 'Hüfte, Schultern, Ziehen', slots: ['hinge', 'push_vertical', 'pull_vertical', 'lunge', 'core', 'push_horizontal', 'arms', 'pull_horizontal'] },
  { name: 'Ganzkörper C', focus: 'Einbeinig, Drücken, Ziehen', slots: ['lunge', 'push_horizontal', 'pull_vertical', 'squat', 'core', 'pull_horizontal', 'arms', 'push_vertical'] },
];

const UPPER_LOWER: DayTemplate[] = [
  { name: 'Oberkörper A', focus: 'Brust, Rücken, Schultern', slots: ['push_horizontal', 'pull_horizontal', 'push_vertical', 'pull_vertical', 'arms', 'core', 'arms', 'pull_horizontal'] },
  { name: 'Unterkörper A', focus: 'Beine, Gesäß, Rumpf', slots: ['squat', 'hinge', 'lunge', 'core', 'hinge', 'core', 'squat', 'mobility'] },
  { name: 'Oberkörper B', focus: 'Schultern, Rücken, Arme', slots: ['push_vertical', 'pull_vertical', 'push_horizontal', 'pull_horizontal', 'arms', 'core', 'arms', 'push_horizontal'] },
  { name: 'Unterkörper B', focus: 'Hüfte, Beine, Rumpf', slots: ['hinge', 'lunge', 'squat', 'core', 'lunge', 'core', 'hinge', 'mobility'] },
];

const PUSH: DayTemplate = { name: 'Push', focus: 'Brust, Schultern, Trizeps', slots: ['push_horizontal', 'push_vertical', 'push_horizontal', 'arms', 'core', 'push_vertical', 'arms', 'mobility'] };
const PULL: DayTemplate = { name: 'Pull', focus: 'Rücken, Bizeps', slots: ['pull_vertical', 'pull_horizontal', 'pull_vertical', 'arms', 'core', 'pull_horizontal', 'arms', 'mobility'] };
const LEGS: DayTemplate = { name: 'Beine', focus: 'Beine, Gesäß, Rumpf', slots: ['squat', 'hinge', 'lunge', 'core', 'squat', 'hinge', 'core', 'mobility'] };
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
  if (strengthDays <= 3) {
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
  for (const slot of template.slots) {
    const ex = pickExercise(slot, profile, library, used, index);
    if (!ex) continue;
    const planned = prescribe(ex, profile);
    const candidate = [...exercises, planned];
    // Mindestens drei Übungen, danach nur so viele, wie in die verfügbare Zeit passen.
    if (exercises.length >= 3 && estimateDayMinutes({ exercises: candidate }) > profile.sessionMinutes) break;
    used.add(ex.id);
    exercises.push(planned);
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
