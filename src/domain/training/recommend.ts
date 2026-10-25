import type { Exercise, LoadType, PlannedExercise, Profile, Settings, WorkoutSession } from '../types';
import { ageGroup } from './age';
import { exerciseHistory, fmt, uniqueSessions, type ExerciseEntry } from './history';
import { loadStepFor, loadTypeOf, reduceLoad, roundToStep } from './loads';
import { formatRir, recommendPrescription } from './prescription';

// recommendExerciseLoad: konservative, nachvollziehbare Belastungsempfehlung für die nächste Einheit.
// Grundlage ist die bisherige Leistung bei genau dieser Übung. Alter, Größe und Körpergewicht
// werden nie in ein Gewicht umgerechnet.

export type LoadStatus = 'find' | 'hold' | 'increase' | 'decrease' | 'pause';

export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
  find: 'Gewicht ermitteln',
  hold: 'Gewicht beibehalten',
  increase: 'Kleine Steigerung möglich',
  decrease: 'Vorübergehend reduzieren',
  pause: 'Pausieren oder ersetzen',
};

export interface ExerciseRecommendation {
  exerciseId: string;
  status: LoadStatus;
  headline: string;
  /** Konkretes Gewicht nur, wenn genug Daten vorliegen; sonst null. */
  suggestedLoadKg: number | null;
  /** Arbeitsgewicht der letzten Einheit */
  lastLoadKg: number | null;
  loadType: LoadType;
  loadStepKg: number;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  targetDurationSec?: number;
  restSeconds: [number, number];
  targetRepsInReserve: [number, number];
  /** Begründung in ganzen Sätzen */
  reasoning: string[];
  /** Hinweise zur Ausführung und Sicherheit */
  hints: string[];
  basedOnTrainingSessionIds: string[];
  createdAt: string;
}

export interface RecommendOptions {
  now?: Date;
  /** Vorgabe aus dem Trainingsplan; ersetzt Sätze/Wdh./Pause der Standardempfehlung. */
  planned?: PlannedExercise | null;
  settings?: Pick<Settings, 'loadSteps'> | null;
}

export const PROGRESSION_RULES = {
  /** Tage ohne diese Übung, ab denen vorsichtig wieder eingestiegen wird */
  breakDays: 21,
  longBreakDays: 56,
  breakFactor: 0.9,
  longBreakFactor: 0.8,
  missFactor: 0.9,
  /** Ohne dokumentierte Anstrengung braucht eine Steigerung zwei passende Einheiten in Folge */
  confirmationsWithoutFeedback: 2,
} as const;

type ProfileCtx = Pick<Profile, 'goal' | 'experience' | 'daysPerWeek' | 'limitations' | 'ageYears' | 'ageRecordedAt' | 'knownLoads'>;

export function recommendExerciseLoad(
  userProfile: ProfileCtx,
  exercise: Exercise,
  trainingHistory: WorkoutSession[],
  options: RecommendOptions = {},
): ExerciseRecommendation {
  const now = options.now ?? new Date();
  const base = recommendPrescription(exercise, userProfile, now);
  const planned = options.planned;
  const loadType = loadTypeOf(exercise);
  const step = loadStepFor(loadType, options.settings);
  const isTime = exercise.measurement === 'time';
  const usesWeight = exercise.usesWeight && !isTime;

  const target = {
    sets: planned?.sets ?? base.sets,
    repMin: planned && !isTime ? planned.repsMin : base.repsMin,
    repMax: planned && !isTime ? planned.repsMax : base.repsMax,
    duration: planned?.durationSec ?? base.durationSec,
  };
  const rir = base.rir;
  const restSeconds: [number, number] = planned ? [planned.restSec, Math.max(planned.restSec, base.restRange[1])] : base.restRange;
  const hints = [...base.notes, ...exercise.tips.slice(0, 2), 'Technik vor Gewicht: Jede Wiederholung kontrolliert und im vollen, schmerzfreien Bewegungsumfang.'];
  const group = ageGroup(userProfile, now);

  const entries = exerciseHistory(trainingHistory, exercise.id, now);
  const result = (status: LoadStatus, headline: string, suggested: number | null, reasoning: string[], used: ExerciseEntry[]): ExerciseRecommendation => ({
    exerciseId: exercise.id,
    status,
    headline,
    suggestedLoadKg: usesWeight ? suggested : null,
    lastLoadKg: entries[0]?.workingWeight ?? null,
    loadType,
    loadStepKg: step,
    targetSets: target.sets,
    targetRepMin: target.repMin,
    targetRepMax: target.repMax,
    ...(isTime ? { targetDurationSec: target.duration } : {}),
    restSeconds,
    targetRepsInReserve: rir,
    reasoning,
    hints,
    basedOnTrainingSessionIds: used.map((e) => e.sessionId),
    createdAt: now.toISOString(),
  });
  const repText = isTime ? `${target.duration ?? 30} s` : `${target.repMin}–${target.repMax} Wiederholungen`;
  const rirText = `etwa ${formatRir(rir)} Wiederholungen in Reserve`;

  // 1. Eingeschränkter Bereich: keine ungeprüften Belastungsvorgaben.
  const stressed = exercise.stresses.filter((s) => userProfile.limitations.includes(s));
  if (stressed.length) {
    return result('pause', 'Übung ersetzen oder fachlich abklären', null, [
      'Diese Übung belastet einen Bereich, für den du eine Einschränkung angegeben hast.',
      'Wir geben dafür keine Gewichtsempfehlung. Ersetze die Übung im Plan oder lass sie dir von einer Trainerin, einem Trainer oder in der Physiotherapie freigeben.',
    ], []);
  }

  const last = entries[0];

  // 2. Beschwerden beim letzten Mal: keine Steigerung, Übung pausieren.
  if (last?.feedback?.pain) {
    return result('pause', 'Beschwerden beim letzten Mal – erst abklären', null, [
      `Du hast beim letzten Training (${last.date.toLocaleDateString('de-DE')}) Beschwerden bei dieser Übung angegeben.`,
      'Deshalb empfehlen wir keine Steigerung. Pausiere die Übung oder ersetze sie durch eine schmerzfreie Alternative. Halten Beschwerden an, lass sie ärztlich oder physiotherapeutisch abklären.',
    ], [last]);
  }

  // 3. Keine Historie: Gewicht vorsichtig ermitteln.
  if (!last) {
    const known = userProfile.knownLoads?.find((k) => k.exerciseId === exercise.id);
    if (usesWeight && known && known.weightKg > 0) {
      const start = reduceLoad(known.weightKg, step, 0.9);
      return result('find', `Einstieg mit etwa ${fmt(start)} kg`, start, [
        `Du hast ${fmt(known.weightKg)} kg × ${known.reps} als bekannte Leistung angegeben.`,
        `Zum Einstieg in GymQuest schlagen wir etwas weniger vor (${fmt(start)} kg), damit du ${repText} sauber mit ${rirText} schaffst. Passe das Gewicht an, wenn es sich deutlich zu leicht oder zu schwer anfühlt.`,
      ], []);
    }
    if (usesWeight) {
      return result('find', 'Startgewicht ermitteln', null, [
        'Für diese Übung gibt es noch keine Trainingsdaten, deshalb zeigen wir bewusst kein Gewicht an.',
        `So findest du dein Startgewicht: 1–2 leichte Aufwärmsätze mit 10–12 Wiederholungen. Steigere dann in kleinen Schritten, bis du ein Gewicht hast, mit dem du ${repText} sauber schaffst und noch ${rirText} hättest.`,
        'Das Gewicht deines ersten Arbeitssatzes speichern wir als Ausgangspunkt für die nächste Empfehlung.',
      ], []);
    }
    return result('find', isTime ? 'Haltezeit ermitteln' : 'Passende Variante finden', null, [
      'Für diese Übung gibt es noch keine Trainingsdaten.',
      isTime
        ? `Halte die Position, solange die Ausführung sauber bleibt – Ziel sind ${repText}. Notiere die Zeit, die du wirklich geschafft hast.`
        : `Wähle eine Variante, mit der du ${repText} sauber schaffst und noch ${rirText} hättest. Ist es zu schwer, nimm die leichtere Variante (z. B. erhöht oder mit kleinerem Bewegungsumfang).`,
    ], []);
  }

  const daysSince = Math.floor((now.getTime() - last.date.getTime()) / 86_400_000);
  const current = last.workingWeight;

  // 4. Längere Pause: vorsichtiger Wiedereinstieg.
  if (daysSince >= PROGRESSION_RULES.breakDays) {
    const factor = daysSince >= PROGRESSION_RULES.longBreakDays ? PROGRESSION_RULES.longBreakFactor : PROGRESSION_RULES.breakFactor;
    const suggested = usesWeight && current ? reduceLoad(current, step, factor) : null;
    return result('decrease', suggested !== null ? `Wiedereinstieg mit ${fmt(suggested)} kg` : 'Vorsichtig wieder einsteigen', suggested, [
      `Deine letzte Einheit mit dieser Übung ist ${daysSince} Tage her.`,
      suggested !== null
        ? `Nach einer Pause steigen wir mit etwa ${Math.round(factor * 100)} % des letzten Arbeitsgewichts (${fmt(current as number)} kg) ein. Wenn sich alles gut anfühlt, kannst du in den nächsten Einheiten wieder steigern.`
        : 'Nach einer Pause lieber mit etwas weniger Wiederholungen oder einer leichteren Variante beginnen.',
    ], [last]);
  }

  const hitTop = (e: ExerciseEntry) =>
    e.sets.length >= target.sets &&
    (isTime ? e.sets.every((s) => (s.durationSec ?? 0) >= (target.duration ?? 0)) : e.repsAtWorkingWeight.length >= target.sets && e.repsAtWorkingWeight.every((r) => r >= target.repMax));
  const missed = (e: ExerciseEntry) =>
    isTime ? e.sets.filter((s) => (s.durationSec ?? 0) < (target.duration ?? 0) * 0.6).length >= 2 : e.repsAtWorkingWeight.filter((r) => r < target.repMin).length >= 2;

  const effort = last.feedback?.effort ?? null;
  const reasons: string[] = [];
  const prev = entries[1];
  const sameWeight = (a?: ExerciseEntry, b?: ExerciseEntry) => !!a && !!b && a.workingWeight === b.workingWeight;
  const summary = isTime
    ? `Letztes Mal: ${last.sets.map((s) => `${s.durationSec ?? 0} s`).join(', ')}.`
    : `Letztes Mal: ${last.repsAtWorkingWeight.join(', ')} Wiederholungen${current ? ` mit ${fmt(current)} kg` : ''}.`;
  reasons.push(summary);

  // 5. Technik unsicher → beibehalten.
  if (last.feedback?.techniqueUnsure) {
    return result('hold', current ? `Bei ${fmt(current)} kg bleiben` : 'Variante beibehalten', current, [
      ...reasons,
      'Du hast die Technik als unsicher markiert. Deshalb keine Steigerung – festige erst die Ausführung mit dem aktuellen Gewicht.',
    ], [last]);
  }

  // 6. Wiederholungsziel zweimal deutlich verfehlt → reduzieren; einmal → halten.
  if (missed(last)) {
    if (prev && missed(prev) && sameWeight(last, prev) && usesWeight && current) {
      const suggested = reduceLoad(current, step, PROGRESSION_RULES.missFactor);
      return result('decrease', `Auf ${fmt(suggested)} kg reduzieren`, suggested, [
        ...reasons,
        `In den letzten zwei Einheiten mit ${fmt(current)} kg lagen mehrere Sätze unter ${target.repMin} Wiederholungen.`,
        `Mit etwas weniger Gewicht (${fmt(suggested)} kg) kommst du wieder sauber in den Zielbereich und kannst von dort aus neu aufbauen.`,
      ], [last, prev]);
    }
    return result('hold', current ? `Bei ${fmt(current)} kg bleiben` : 'Beibehalten', current, [
      ...reasons,
      `Mehrere Sätze lagen unter dem Ziel von ${target.repMin} Wiederholungen. Bleib erst einmal beim Gewicht und versuche, in den Zielbereich zu kommen.`,
    ], [last]);
  }

  // 7. Oberes Ende erreicht → kleine Steigerung, wenn Anstrengung passt und keine hohe Belastung.
  if (hitTop(last)) {
    const blockers: string[] = [];
    if (effort === 'hard' || effort === 'max') blockers.push('Du hast die Anstrengung als sehr hoch angegeben. Wiederhole das Gewicht, bis es sich kontrollierter anfühlt.');
    const lastWeek = uniqueSessions(trainingHistory).filter((s) => {
      const t = new Date(s.finishedAt).getTime();
      return t <= now.getTime() && t > now.getTime() - 7 * 86_400_000;
    });
    if (lastWeek.length > userProfile.daysPerWeek + 1) blockers.push(`Du hast in den letzten 7 Tagen ${lastWeek.length}-mal trainiert, mehr als geplant. Gönn dir erst Erholung, bevor du steigerst.`);
    if (last.readiness !== null && last.readiness <= 2) blockers.push('Du hast dich beim letzten Training wenig erholt gefühlt. Steigere erst, wenn du wieder fitter bist.');

    const needsConfirmation = !effort || group === 'minor' || group === 'senior';
    const confirmed = !needsConfirmation || (prev && hitTop(prev) && sameWeight(last, prev));
    if (blockers.length === 0 && confirmed) {
      const used = needsConfirmation && prev ? [last, prev] : [last];
      const why =
        used.length === 2
          ? `Du hast den oberen Wiederholungsbereich (${isTime ? `${target.duration} s` : target.repMax}) in allen Sätzen bei zwei vergleichbaren Einheiten erreicht.`
          : `Du hast in allen Sätzen das obere Ende des Bereichs (${isTime ? `${target.duration} s` : target.repMax}) erreicht und die Anstrengung als ${effort === 'easy' ? 'leicht' : 'passend'} angegeben.`;
      if (usesWeight && current) {
        const next = roundToStep(current + step, step);
        const bigJump = (next - current) / current > 0.12;
        return result('increase', `Steigerung auf ${fmt(next)} kg möglich`, next, [
          ...reasons,
          why,
          `Deshalb könnte eine kleine Steigerung um eine Stufe (${fmt(step)} kg) sinnvoll sein – wenn die Ausführung kontrolliert war.${bigJump ? ` Bei diesem Gerät ist der nächste Schritt relativ groß: Es ist normal, wenn du mit ${fmt(next)} kg zunächst nur ${target.repMin} Wiederholungen schaffst.` : ''}`,
          'Die Steigerung ist ein Vorschlag. Wenn es sich nicht gut anfühlt, bleib beim bisherigen Gewicht.',
        ], used);
      }
      return result('increase', isTime ? 'Etwas länger halten' : 'Schwierigere Variante möglich', null, [
        ...reasons,
        why,
        isTime
          ? 'Du kannst die Haltezeit um 5–10 Sekunden verlängern, solange die Position sauber bleibt.'
          : 'Du kannst eine schwierigere Variante probieren (z. B. langsameres Absenken oder ohne Erhöhung) oder 1–2 Wiederholungen mehr pro Satz einplanen.',
        'Das ist ein Vorschlag, keine Pflicht.',
      ], used);
    }
    return result('hold', current ? `Bei ${fmt(current)} kg bleiben` : 'Beibehalten', current, [
      ...reasons,
      ...(blockers.length ? blockers : [`Du hast das obere Ende des Bereichs erreicht. Ohne Angabe zur Anstrengung warten wir auf eine zweite passende Einheit, bevor wir eine Steigerung vorschlagen. Tipp: Gib nach jeder Übung an, wie anstrengend sie war.`]),
    ], prev ? [last, prev] : [last]);
  }

  // 8. Im Zielbereich → beibehalten und Wiederholungen ausbauen.
  return result('hold', current ? `Bei ${fmt(current)} kg bleiben` : 'Beibehalten', current, [
    ...reasons,
    isTime
      ? `Bleib dabei, bis du in allen Sätzen ${target.duration} s sauber halten kannst.`
      : `Bleib bei diesem Gewicht, bis du in allen ${target.sets} Sätzen ${target.repMax} saubere Wiederholungen schaffst. Dann schlagen wir eine kleine Steigerung vor.`,
  ], [last]);
}
