import type { ExerciseFeedback, SetLog, WorkoutSession } from '../types';

// Aufbereitung der gespeicherten Trainings je Übung. Verglichen wird immer nur dieselbe Übung.

export interface ExerciseEntry {
  sessionId: string;
  date: Date;
  sets: SetLog[];
  /** Häufigstes Gewicht der abgeschlossenen Sätze (bei Gleichstand das höhere), null ohne Gewicht. */
  workingWeight: number | null;
  topWeight: number | null;
  /** Wiederholungen der Sätze mit dem Arbeitsgewicht */
  repsAtWorkingWeight: number[];
  bestReps: number;
  totalReps: number;
  bestDuration: number;
  volumeKg: number;
  /** Geschätzte Maximalkraft nach Epley, nur innerhalb derselben Übung vergleichbar. */
  e1rm: number | null;
  feedback: ExerciseFeedback | null;
  readiness: number | null;
}

/** Eindeutige Trainings (gleiche ID wird nur einmal gezählt), aufsteigend nach Ende. */
export function uniqueSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  const byId = new Map<string, WorkoutSession>();
  for (const s of sessions) if (!byId.has(s.id)) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
}

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

export function toEntry(session: WorkoutSession, exerciseId: string): ExerciseEntry | null {
  const sets = session.sets.filter((s) => s.exerciseId === exerciseId && s.completed);
  if (sets.length === 0) return null;
  const weights = sets.map((s) => s.weightKg ?? 0).filter((w) => w > 0);
  const workingWeight = mode(weights);
  const topWeight = weights.length ? Math.max(...weights) : null;
  const reps = sets.map((s) => s.reps ?? 0);
  const e1rms = sets.filter((s) => (s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0).map((s) => (s.weightKg as number) * (1 + Math.min(s.reps as number, 12) / 30));
  return {
    sessionId: session.id,
    date: new Date(session.finishedAt),
    sets,
    workingWeight,
    topWeight,
    repsAtWorkingWeight: workingWeight === null ? reps : sets.filter((s) => s.weightKg === workingWeight).map((s) => s.reps ?? 0),
    bestReps: Math.max(0, ...reps),
    totalReps: reps.reduce((a, b) => a + b, 0),
    bestDuration: Math.max(0, ...sets.map((s) => s.durationSec ?? 0)),
    volumeKg: sets.reduce((n, s) => n + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
    e1rm: e1rms.length ? Math.round(Math.max(...e1rms) * 10) / 10 : null,
    feedback: session.feedback?.find((f) => f.exerciseId === exerciseId) ?? null,
    readiness: session.readiness ?? null,
  };
}

/** Alle Einträge einer Übung, neueste zuerst. */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string, before?: Date): ExerciseEntry[] {
  const out: ExerciseEntry[] = [];
  for (const s of uniqueSessions(sessions)) {
    if (before && new Date(s.finishedAt) >= before) continue;
    const e = toEntry(s, exerciseId);
    if (e) out.push(e);
  }
  return out.reverse();
}

/** Leistungskennzahl innerhalb einer Übung: Gewicht → e1RM, Körpergewicht → beste Wdh., Zeit → beste Dauer. */
export function performanceOf(e: ExerciseEntry): number {
  if (e.e1rm !== null) return e.e1rm;
  if (e.bestDuration > 0 && e.bestReps === 0) return e.bestDuration;
  return e.bestReps;
}

export type Comparison = 'improved' | 'same' | 'lower';

/** Vergleich mit der vorherigen Einheit derselben Übung. Mehr Gewicht oder mehr Wdh. bei gleichem Gewicht = besser. */
export function compareEntries(current: ExerciseEntry, previous: ExerciseEntry): { result: Comparison; text: string } {
  const cw = current.workingWeight;
  const pw = previous.workingWeight;
  if (cw !== null && pw !== null && cw !== pw) {
    const diff = Math.round((cw - pw) * 100) / 100;
    return { result: diff > 0 ? 'improved' : 'lower', text: `${diff > 0 ? '+' : ''}${fmt(diff)} kg Arbeitsgewicht (${fmt(pw)} → ${fmt(cw)} kg)` };
  }
  if (current.bestDuration > 0 && current.bestReps === 0) {
    const diff = current.bestDuration - previous.bestDuration;
    return { result: diff > 0 ? 'improved' : diff < 0 ? 'lower' : 'same', text: diff === 0 ? 'gleiche Haltezeit' : `${diff > 0 ? '+' : ''}${diff} s Haltezeit` };
  }
  const cr = current.repsAtWorkingWeight.reduce((a, b) => a + b, 0);
  const pr = previous.repsAtWorkingWeight.reduce((a, b) => a + b, 0);
  const sameSets = current.repsAtWorkingWeight.length === previous.repsAtWorkingWeight.length;
  const diff = sameSets ? cr - pr : current.bestReps - previous.bestReps;
  const unit = sameSets ? 'Wiederholungen insgesamt' : 'Wiederholungen im besten Satz';
  const at = cw !== null ? ` mit ${fmt(cw)} kg` : '';
  if (diff === 0) return { result: 'same', text: `gleiche Wiederholungen${at}` };
  return { result: diff > 0 ? 'improved' : 'lower', text: `${diff > 0 ? '+' : ''}${diff} ${unit}${at}` };
}

export interface ProgressPoint {
  sessionId: string;
  date: string;
  workingWeight: number | null;
  topWeight: number | null;
  bestReps: number;
  totalReps: number;
  bestDuration: number;
  volumeKg: number;
  e1rm: number | null;
}

export interface PersonalRecord {
  exerciseId: string;
  sessionId: string;
  date: string;
  kind: 'weight' | 'reps' | 'duration';
  value: number;
  previous: number;
}

/** Verlauf einer Übung (älteste zuerst) samt persönlicher Bestleistungen – getExerciseProgress. */
export function getExerciseProgress(sessions: WorkoutSession[], exerciseId: string): { points: ProgressPoint[]; records: PersonalRecord[] } {
  const entries = exerciseHistory(sessions, exerciseId).reverse();
  return {
    points: entries.map((e) => ({
      sessionId: e.sessionId,
      date: e.date.toISOString(),
      workingWeight: e.workingWeight,
      topWeight: e.topWeight,
      bestReps: e.bestReps,
      totalReps: e.totalReps,
      bestDuration: e.bestDuration,
      volumeKg: e.volumeKg,
      e1rm: e.e1rm,
    })),
    records: recordsFor(exerciseId, entries),
  };
}

function recordsFor(exerciseId: string, chronological: ExerciseEntry[]): PersonalRecord[] {
  const out: PersonalRecord[] = [];
  let bestWeight = 0;
  let bestReps = 0;
  let bestDuration = 0;
  chronological.forEach((e, i) => {
    const first = i === 0; // Die erste Einheit ist der Ausgangswert, keine Bestleistung.
    if (e.topWeight !== null) {
      if (!first && e.topWeight > bestWeight) out.push({ exerciseId, sessionId: e.sessionId, date: e.date.toISOString(), kind: 'weight', value: e.topWeight, previous: bestWeight });
      bestWeight = Math.max(bestWeight, e.topWeight);
    } else if (e.bestReps > 0) {
      if (!first && bestReps > 0 && e.bestReps > bestReps) out.push({ exerciseId, sessionId: e.sessionId, date: e.date.toISOString(), kind: 'reps', value: e.bestReps, previous: bestReps });
      bestReps = Math.max(bestReps, e.bestReps);
    } else if (e.bestDuration > 0) {
      if (!first && bestDuration > 0 && e.bestDuration > bestDuration) out.push({ exerciseId, sessionId: e.sessionId, date: e.date.toISOString(), kind: 'duration', value: e.bestDuration, previous: bestDuration });
      bestDuration = Math.max(bestDuration, e.bestDuration);
    }
  });
  return out;
}

/** Alle persönlichen Bestleistungen über alle Übungen. */
export function allPersonalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const ids = new Set(sessions.flatMap((s) => s.sets.map((x) => x.exerciseId)));
  return [...ids].flatMap((id) => getExerciseProgress(sessions, id).records).sort((a, b) => a.date.localeCompare(b.date));
}

export interface PlateauResult {
  status: 'insufficient-data' | 'progressing' | 'possible-plateau';
  message: string;
  sessionsConsidered: number;
}

export const PLATEAU_RULES = { minSessions: 4, minSpanDays: 21, recentWindow: 3, lookbackDays: 70 } as const;

/**
 * Mögliches Leistungsplateau: frühestens nach 4 Einheiten über mind. 3 Wochen, und nur wenn
 * die letzten 3 Einheiten keine bessere Leistung als zuvor gebracht haben.
 */
export function detectPossiblePlateau(sessions: WorkoutSession[], exerciseId: string, now: Date): PlateauResult {
  const since = new Date(now.getTime() - PLATEAU_RULES.lookbackDays * 86_400_000);
  const entries = exerciseHistory(sessions, exerciseId).filter((e) => e.date >= since).reverse();
  const n = entries.length;
  const span = n ? (entries[n - 1].date.getTime() - entries[0].date.getTime()) / 86_400_000 : 0;
  if (n < PLATEAU_RULES.minSessions || span < PLATEAU_RULES.minSpanDays) {
    return { status: 'insufficient-data', message: 'Sammle noch einige Trainingseinheiten, damit wir eine zuverlässigere Aussage treffen können.', sessionsConsidered: n };
  }
  const recent = entries.slice(-PLATEAU_RULES.recentWindow);
  const earlier = entries.slice(0, -PLATEAU_RULES.recentWindow);
  const bestEarlier = Math.max(...earlier.map(performanceOf));
  const bestRecent = Math.max(...recent.map(performanceOf));
  if (bestRecent > bestEarlier) {
    return { status: 'progressing', message: 'Deine Leistung steigt noch.', sessionsConsidered: n };
  }
  return {
    status: 'possible-plateau',
    message: `In den letzten ${recent.length} Einheiten hast du deine bisherige Bestleistung nicht übertroffen. Das kann ein Plateau sein – oder einfach eine normale Schwankung. Mögliche Hebel: gut schlafen, Pausen einhalten, eine leichtere Woche einlegen oder die Übung variieren.`,
    sessionsConsidered: n,
  };
}

export function fmt(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}
