import { getExercise } from '@/data/exercises';
import { addDays, startOfWeek } from '../dates';
import type { Profile, WorkoutSession, XpEvent } from '../types';
import { getLevelProgress } from '../xp';
import { bodySeries } from './body';
import { getExerciseProgress, uniqueSessions } from './history';
import { addMonths, startOfMonth } from './reports';

// Datenreihen für die Diagramme in der Statistik. Alles kommt aus echten Einträgen;
// die Oberfläche zeigt nur noch an.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;

export interface WeekBucket {
  start: Date;
  label: string;
  workouts: number;
  sets: number;
  minutes: number;
  /** laufende Woche */
  running: boolean;
}

export function weeklySeries(sessions: WorkoutSession[], now: Date, weeks = 8): WeekBucket[] {
  const list = uniqueSessions(sessions);
  const thisWeek = startOfWeek(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const end = addDays(start, 7);
    const inWeek = list.filter((s) => {
      const t = new Date(s.finishedAt);
      return t >= start && t < end;
    });
    return {
      start,
      label: dm(start).slice(0, 5),
      workouts: inWeek.length,
      sets: inWeek.reduce((n, s) => n + s.sets.length, 0),
      minutes: Math.round(inWeek.reduce((n, s) => n + s.durationSec, 0) / 60),
      running: i === weeks - 1,
    };
  });
}

export interface MonthBucket {
  start: Date;
  label: string;
  workouts: number;
  minutes: number;
  running: boolean;
}

export function monthlySeries(sessions: WorkoutSession[], now: Date, months = 6): MonthBucket[] {
  const list = uniqueSessions(sessions);
  const current = startOfMonth(now);
  return Array.from({ length: months }, (_, i) => {
    const start = addMonths(current, -(months - 1 - i));
    const end = addMonths(start, 1);
    const inMonth = list.filter((s) => {
      const t = new Date(s.finishedAt);
      return t >= start && t < end;
    });
    return {
      start,
      label: MONTHS_SHORT[start.getMonth()],
      workouts: inMonth.length,
      minutes: Math.round(inMonth.reduce((n, s) => n + s.durationSec, 0) / 60),
      running: i === months - 1,
    };
  });
}

export interface SeriesPoint {
  date: string;
  label: string;
  value: number;
}

export type ExerciseMetric = 'weight' | 'reps' | 'duration';

/** Übungen, die mindestens einmal protokolliert wurden, mit passender Standardgröße fürs Diagramm. */
export function trainedExercises(sessions: WorkoutSession[]): { id: string; name: string; metrics: ExerciseMetric[] }[] {
  const count = new Map<string, number>();
  for (const s of uniqueSessions(sessions)) for (const id of new Set(s.sets.map((x) => x.exerciseId))) count.set(id, (count.get(id) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => {
      const ex = getExercise(id);
      const metrics: ExerciseMetric[] = ex?.measurement === 'time' ? ['duration'] : sessions.some((s) => s.sets.some((x) => x.exerciseId === id && (x.weightKg ?? 0) > 0)) ? ['weight', 'reps'] : ['reps'];
      return { id, name: ex?.name ?? id, metrics };
    });
}

/**
 * Verlauf einer einzelnen Übung: Arbeitsgewicht (kg), beste Wiederholungen oder beste Haltezeit (s)
 * je Einheit. Verschiedene Übungen werden nie gemischt.
 */
export function exerciseSeries(sessions: WorkoutSession[], exerciseId: string, metric: ExerciseMetric): SeriesPoint[] {
  return getExerciseProgress(sessions, exerciseId)
    .points.map((p) => ({
      date: p.date,
      label: dm(new Date(p.date)),
      value: metric === 'weight' ? (p.workingWeight ?? 0) : metric === 'reps' ? p.bestReps : p.bestDuration,
    }))
    .filter((p) => p.value > 0);
}

/** XP-Summe und Level am Ende jeder Woche (letzte `weeks` Wochen). */
export function xpSeries(xpEvents: XpEvent[], now: Date, weeks = 12): { label: string; totalXp: number; level: number }[] {
  const sorted = [...xpEvents].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const thisWeek = startOfWeek(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const end = addDays(start, 7);
    const totalXp = sorted.filter((e) => new Date(e.createdAt) < end).reduce((n, e) => n + e.amount, 0);
    return { label: dm(start).slice(0, 5), totalXp, level: getLevelProgress(totalXp).level };
  });
}

export function bodyWeightSeries(profile: Profile | null): SeriesPoint[] {
  return bodySeries(profile, 'weight').map((e) => ({ date: e.recordedAt, label: dm(new Date(e.recordedAt)), value: e.value }));
}

export function periodLabel(from: Date, to: Date): string {
  return `${dm(from)}${from.getFullYear() !== to.getFullYear() ? from.getFullYear() : ''} – ${dm(to)}${to.getFullYear()}`;
}
