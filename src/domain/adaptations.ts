import { addDays, formatDate, isSameDay, startOfWeek, WEEKDAYS_LONG, weekdayIndex } from './dates';
import { alternativesFor } from './exerciseInfo';
import { plannedMuscleSets } from './muscleStats';
import { MUSCLE_LABELS, musclesOf, type Muscle } from './muscles';
import { estimateDayMinutes, isExerciseAllowed, prescribe } from './planGenerator';
import { sessionsInWeek } from './progression';
import { detectPossiblePlateau } from './training/history';
import type { Exercise, Profile, TrainingPlan, WorkoutSession } from './types';

// Datenbasierte Anpassungsvorschläge. Jeder Vorschlag nennt die Daten, die ihn ausgelöst haben,
// und wird erst übernommen, wenn der Nutzer zustimmt. Nichts wird automatisch am Plan geändert.

export type SuggestionAction =
  | { type: 'add_exercise'; dayId: string; exerciseId: string }
  | { type: 'replace_exercise'; dayId: string; index: number; exerciseId: string }
  | { type: 'remove_exercise'; dayId: string; index: number }
  | { type: 'catch_up'; dayId: string }
  | { type: 'open_exercise'; exerciseId: string };

export interface Suggestion {
  /** Stabil für dieselbe Datenlage, damit ein abgelehnter Vorschlag nicht wiederkommt. */
  id: string;
  title: string;
  /** Welche Daten den Vorschlag ausgelöst haben */
  reason: string;
  /** Was beim Annehmen passiert */
  effect: string;
  acceptLabel: string;
  action: SuggestionAction;
  tone: 'info' | 'warning';
}

export interface SuggestionInput {
  plan: TrainingPlan | null;
  profile: Profile | null;
  sessions: WorkoutSession[];
  library: Exercise[];
  now: Date;
  dismissed?: string[];
}

/** Muskeln, die in einem ausgewogenen Plan direkt vorkommen sollten. */
const KEY_MUSCLES: Muscle[] = ['chest', 'lats', 'upper_back', 'front_delts', 'quads', 'hamstrings', 'glutes', 'abs'];

export function computeSuggestions(input: SuggestionInput): Suggestion[] {
  const { plan, profile, sessions, library, now } = input;
  if (!plan || !profile || plan.days.length === 0) return [];
  const dismissed = new Set(input.dismissed ?? []);
  const result: Suggestion[] = [];
  const nameOf = (id: string) => library.find((e) => e.id === id)?.name ?? id;

  // 1. Beschwerden: zuletzt Schmerzen gemeldet → keine Steigerung, Übung ersetzen anbieten.
  const sorted = [...sessions].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  for (const day of plan.days) {
    day.exercises.forEach((pe, index) => {
      const last = sorted.find((s) => s.sets.some((x) => x.exerciseId === pe.exerciseId && x.completed));
      const fb = last?.feedback?.find((f) => f.exerciseId === pe.exerciseId);
      if (!last || !fb?.pain) return;
      const current = library.find((e) => e.id === pe.exerciseId);
      const alt = current ? alternativesFor(current, library, profile).find((e) => !day.exercises.some((x) => x.exerciseId === e.id)) : undefined;
      const id = `pain:${pe.exerciseId}:${last.id}`;
      if (alt) {
        result.push({
          id,
          title: `${nameOf(pe.exerciseId)} ersetzen?`,
          reason: `Beim Training am ${formatDate(last.finishedAt)} hast du bei dieser Übung Beschwerden angegeben. Setze eine schmerzauslösende Übung nicht einfach fort; halten Beschwerden an, lass sie fachlich abklären.`,
          effect: `Ersetzt sie an ${WEEKDAYS_LONG[day.weekday]} durch ${alt.name}.`,
          acceptLabel: 'Ersetzen',
          action: { type: 'replace_exercise', dayId: day.id, index, exerciseId: alt.id },
          tone: 'warning',
        });
      }
    });
  }

  // 2. Ausstattung oder Einschränkungen passen nicht mehr (z. B. nach Profiländerung).
  for (const day of plan.days) {
    day.exercises.forEach((pe, index) => {
      const ex = library.find((e) => e.id === pe.exerciseId);
      if (!ex || isExerciseAllowed(ex, profile)) return;
      const alt = alternativesFor(ex, library, profile).find((e) => !day.exercises.some((x) => x.exerciseId === e.id));
      if (!alt) return;
      result.push({
        id: `equipment:${day.id}:${pe.exerciseId}:${profile.equipment.join('+')}:${profile.limitations.join('+')}`,
        title: `${ex.name} passt nicht mehr zu deinem Profil`,
        reason: `Laut Profil fehlt die nötige Ausstattung oder die Übung belastet einen Bereich, den du als eingeschränkt angegeben hast.`,
        effect: `Ersetzt sie an ${WEEKDAYS_LONG[day.weekday]} durch ${alt.name}.`,
        acceptLabel: 'Ersetzen',
        action: { type: 'replace_exercise', dayId: day.id, index, exerciseId: alt.id },
        tone: 'warning',
      });
    });
  }

  // 3. Einheit dauert deutlich länger als die verfügbare Zeit.
  for (const day of plan.days) {
    const minutes = estimateDayMinutes(day);
    if (minutes <= profile.sessionMinutes + 10 || day.exercises.length <= 3) continue;
    const index = day.exercises.length - 1;
    result.push({
      id: `time:${day.id}:${minutes}:${profile.sessionMinutes}`,
      title: `${day.name} ist länger als geplant`,
      reason: `Die Einheit dauert geschätzt ${minutes} min, in deinem Profil stehen ${profile.sessionMinutes} min pro Training.`,
      effect: `Entfernt die letzte Übung (${nameOf(day.exercises[index].exerciseId)}).`,
      acceptLabel: 'Kürzen',
      action: { type: 'remove_exercise', dayId: day.id, index },
      tone: 'info',
    });
  }

  // 4. Muskelgruppe bekommt im Plan keine direkten Sätze.
  const planned = plannedMuscleSets(plan);
  const missing = KEY_MUSCLES.filter((m) => planned[m].direct === 0);
  if (missing.length) {
    const target = [...plan.days].filter((d) => d.exercises.length > 0).sort((a, b) => estimateDayMinutes(a) - estimateDayMinutes(b))[0];
    const muscle = missing[0];
    const ex = target && library
      .filter((e) => isExerciseAllowed(e, profile) && musclesOf(e.id).primary.includes(muscle) && !target.exercises.some((x) => x.exerciseId === e.id))
      .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))[0];
    if (target && ex) {
      const sets = prescribe(ex, profile).sets;
      result.push({
        id: `missing:${muscle}:${plan.id}`,
        title: `${MUSCLE_LABELS[muscle]} kommt kaum vor`,
        reason: `In deinem Plan hat ${MUSCLE_LABELS[muscle]} 0 direkte Sätze pro Woche${planned[muscle].indirect ? ` (nur ${planned[muscle].indirect} indirekte)` : ''}.`,
        effect: `Fügt ${ex.name} (${sets} Sätze) zu ${target.name} hinzu, der kürzesten Einheit.`,
        acceptLabel: 'Hinzufügen',
        action: { type: 'add_exercise', dayId: target.id, exerciseId: ex.id },
        tone: 'info',
      });
    }
  }

  // 5. Training diese Woche verpasst und heute ist frei: Nachholen anbieten, nichts erzwingen.
  const weekStart = startOfWeek(now);
  const today = weekdayIndex(now);
  const doneIds = new Set(sessionsInWeek(sessions, weekStart).map((s) => s.planDayId));
  const trainedToday = sessions.some((s) => isSameDay(new Date(s.finishedAt), now));
  const todayPlanned = plan.days.some((d) => d.weekday === today);
  const missed = plan.days.filter((d) => d.weekday < today && !doneIds.has(d.id)).sort((a, b) => b.weekday - a.weekday)[0];
  if (missed && !todayPlanned && !trainedToday) {
    result.push({
      id: `missed:${missed.id}:${addDays(weekStart, missed.weekday).toISOString().slice(0, 10)}`,
      title: `${missed.name} heute nachholen?`,
      reason: `Am ${WEEKDAYS_LONG[missed.weekday]} war ${missed.name} geplant und ist noch offen. Heute ist ein Ruhetag. Ein ausgelassenes Training allein heißt nicht, dass der Plan nicht passt.`,
      effect: 'Startet die Einheit heute. Dein Plan bleibt unverändert.',
      acceptLabel: 'Heute trainieren',
      action: { type: 'catch_up', dayId: missed.id },
      tone: 'info',
    });
  }

  // 6. Übung entwickelt sich über mehrere Einheiten nicht weiter: Verlauf zeigen, keine Steigerung verlangen.
  for (const id of new Set(plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))) {
    const plateau = detectPossiblePlateau(sessions, id, now);
    if (plateau.status !== 'possible-plateau') continue;
    const lastId = sorted.find((s) => s.sets.some((x) => x.exerciseId === id))?.id ?? '';
    result.push({
      id: `plateau:${id}:${lastId}`,
      title: `${nameOf(id)}: Verlauf ansehen`,
      reason: plateau.message,
      effect: 'Öffnet den Verlauf der Übung. Am Plan ändert sich nichts.',
      acceptLabel: 'Verlauf öffnen',
      action: { type: 'open_exercise', exerciseId: id },
      tone: 'info',
    });
  }

  return result.filter((s) => !dismissed.has(s.id));
}

/** Wendet einen angenommenen Vorschlag auf den Plan an. Gibt null zurück, wenn sich der Plan nicht ändert. */
export function applySuggestion(plan: TrainingPlan, action: SuggestionAction, profile: Profile, library: Exercise[]): TrainingPlan | null {
  const ex = 'exerciseId' in action ? library.find((e) => e.id === action.exerciseId) : undefined;
  const mapDay = (dayId: string, fn: (d: TrainingPlan['days'][number]) => TrainingPlan['days'][number]) => ({ ...plan, days: plan.days.map((d) => (d.id === dayId ? fn(d) : d)) });
  switch (action.type) {
    case 'add_exercise':
      return ex ? mapDay(action.dayId, (d) => ({ ...d, exercises: [...d.exercises, prescribe(ex, profile)] })) : null;
    case 'replace_exercise':
      return ex ? mapDay(action.dayId, (d) => ({ ...d, exercises: d.exercises.map((e, i) => (i === action.index ? prescribe(ex, profile) : e)) })) : null;
    case 'remove_exercise':
      return mapDay(action.dayId, (d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== action.index) }));
    default:
      return null;
  }
}
