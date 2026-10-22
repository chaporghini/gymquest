import type { Exercise, Profile } from '../types';
import { ageGroup } from './age';

// Sätze, Wiederholungen, Pausen und Zielanstrengung je Übung.
// Ausgangsbereiche (keine starren Regeln):
//   Kraft, Hauptübung:      2–4 Sätze × 4–8 Wdh.
//   Muskelaufbau:           2–4 Sätze × 6–15 Wdh.
//   Isolationsübungen:      2–3 Sätze × 10–15 Wdh.
//   Einsteiger:             meist 1–3 Arbeitssätze, Technik und Verträglichkeit zuerst.

export interface Prescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  /** Bei Zeitübungen: Sekunden pro Satz. */
  durationSec?: number;
  restSec: number;
  restRange: [number, number];
  /** Wiederholungen in Reserve (RIR): wie viele saubere Wiederholungen am Satzende noch möglich wären. */
  rir: [number, number];
  notes: string[];
}

type Ctx = Pick<Profile, 'goal' | 'experience' | 'daysPerWeek' | 'limitations' | 'ageYears' | 'ageRecordedAt'>;

export function recommendPrescription(exercise: Exercise, profile: Ctx, now = new Date()): Prescription {
  const { goal, experience } = profile;
  const notes: string[] = [];
  const group = ageGroup(profile, now);
  const isCompound = exercise.category === 'compound';
  const isIsolation = exercise.category === 'isolation';

  if (exercise.measurement === 'time') {
    const durationSec = exercise.category === 'mobility' ? 45 : experience === 'beginner' ? 30 : experience === 'intermediate' ? 40 : 60;
    const sets = exercise.category === 'mobility' ? 2 : experience === 'beginner' ? 2 : 3;
    return { sets, repsMin: 0, repsMax: 0, durationSec, restSec: 30, restRange: [30, 60], rir: [2, 3], notes: ['Ruhig weiteratmen und die Position sauber halten.'] };
  }

  let sets: number;
  let reps: [number, number];
  let rest: [number, number];
  if (exercise.category === 'core' || exercise.category === 'mobility') {
    sets = experience === 'beginner' ? 2 : 3;
    reps = [10, 15];
    rest = [45, 60];
  } else if (isIsolation) {
    sets = experience === 'beginner' ? 2 : 3;
    reps = [10, 15];
    rest = [60, 90];
  } else if (goal === 'strength') {
    sets = experience === 'beginner' ? 3 : experience === 'intermediate' ? 3 : 4;
    reps = experience === 'beginner' ? [6, 10] : experience === 'intermediate' ? [5, 8] : [4, 6];
    rest = [150, 180];
  } else if (goal === 'hypertrophy') {
    sets = experience === 'beginner' ? 2 : experience === 'intermediate' ? 3 : 4;
    reps = experience === 'advanced' ? [6, 10] : [8, 12];
    rest = [90, 150];
  } else {
    // Allgemeine Fitness und Bewegungskompetenz
    sets = experience === 'beginner' ? 2 : 3;
    reps = [8, 12];
    rest = [90, 120];
  }
  if (isCompound && experience === 'beginner' && goal !== 'general' && goal !== 'mobility') sets = Math.min(sets, 3);

  // Viele Trainingstage: Wochenvolumen über weniger Sätze pro Einheit begrenzen.
  if (profile.daysPerWeek >= 5 && sets > 2) {
    sets -= 1;
    notes.push('Weil du oft trainierst, sind es pro Einheit etwas weniger Sätze.');
  }

  let rir: [number, number] = experience === 'beginner' ? [2, 3] : experience === 'intermediate' ? [2, 3] : isIsolation ? [1, 2] : [1, 3];

  if (group === 'minor' || group === 'senior') {
    reps = [Math.max(reps[0], 8), Math.max(reps[1], 12)];
    sets = Math.min(sets, 3);
    rir = [Math.max(rir[0], 3), Math.max(rir[1], 4)];
    notes.push(
      group === 'minor'
        ? 'Für dein Alter: mittlere Wiederholungszahlen, deutlich vor dem Muskelversagen aufhören, keine Maximalversuche.'
        : 'Für dein Alter: mittlere Wiederholungszahlen und genug Reserve, Aufwärmen nicht auslassen.',
    );
  }
  if (exercise.stresses.some((s) => profile.limitations.includes(s))) {
    rir = [rir[0] + 1, rir[1] + 1];
    notes.push('Die Übung belastet einen Bereich, den du als eingeschränkt angegeben hast. Lass dir die Übung im Zweifel fachlich bestätigen.');
  }

  return { sets, repsMin: reps[0], repsMax: reps[1], restSec: rest[0], restRange: rest, rir, notes };
}

export function formatRir([min, max]: [number, number]): string {
  return min === max ? `${min}` : `${min}–${max}`;
}
