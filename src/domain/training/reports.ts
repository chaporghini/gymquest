import { getExercise } from '@/data/exercises';
import { addDays, startOfDay, startOfWeek } from '../dates';
import { muscleLabels } from '@/i18n/labels';
import { getRank } from '../ranks';
import type { BodyEntry, MuscleGroup, Profile, Settings, TrainingPlan, WorkoutSession, XpEvent } from '../types';
import { getNextSession, type NextSession } from '../workout';
import { getLevelProgress } from '../xp';
import { compareEntries, detectPossiblePlateau, exerciseHistory, fmt, getExerciseProgress, uniqueSessions, type PersonalRecord } from './history';
import { recommendExerciseLoad, type ExerciseRecommendation } from './recommend';

// Analyse-Service: Wochen- und Monatsberichte ausschließlich aus gespeicherten Daten.
// Die Berichte werden bei jedem Aufruf neu berechnet; dadurch sind sie nach einem Neustart
// sofort wieder da, und Trainings werden über ihre ID nie doppelt gezählt.
// Die App ist lokal auf eine Person ausgelegt; statt einer userId bekommt jede Funktion deren Daten.

export interface TrainingData {
  profile: Profile | null;
  plan: TrainingPlan | null;
  sessions: WorkoutSession[];
  xpEvents: XpEvent[];
  settings?: Pick<Settings, 'loadSteps'> | null;
}

export interface Period {
  start: Date;
  /** exklusiv */
  end: Date;
}

export interface ExerciseChange {
  exerciseId: string;
  name: string;
  result: 'improved' | 'same' | 'lower' | 'new';
  text: string;
}

export interface Highlight {
  tone: 'positive' | 'neutral' | 'warning';
  text: string;
}

export interface XpSummary {
  earnedXp: number;
  levelStart: number;
  levelEnd: number;
  ranksReached: string[];
  questsCompleted: string[];
  achievementsUnlocked: string[];
}

export interface WeeklySummary {
  periodStart: string;
  periodEnd: string;
  /** Woche noch nicht vorbei: Werte sind vorläufig */
  provisional: boolean;
  completedWorkouts: number;
  plannedWorkouts: number;
  goalMet: boolean;
  totalDurationSeconds: number;
  completedWorkingSets: number;
  muscleGroups: string[];
  exerciseChanges: ExerciseChange[];
  personalRecords: (PersonalRecord & { name: string })[];
  plateaus: { exerciseId: string; name: string; message: string }[];
  recovery: {
    plannedRestDays: number;
    /** Tage ohne Training (bis heute, wenn die Woche läuft) */
    restDaysTaken: number;
    daysConsidered: number;
    effortCounts: Record<'easy' | 'good' | 'hard' | 'max', number>;
    averageReadiness: number | null;
    painReports: string[];
    highLoadWarnings: string[];
  };
  xp: XpSummary;
  highlights: Highlight[];
  nextSteps: string[];
  generatedAt: string;
}

export interface MonthlySummary {
  periodStart: string;
  periodEnd: string;
  provisional: boolean;
  label: string;
  completedWorkouts: number;
  trainingDays: number;
  totalDurationSeconds: number;
  averageWorkoutsPerWeek: number;
  completedWorkingSets: number;
  /** Anteil der vollständigen Wochen dieses Monats, in denen das Wochenziel erreicht wurde */
  goalWeeks: { met: number; total: number };
  exerciseDevelopments: ExerciseChange[];
  personalRecords: (PersonalRecord & { name: string })[];
  plateaus: { exerciseId: string; name: string; message: string }[];
  comparison: {
    label: string;
    partial: boolean;
    previousWorkouts: number;
    previousDurationSeconds: number;
    previousSets: number;
  } | null;
  xp: XpSummary;
  body: { weightStart: number | null; weightEnd: number | null; heightChange: { from: number; to: number } | null };
  highlights: Highlight[];
  analysis: string[];
  generatedAt: string;
}

export const INSUFFICIENT_DATA = 'Sammle noch einige Trainingseinheiten, damit wir eine zuverlässigere Empfehlung erstellen können.';

const inRange = (iso: string, p: Period) => {
  const t = new Date(iso).getTime();
  return t >= p.start.getTime() && t < p.end.getTime();
};

export function sessionsIn(sessions: WorkoutSession[], p: Period): WorkoutSession[] {
  return uniqueSessions(sessions).filter((s) => inRange(s.finishedAt, p));
}

const workingSets = (list: WorkoutSession[]) => list.reduce((n, s) => n + s.sets.filter((x) => x.completed).length, 0);
const duration = (list: WorkoutSession[]) => list.reduce((n, s) => n + Math.max(0, s.durationSec), 0);
const nameOf = (id: string) => getExercise(id)?.name ?? id;

function xpSummary(xpEvents: XpEvent[], p: Period): XpSummary {
  const unique = new Map<string, XpEvent>();
  for (const e of xpEvents) unique.set(`${e.source}:${e.refId}`, e);
  const all = [...unique.values()];
  const before = all.filter((e) => new Date(e.createdAt).getTime() < p.start.getTime()).reduce((n, e) => n + e.amount, 0);
  const during = all.filter((e) => inRange(e.createdAt, p));
  const earned = during.reduce((n, e) => n + e.amount, 0);
  const levelStart = getLevelProgress(before).level;
  const levelEnd = getLevelProgress(before + earned).level;
  const rankStart = getRank(levelStart);
  const ranks: string[] = [];
  for (let l = levelStart + 1; l <= levelEnd; l++) {
    const r = getRank(l);
    if (r.id !== rankStart.id && !ranks.includes(r.name)) ranks.push(r.name);
  }
  return {
    earnedXp: earned,
    levelStart,
    levelEnd,
    ranksReached: ranks,
    questsCompleted: during.filter((e) => e.source === 'quest').map((e) => e.label.replace(/^Quest: /, '')),
    achievementsUnlocked: during.filter((e) => e.source === 'achievement').map((e) => e.label.replace(/^Achievement: /, '')),
  };
}

function exerciseChanges(all: WorkoutSession[], period: WorkoutSession[], p: Period): ExerciseChange[] {
  const ids = [...new Set(period.flatMap((s) => s.sets.filter((x) => x.completed).map((x) => x.exerciseId)))];
  return ids.map((id) => {
    const inPeriod = exerciseHistory(period, id); // neueste zuerst
    const latest = inPeriod[0];
    const before = exerciseHistory(all, id, p.start)[0];
    if (!before) return { exerciseId: id, name: nameOf(id), result: 'new' as const, text: 'erstes Mal protokolliert' };
    const c = compareEntries(latest, before);
    return { exerciseId: id, name: nameOf(id), result: c.result, text: c.text };
  });
}

function recordsIn(sessions: WorkoutSession[], p: Period) {
  const ids = new Set(sessions.flatMap((s) => s.sets.map((x) => x.exerciseId)));
  return [...ids]
    .flatMap((id) => getExerciseProgress(sessions, id).records)
    .filter((r) => inRange(r.date, p))
    .reduce<(PersonalRecord & { name: string })[]>((out, r) => {
      // Mehrere Bestleistungen derselben Art im Zeitraum zusammenfassen: von vorher bis zuletzt.
      const same = out.find((o) => o.exerciseId === r.exerciseId && o.kind === r.kind);
      if (same) Object.assign(same, { value: r.value, date: r.date, sessionId: r.sessionId });
      else out.push({ ...r, name: nameOf(r.exerciseId) });
      return out;
    }, []);
}

function plateausFor(all: WorkoutSession[], ids: string[], now: Date) {
  return ids
    .map((id) => ({ id, r: detectPossiblePlateau(all, id, now) }))
    .filter((x) => x.r.status === 'possible-plateau')
    .map((x) => ({ exerciseId: x.id, name: nameOf(x.id), message: x.r.message }));
}

/** analyzeWeeklyProgress: Wochenbericht (Montag bis Sonntag) für die Woche, die `anyDateInWeek` enthält. */
export function analyzeWeeklyProgress(data: TrainingData, anyDateInWeek: Date, now = new Date()): WeeklySummary {
  const start = startOfWeek(anyDateInWeek);
  const p: Period = { start, end: addDays(start, 7) };
  const provisional = now.getTime() < p.end.getTime();
  const all = uniqueSessions(data.sessions).filter((s) => new Date(s.finishedAt).getTime() <= now.getTime());
  const week = sessionsIn(all, p);
  const planned = data.plan?.days.length ?? 0;

  const muscles = new Set<MuscleGroup>();
  for (const s of week) for (const set of s.sets) if (set.completed) {
    const ex = getExercise(set.exerciseId);
    if (ex) muscles.add(ex.muscleGroup);
  }

  // Erholung und Belastung
  const daysConsidered = provisional ? Math.max(0, Math.min(7, Math.floor((startOfDay(now).getTime() - start.getTime()) / 86_400_000) + 1)) : 7;
  const trainingDays = new Set(week.map((s) => startOfDay(new Date(s.finishedAt)).getTime())).size;
  const effortCounts = { easy: 0, good: 0, hard: 0, max: 0 };
  const painReports: string[] = [];
  for (const s of week) for (const f of s.feedback ?? []) {
    if (f.effort) effortCounts[f.effort]++;
    if (f.pain && !painReports.includes(nameOf(f.exerciseId))) painReports.push(nameOf(f.exerciseId));
  }
  const readiness = week.map((s) => s.readiness).filter((r): r is number => typeof r === 'number');
  const highLoad: string[] = [];
  if (planned > 0 && week.length > planned + 1) highLoad.push(`Du hast ${week.length}-mal trainiert, geplant waren ${planned}. Achte auf genug Erholung.`);
  const prevWeeks = [1, 2, 3, 4].map((i) => workingSets(sessionsIn(all, { start: addDays(start, -7 * i), end: addDays(start, -7 * (i - 1)) })));
  const withData = prevWeeks.filter((n) => n > 0);
  const setsNow = workingSets(week);
  if (withData.length >= 2) {
    const avg = withData.reduce((a, b) => a + b, 0) / withData.length;
    if (setsNow > avg * 1.5 && setsNow - avg >= 10) highLoad.push(`Mit ${setsNow} Arbeitssätzen lag die Woche deutlich über deinem Schnitt der letzten Wochen (${Math.round(avg)}). Steigere das Volumen lieber schrittweise.`);
  }
  if (effortCounts.max >= 3) highLoad.push('Du warst bei mehreren Übungen am Limit. Für stetigen Fortschritt reichen meist 1–3 Wiederholungen in Reserve.');

  const changes = exerciseChanges(all, week, p);
  const records = recordsIn(all, p);
  const plateaus = plateausFor(all, changes.map((c) => c.exerciseId), provisional ? now : p.end);
  const xp = xpSummary(data.xpEvents, p);

  const improved = changes.filter((c) => c.result === 'improved');
  const highlights: Highlight[] = [];
  if (week.length === 0) {
    highlights.push({ tone: 'neutral', text: provisional ? 'In dieser Woche gibt es noch kein abgeschlossenes Training.' : 'In dieser Woche wurde kein Training protokolliert.' });
  } else {
    highlights.push({ tone: planned > 0 && week.length >= planned ? 'positive' : 'neutral', text: planned > 0 ? `${week.length} von ${planned} geplanten Einheiten abgeschlossen.` : `${week.length} Einheiten abgeschlossen.` });
    highlights.push({ tone: 'neutral', text: `${Math.round(duration(week) / 60)} Minuten trainiert, ${setsNow} Arbeitssätze dokumentiert.` });
    if (improved.length) highlights.push({ tone: 'positive', text: `Bei ${improved.length === 1 ? 'einer Übung' : `${improved.length} Übungen`} mehr geschafft als in der vorherigen vergleichbaren Einheit.` });
    if (records.length) highlights.push({ tone: 'positive', text: `${records.length === 1 ? 'Eine neue persönliche Bestleistung' : `${records.length} neue persönliche Bestleistungen`} erzielt.` });
    if (xp.earnedXp > 0) highlights.push({ tone: 'neutral', text: `${xp.earnedXp.toLocaleString('de-DE')} XP verdient.` });
  }
  for (const w of highLoad) highlights.push({ tone: 'warning', text: w });
  if (painReports.length) highlights.push({ tone: 'warning', text: `Beschwerden angegeben bei: ${painReports.join(', ')}. Bei anhaltenden Beschwerden bitte fachlich abklären lassen.` });

  const nextSteps = buildNextSteps(data, all, changes.map((c) => c.exerciseId), now);

  return {
    periodStart: p.start.toISOString(),
    periodEnd: p.end.toISOString(),
    provisional,
    completedWorkouts: week.length,
    plannedWorkouts: planned,
    goalMet: planned > 0 && week.length >= planned,
    totalDurationSeconds: duration(week),
    completedWorkingSets: setsNow,
    muscleGroups: [...muscles].map((m) => muscleLabels[m]),
    exerciseChanges: changes,
    personalRecords: records,
    plateaus,
    recovery: {
      plannedRestDays: Math.max(0, 7 - planned),
      restDaysTaken: Math.max(0, daysConsidered - trainingDays),
      daysConsidered,
      effortCounts,
      averageReadiness: readiness.length ? Math.round((readiness.reduce((a, b) => a + b, 0) / readiness.length) * 10) / 10 : null,
      painReports,
      highLoadWarnings: highLoad,
    },
    xp,
    highlights,
    nextSteps,
    generatedAt: now.toISOString(),
  };
}

function buildNextSteps(data: TrainingData, all: WorkoutSession[], exerciseIds: string[], now: Date): string[] {
  if (!data.profile || all.length === 0) return [INSUFFICIENT_DATA];
  const steps: string[] = [];
  for (const id of exerciseIds) {
    const ex = getExercise(id);
    if (!ex) continue;
    const planned = data.plan?.days.flatMap((d) => d.exercises).find((e) => e.exerciseId === id) ?? null;
    const rec = recommendExerciseLoad(data.profile, ex, all, { now, planned, settings: data.settings });
    if (rec.status === 'increase') steps.push(`${ex.name}: ${rec.reasoning.slice(1, 3).join(' ')}`);
    else if (rec.status === 'decrease' || rec.status === 'pause') steps.push(`${ex.name}: ${rec.headline}. ${rec.reasoning.slice(-1)[0]}`);
  }
  if (steps.length === 0) steps.push('Bleib bei deinen aktuellen Gewichten und arbeite dich im Wiederholungsbereich nach oben. Sobald du das obere Ende sauber erreichst, schlagen wir eine Steigerung vor.');
  return steps.slice(0, 3);
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** analyzeMonthlyProgress: Monatsbericht für den Kalendermonat, der `anyDateInMonth` enthält. */
export function analyzeMonthlyProgress(data: TrainingData, anyDateInMonth: Date, now = new Date()): MonthlySummary {
  const start = startOfMonth(anyDateInMonth);
  const end = addMonths(start, 1);
  const p: Period = { start, end };
  const provisional = now.getTime() < end.getTime();
  const all = uniqueSessions(data.sessions).filter((s) => new Date(s.finishedAt).getTime() <= now.getTime());
  const month = sessionsIn(all, p);
  const elapsedEnd = provisional ? new Date(Math.max(start.getTime(), Math.min(end.getTime(), startOfDay(now).getTime() + 86_400_000))) : end;
  const elapsedDays = Math.max(1, Math.round((elapsedEnd.getTime() - start.getTime()) / 86_400_000));

  const trainingDays = new Set(month.map((s) => startOfDay(new Date(s.finishedAt)).getTime())).size;
  const planned = data.plan?.days.length ?? 0;

  // Vollständige Wochen (Mo–So) innerhalb des Monats, die bereits vorbei sind
  let met = 0;
  let total = 0;
  for (let w = startOfWeek(start); w < end; w = addDays(w, 7)) {
    const we = addDays(w, 7);
    if (w < start || we > end || we.getTime() > now.getTime()) continue;
    total++;
    if (planned > 0 && sessionsIn(all, { start: w, end: we }).length >= planned) met++;
  }

  // Entwicklung je Übung: erste vs. letzte Einheit im Monat
  const ids = [...new Set(month.flatMap((s) => s.sets.filter((x) => x.completed).map((x) => x.exerciseId)))];
  const developments: ExerciseChange[] = [];
  for (const id of ids) {
    const entries = exerciseHistory(month, id);
    if (entries.length < 2) continue;
    const c = compareEntries(entries[0], entries[entries.length - 1]);
    developments.push({ exerciseId: id, name: nameOf(id), result: c.result, text: c.text });
  }
  developments.sort((a, b) => (a.result === 'improved' ? -1 : 0) - (b.result === 'improved' ? -1 : 0));

  // Vergleich mit dem Vormonat über denselben Zeitraum
  const prevStart = addMonths(start, -1);
  const prevMonthDays = Math.round((start.getTime() - prevStart.getTime()) / 86_400_000);
  const compareDays = Math.min(elapsedDays, prevMonthDays);
  const prevPeriod: Period = { start: prevStart, end: provisional ? addDays(prevStart, compareDays) : start };
  const prev = sessionsIn(all, prevPeriod);
  const hasEarlierData = all.some((s) => new Date(s.finishedAt) < start);
  const comparison = hasEarlierData
    ? {
        label: provisional ? `1.–${compareDays}. ${MONTHS[prevStart.getMonth()]}` : `${MONTHS[prevStart.getMonth()]} ${prevStart.getFullYear()}`,
        partial: provisional,
        previousWorkouts: prev.length,
        previousDurationSeconds: duration(prev),
        previousSets: workingSets(prev),
      }
    : null;

  const records = recordsIn(all, p);
  const plateaus = plateausFor(all, ids, provisional ? now : end);
  const xp = xpSummary(data.xpEvents, p);
  const body = bodyChanges(data.profile?.bodyLog?.entries ?? [], p);

  const weeks = elapsedDays / 7;
  const avgPerWeek = Math.round((month.length / weeks) * 10) / 10;
  const highlights: Highlight[] = [];
  const analysis: string[] = [];
  if (month.length === 0) {
    highlights.push({ tone: 'neutral', text: provisional ? 'In diesem Monat gibt es noch kein abgeschlossenes Training.' : 'In diesem Monat wurde kein Training protokolliert.' });
    analysis.push(INSUFFICIENT_DATA);
  } else {
    highlights.push({ tone: 'neutral', text: `${month.length} Trainingseinheiten an ${trainingDays} Tagen abgeschlossen.` });
    highlights.push({ tone: 'neutral', text: `${fmtHours(duration(month))} trainiert, ${workingSets(month)} Arbeitssätze.` });
    if (records.length) highlights.push({ tone: 'positive', text: `${records.length === 1 ? 'Eine neue persönliche Bestleistung' : `${records.length} neue persönliche Bestleistungen`}.` });
    if (comparison) {
      const diff = month.length - comparison.previousWorkouts;
      highlights.push({ tone: diff > 0 ? 'positive' : 'neutral', text: diff === 0 ? `Trainingskonstanz wie im Vergleichszeitraum (${comparison.label}).` : `${Math.abs(diff)} Einheiten ${diff > 0 ? 'mehr' : 'weniger'} als im Vergleichszeitraum (${comparison.label}).` });
    }
    if (xp.levelEnd > xp.levelStart) highlights.push({ tone: 'positive', text: `${xp.levelEnd - xp.levelStart === 1 ? '1 neues Level' : `${xp.levelEnd - xp.levelStart} neue Level`} erreicht.` });
    if (xp.earnedXp > 0) highlights.push({ tone: 'neutral', text: `${xp.earnedXp.toLocaleString('de-DE')} XP gesammelt.` });

    if (planned > 0) {
      const ratio = avgPerWeek / planned;
      analysis.push(
        ratio >= 0.9
          ? `Du hast deine Trainingsroutine regelmäßig eingehalten (im Schnitt ${fmt(avgPerWeek)} von ${planned} geplanten Einheiten pro Woche).`
          : ratio >= 0.5
            ? `Im Schnitt ${fmt(avgPerWeek)} Einheiten pro Woche bei ${planned} geplanten. Ein fester Wochentag kann helfen, die Routine zu stabilisieren.`
            : `Im Schnitt ${fmt(avgPerWeek)} Einheiten pro Woche bei ${planned} geplanten. Wenn die Zeit knapp ist, kann ein Plan mit weniger Tagen besser passen.`,
      );
    }
    const improvedSameWeight = developments.filter((d) => d.result === 'improved' && d.text.includes('Wiederholungen'));
    const improvedWeight = developments.filter((d) => d.result === 'improved' && d.text.includes('Arbeitsgewicht'));
    if (improvedSameWeight.length >= 2) analysis.push('Bei mehreren Übungen konntest du mehr Wiederholungen mit demselben Gewicht absolvieren. Das ist ein positives Zeichen für deine Leistungsentwicklung.');
    if (improvedWeight.length) analysis.push(`Bei ${improvedWeight.map((d) => d.name).join(', ')} hast du dein Arbeitsgewicht gesteigert.`);
    if (plateaus.length) analysis.push(`Bei ${plateaus.map((x) => x.name).join(', ')} stagniert die Leistung möglicherweise. Das ist normal und kein Grund zur Sorge – siehe Hinweise unten.`);
    if (developments.length === 0) analysis.push('Für einen Vergleich innerhalb des Monats braucht jede Übung mindestens zwei Einheiten.');
  }

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    provisional,
    label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
    completedWorkouts: month.length,
    trainingDays,
    totalDurationSeconds: duration(month),
    averageWorkoutsPerWeek: avgPerWeek,
    completedWorkingSets: workingSets(month),
    goalWeeks: { met, total },
    exerciseDevelopments: developments,
    personalRecords: records,
    plateaus,
    comparison,
    xp,
    body,
    highlights,
    analysis,
    generatedAt: now.toISOString(),
  };
}

function bodyChanges(entries: BodyEntry[], p: Period): MonthlySummary['body'] {
  const sorted = [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const weights = sorted.filter((e) => e.kind === 'weight' && inRange(e.recordedAt, p));
  const heightsBefore = sorted.filter((e) => e.kind === 'height' && new Date(e.recordedAt) < p.start);
  const heightsIn = sorted.filter((e) => e.kind === 'height' && inRange(e.recordedAt, p));
  const fromHeight = heightsBefore[heightsBefore.length - 1]?.value;
  const toHeight = heightsIn[heightsIn.length - 1]?.value;
  return {
    weightStart: weights[0]?.value ?? null,
    weightEnd: weights.length >= 2 ? weights[weights.length - 1].value : null,
    heightChange: fromHeight !== undefined && toHeight !== undefined && fromHeight !== toHeight ? { from: fromHeight, to: toHeight } : null,
  };
}

function fmtHours(seconds: number) {
  const h = seconds / 3600;
  return h >= 1 ? `${fmt(Math.round(h * 10) / 10)} Stunden` : `${Math.round(seconds / 60)} Minuten`;
}

/** recommendNextWorkout: nächste geplante Einheit mit Empfehlung für jede Übung. */
export function recommendNextWorkout(data: TrainingData, now = new Date()): { next: NextSession; recommendations: ExerciseRecommendation[] } | null {
  const next = getNextSession(data.plan, data.sessions, now);
  if (!next || !data.profile) return null;
  const profile = data.profile;
  const recommendations = next.day.exercises
    .map((pe) => {
      const ex = getExercise(pe.exerciseId);
      return ex ? recommendExerciseLoad(profile, ex, data.sessions, { now, planned: pe, settings: data.settings }) : null;
    })
    .filter((r): r is ExerciseRecommendation => r !== null);
  return { next, recommendations };
}

/** Empfehlungen für alle Übungen einer Einheit, z. B. beim Starten eines Trainings. */
export function recommendationsForDay(data: TrainingData, dayId: string, now = new Date()): Record<string, ExerciseRecommendation> {
  const day = data.plan?.days.find((d) => d.id === dayId);
  const out: Record<string, ExerciseRecommendation> = {};
  if (!day || !data.profile) return out;
  for (const pe of day.exercises) {
    const ex = getExercise(pe.exerciseId);
    if (ex) out[pe.exerciseId] = recommendExerciseLoad(data.profile, ex, data.sessions, { now, planned: pe, settings: data.settings });
  }
  return out;
}

