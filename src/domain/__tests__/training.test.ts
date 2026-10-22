import { EXERCISES, getExercise } from '@/data/exercises';
import {
  analyzeMonthlyProgress,
  analyzeWeeklyProgress,
  exerciseSeries,
  monthlySeries,
  trainedExercises,
  weeklySeries,
  xpSeries,
  clearBodyData,
  currentAge,
  detectPossiblePlateau,
  getExerciseProgress,
  INSUFFICIENT_DATA,
  mergeBodyLog,
  recommendExerciseLoad,
  recommendNextWorkout,
  recommendPrescription,
  withBodyChanges,
  type TrainingData,
} from '../training';
import { generateTrainingPlan } from '../planGenerator';
import { getLevelProgress } from '../xp';
import { formFromProfile, profileFormSchema, profileFromForm } from '../profileSchema';
import { createActiveWorkout, finishWorkout } from '../workout';
import type { Effort, Exercise, Profile, WorkoutSession, XpEvent } from '../types';

const profile: Profile = {
  displayName: 'Luis',
  experience: 'intermediate',
  goal: 'hypertrophy',
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipment: ['gym', 'dumbbells'],
  limitations: [],
  excludedExerciseIds: [],
  onboardingCompleted: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ex = (id: string) => getExercise(id) as Exercise;
const NOW = new Date('2026-10-22T12:00:00'); // Donnerstag

let counter = 0;
function session(date: string, exerciseId: string, reps: number[], weightKg: number | null, opts: { effort?: Effort; pain?: boolean; technique?: boolean; readiness?: number; durationSec?: number; id?: string } = {}): WorkoutSession {
  const id = opts.id ?? `s${++counter}`;
  return {
    id,
    planDayId: null,
    name: 'Test',
    startedAt: date,
    finishedAt: date,
    durationSec: opts.durationSec ?? 3000,
    xpEarned: 50,
    sets: reps.map((r, i) => ({ exerciseId, setIndex: i, reps: r, weightKg, durationSec: null, completed: true })),
    feedback: opts.effort || opts.pain || opts.technique ? [{ exerciseId, effort: opts.effort ?? null, pain: opts.pain, techniqueUnsure: opts.technique }] : undefined,
    readiness: opts.readiness ?? null,
  };
}
const planned = (exerciseId: string, sets = 3, repsMin = 8, repsMax = 12) => ({ exerciseId, sets, repsMin, repsMax, restSec: 90 });

describe('recommendPrescription (Sätze und Wiederholungen)', () => {
  it('unterscheidet Kraft-Hauptübung, Muskelaufbau und Isolation', () => {
    const strength = recommendPrescription(ex('back_squat'), { ...profile, goal: 'strength' }, NOW);
    expect(strength.repsMin).toBeGreaterThanOrEqual(4);
    expect(strength.repsMax).toBeLessThanOrEqual(8);
    expect(strength.restRange[0]).toBeGreaterThanOrEqual(120);
    const hyper = recommendPrescription(ex('dumbbell_bench_press'), profile, NOW);
    expect([hyper.repsMin, hyper.repsMax]).toEqual([8, 12]);
    const iso = recommendPrescription(ex('lateral_raise'), profile, NOW);
    expect([iso.repsMin, iso.repsMax]).toEqual([10, 15]);
    expect(iso.sets).toBeLessThanOrEqual(3);
  });

  it('gibt Einsteigern höchstens 3 Arbeitssätze und viel Reserve', () => {
    for (const e of EXERCISES) {
      const p = recommendPrescription(e, { ...profile, experience: 'beginner', goal: 'strength' }, NOW);
      expect(p.sets).toBeLessThanOrEqual(3);
      expect(p.rir[0]).toBeGreaterThanOrEqual(2);
    }
  });

  it('reduziert Sätze pro Einheit bei vielen Trainingstagen', () => {
    const few = recommendPrescription(ex('dumbbell_bench_press'), { ...profile, experience: 'advanced' }, NOW);
    const many = recommendPrescription(ex('dumbbell_bench_press'), { ...profile, experience: 'advanced', daysPerWeek: 5 }, NOW);
    expect(many.sets).toBe(few.sets - 1);
  });

  it('ist für Minderjährige vorsichtig: keine niedrigen Wiederholungen, mehr Reserve', () => {
    const teen = { ...profile, goal: 'strength' as const, experience: 'advanced' as const, ageYears: 15, ageRecordedAt: NOW.toISOString() };
    const p = recommendPrescription(ex('back_squat'), teen, NOW);
    expect(p.repsMin).toBeGreaterThanOrEqual(8);
    expect(p.sets).toBeLessThanOrEqual(3);
    expect(p.rir[0]).toBeGreaterThanOrEqual(3);
    expect(p.notes.join(' ')).toMatch(/keine Maximalversuche/);
  });
});

describe('Alter und Körpermaße', () => {
  it('schreibt das Alter ab dem Erfassungsdatum fort und verwirft unplausible Werte', () => {
    expect(currentAge({ ageYears: 30, ageRecordedAt: '2024-10-01T00:00:00.000Z' }, NOW)).toBe(32);
    expect(currentAge({ ageYears: 5, ageRecordedAt: null }, NOW)).toBeNull();
    expect(currentAge({ ageYears: Number.NaN }, NOW)).toBeNull();
    expect(currentAge({}, NOW)).toBeNull();
  });

  it('speichert Gewicht und Größe mit Datum und ignoriert ungültige Werte', () => {
    let id = 0;
    const p1 = withBodyChanges(null, { ...profile, bodyWeightKg: 80, heightCm: 182 }, NOW, () => `b${++id}`);
    expect(p1.bodyLog?.entries.map((e) => [e.kind, e.value])).toEqual([['weight', 80], ['height', 182]]);
    const p2 = withBodyChanges(p1, { ...p1, bodyWeightKg: 79 }, new Date('2026-11-01'), () => `b${++id}`);
    expect(p2.bodyLog?.entries).toHaveLength(3);
    const p3 = withBodyChanges(p2, { ...p2, bodyWeightKg: 900, heightCm: 20 }, NOW, () => `b${++id}`);
    expect(p3.bodyLog?.entries).toHaveLength(3);
  });

  it('löscht Körperdaten auch beim Zusammenführen mit einem anderen Gerät', () => {
    const old = { entries: [{ id: 'a', kind: 'weight' as const, value: 80, recordedAt: '2026-10-01T00:00:00.000Z' }] };
    const cleared = clearBodyData({ ...profile, bodyLog: old, bodyWeightKg: 80, ageYears: 30 }, NOW);
    expect(cleared.ageYears).toBeNull();
    const merged = mergeBodyLog(cleared.bodyLog, old);
    expect(merged.entries).toEqual([]);
    const later = { entries: [{ id: 'b', kind: 'weight' as const, value: 78, recordedAt: '2026-10-23T00:00:00.000Z' }] };
    expect(mergeBodyLog(merged, later).entries.map((e) => e.id)).toEqual(['b']);
  });
});

describe('recommendExerciseLoad', () => {
  const press = ex('dumbbell_bench_press');

  it('zeigt ohne Trainingshistorie kein Gewicht, sondern einen Weg zum Startgewicht', () => {
    const r = recommendExerciseLoad(profile, press, [], { now: NOW });
    expect(r.status).toBe('find');
    expect(r.suggestedLoadKg).toBeNull();
    expect(r.reasoning.join(' ')).toMatch(/Aufwärmsätze/);
    expect(r.basedOnTrainingSessionIds).toEqual([]);
  });

  it('nutzt eine bekannte Leistung vorsichtig als Einstieg', () => {
    const r = recommendExerciseLoad({ ...profile, knownLoads: [{ exerciseId: press.id, weightKg: 20, reps: 10, recordedAt: '' }] }, press, [], { now: NOW });
    expect(r.status).toBe('find');
    expect(r.suggestedLoadKg).toBe(18);
  });

  it('rechnet Körpergewicht und Größe nie in ein Trainingsgewicht um', () => {
    const a = recommendExerciseLoad({ ...profile }, press, [], { now: NOW });
    const b = recommendExerciseLoad({ ...profile, ...{ bodyWeightKg: 120, heightCm: 200 } } as Profile, press, [], { now: NOW });
    expect(a.suggestedLoadKg).toBeNull();
    expect(b.suggestedLoadKg).toBeNull();
  });

  it('schlägt nach erreichtem oberen Bereich und passender Anstrengung eine kleine Steigerung vor', () => {
    const h = [session('2026-10-20T10:00:00', press.id, [12, 12, 12], 20, { effort: 'good' })];
    const r = recommendExerciseLoad(profile, press, h, { now: NOW, planned: planned(press.id) });
    expect(r.status).toBe('increase');
    expect(r.suggestedLoadKg).toBe(22); // Kurzhantel: 2 kg Stufe
    expect(r.reasoning.join(' ')).toMatch(/Vorschlag/);
    expect(r.basedOnTrainingSessionIds).toEqual([h[0].id]);
  });

  it('beachtet die Gewichtsstufen des Geräts', () => {
    const row = ex('seated_cable_row');
    const h = [session('2026-10-20T10:00:00', row.id, [12, 12, 12], 45, { effort: 'easy' })];
    expect(recommendExerciseLoad(profile, row, h, { now: NOW, planned: planned(row.id) }).suggestedLoadKg).toBe(50);
    expect(recommendExerciseLoad(profile, row, h, { now: NOW, planned: planned(row.id), settings: { loadSteps: { machine: 2.5 } } }).suggestedLoadKg).toBe(47.5);
    const bench = ex('bench_press');
    const hb = [session('2026-10-20T10:00:00', bench.id, [12, 12, 12], 60, { effort: 'good' })];
    expect(recommendExerciseLoad(profile, bench, hb, { now: NOW, planned: planned(bench.id) }).suggestedLoadKg).toBe(62.5);
  });

  it('verlangt ohne Angabe zur Anstrengung zwei passende Einheiten', () => {
    const one = [session('2026-10-20T10:00:00', press.id, [12, 12, 12], 20)];
    expect(recommendExerciseLoad(profile, press, one, { now: NOW, planned: planned(press.id) }).status).toBe('hold');
    const two = [session('2026-10-16T10:00:00', press.id, [12, 12, 12], 20), ...one];
    const r = recommendExerciseLoad(profile, press, two, { now: NOW, planned: planned(press.id) });
    expect(r.status).toBe('increase');
    expect(r.reasoning.join(' ')).toMatch(/zwei vergleichbaren Einheiten/);
  });

  it('steigert nicht bei hoher Anstrengung, unsicherer Technik oder Beschwerden', () => {
    const base = (o: Parameters<typeof session>[4]) => [session('2026-10-20T10:00:00', press.id, [12, 12, 12], 20, o)];
    expect(recommendExerciseLoad(profile, press, base({ effort: 'max' }), { now: NOW, planned: planned(press.id) }).status).toBe('hold');
    expect(recommendExerciseLoad(profile, press, base({ effort: 'good', technique: true }), { now: NOW, planned: planned(press.id) }).status).toBe('hold');
    const pain = recommendExerciseLoad(profile, press, base({ effort: 'good', pain: true }), { now: NOW, planned: planned(press.id) });
    expect(pain.status).toBe('pause');
    expect(pain.suggestedLoadKg).toBeNull();
  });

  it('hält das Gewicht bei einmal verfehltem Ziel und reduziert nach zweimal', () => {
    const miss1 = [session('2026-10-20T10:00:00', press.id, [7, 6, 6], 24, { effort: 'max' })];
    expect(recommendExerciseLoad(profile, press, miss1, { now: NOW, planned: planned(press.id) }).status).toBe('hold');
    const miss2 = [session('2026-10-16T10:00:00', press.id, [7, 6, 5], 24), ...miss1];
    const r = recommendExerciseLoad(profile, press, miss2, { now: NOW, planned: planned(press.id) });
    expect(r.status).toBe('decrease');
    expect(r.suggestedLoadKg).toBe(22);
  });

  it('steigt nach längerer Pause vorsichtig wieder ein', () => {
    const h = [session('2026-08-01T10:00:00', press.id, [12, 12, 12], 30, { effort: 'good' })];
    const r = recommendExerciseLoad(profile, press, h, { now: NOW, planned: planned(press.id) });
    expect(r.status).toBe('decrease');
    expect(r.suggestedLoadKg).toBe(24); // 80 % nach über 8 Wochen
  });

  it('gibt bei angegebener Einschränkung keine Gewichtsempfehlung', () => {
    const squat = ex('back_squat');
    const r = recommendExerciseLoad({ ...profile, limitations: ['knees'] }, squat, [session('2026-10-20T10:00:00', squat.id, [12, 12, 12], 60, { effort: 'good' })], { now: NOW });
    expect(r.status).toBe('pause');
    expect(r.suggestedLoadKg).toBeNull();
  });

  it('schlägt bei Körpergewichtsübungen eine schwierigere Variante statt eines Gewichts vor', () => {
    const push = ex('push_up');
    const r = recommendExerciseLoad(profile, push, [session('2026-10-20T10:00:00', push.id, [12, 12, 12], null, { effort: 'good' })], { now: NOW, planned: planned(push.id) });
    expect(r.status).toBe('increase');
    expect(r.suggestedLoadKg).toBeNull();
    expect(r.loadType).toBe('bodyweight');
  });

  it('verlangt bei Minderjährigen immer zwei bestätigende Einheiten', () => {
    const teen = { ...profile, ageYears: 16, ageRecordedAt: NOW.toISOString() };
    const h = [session('2026-10-20T10:00:00', press.id, [12, 12, 12], 10, { effort: 'easy' })];
    expect(recommendExerciseLoad(teen, press, h, { now: NOW, planned: planned(press.id) }).status).toBe('hold');
  });

  it('bremst Steigerungen bei ungewöhnlich vielen Trainings', () => {
    const h = [1, 2, 3, 4, 5].map((d) => session(`2026-10-${15 + d}T10:00:00`, press.id, [12, 12, 12], 20, { effort: 'good' }));
    const r = recommendExerciseLoad(profile, press, h, { now: NOW, planned: planned(press.id) });
    expect(r.status).toBe('hold');
    expect(r.reasoning.join(' ')).toMatch(/Erholung/);
  });
});

describe('Bestleistungen und Plateau', () => {
  const id = 'dumbbell_bench_press';
  it('zählt die erste Einheit nicht als Bestleistung', () => {
    const h = [session('2026-10-01T10:00:00', id, [10, 10], 20), session('2026-10-08T10:00:00', id, [10, 10], 22), session('2026-10-15T10:00:00', id, [10, 10], 22)];
    const { records, points } = getExerciseProgress(h, id);
    expect(points).toHaveLength(3);
    expect(records).toEqual([expect.objectContaining({ kind: 'weight', value: 22, previous: 20 })]);
  });

  it('meldet ein Plateau erst bei genug vergleichbaren Einheiten', () => {
    const few = [session('2026-10-10T10:00:00', id, [10, 10], 20), session('2026-10-15T10:00:00', id, [10, 10], 20), session('2026-10-20T10:00:00', id, [10, 10], 20)];
    expect(detectPossiblePlateau(few, id, NOW).status).toBe('insufficient-data');
    const flat = ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18'].map((d) => session(`${d}T10:00:00`, id, [10, 10, 10], 20));
    const r = detectPossiblePlateau(flat, id, NOW);
    expect(r.status).toBe('possible-plateau');
    expect(r.message).toMatch(/kann ein Plateau sein/);
    const rising = flat.map((s, i) => ({ ...s, sets: s.sets.map((x) => ({ ...x, reps: 8 + i })) }));
    expect(detectPossiblePlateau(rising, id, NOW).status).toBe('progressing');
  });
});

describe('Wochenbericht', () => {
  const plan = generateTrainingPlan(profile, EXERCISES, NOW);
  const xp = (amount: number, at: string, source: XpEvent['source'] = 'workout', refId = at): XpEvent => ({ id: refId, source, refId, amount, createdAt: at, label: source === 'quest' ? 'Quest: Drei Trainings' : 'Training' });

  it('berechnet die Woche aus echten Daten und zählt doppelte Trainings nur einmal', () => {
    const a = session('2026-10-19T10:00:00', 'dumbbell_bench_press', [12, 12, 12], 20, { durationSec: 2700, effort: 'good' });
    const b = session('2026-10-21T18:00:00', 'lat_pulldown', [10, 10], 40, { durationSec: 1800 });
    const old = session('2026-10-12T10:00:00', 'dumbbell_bench_press', [10, 10, 10], 20);
    const data: TrainingData = { profile, plan, sessions: [a, b, { ...b }, old], xpEvents: [xp(100, '2026-10-19T10:00:00'), xp(80, '2026-10-21T18:00:00'), xp(50, '2026-10-21T18:00:00', 'quest', 'q1'), xp(999, '2026-10-12T10:00:00')] };
    const w = analyzeWeeklyProgress(data, NOW, NOW);
    expect(w.provisional).toBe(true);
    expect(w.completedWorkouts).toBe(2);
    expect(w.plannedWorkouts).toBe(plan.days.length);
    expect(w.totalDurationSeconds).toBe(4500);
    expect(w.completedWorkingSets).toBe(5);
    expect(w.xp.earnedXp).toBe(230);
    expect(w.xp.questsCompleted).toEqual(['Drei Trainings']);
    expect(w.exerciseChanges.find((c) => c.exerciseId === 'dumbbell_bench_press')?.result).toBe('improved');
    expect(w.exerciseChanges.find((c) => c.exerciseId === 'lat_pulldown')?.result).toBe('new');
    expect(w.muscleGroups).toEqual(expect.arrayContaining(['Brust', 'Rücken']));
    expect(w.recovery.daysConsidered).toBe(4);
    expect(w.recovery.restDaysTaken).toBe(2);
    expect(w.nextSteps[0]).toMatch(/Kurzhantel-Bankdrücken/);
  });

  it('markiert vergangene Wochen als abgeschlossen und erfindet bei fehlenden Daten nichts', () => {
    const w = analyzeWeeklyProgress({ profile, plan, sessions: [], xpEvents: [] }, new Date('2026-10-05T10:00:00'), NOW);
    expect(w.provisional).toBe(false);
    expect(w.completedWorkouts).toBe(0);
    expect(w.personalRecords).toEqual([]);
    expect(w.nextSteps).toEqual([INSUFFICIENT_DATA]);
    expect(w.highlights[0].text).toMatch(/kein Training/);
  });

  it('warnt bei ungewöhnlich hoher Belastung', () => {
    const many = [19, 19, 20, 20, 21].map((d, i) => session(`2026-10-${d}T${10 + i}:00:00`, 'push_up', [10, 10], null));
    const w = analyzeWeeklyProgress({ profile, plan, sessions: many, xpEvents: [] }, NOW, NOW);
    expect(w.recovery.highLoadWarnings.length).toBeGreaterThan(0);
  });
});

describe('Monatsbericht', () => {
  const plan = generateTrainingPlan(profile, EXERCISES, NOW);
  const make = (dates: string[]) => dates.map((d) => session(`${d}T10:00:00`, 'dumbbell_bench_press', [10, 10, 10], 20, { durationSec: 3600 }));

  it('vergleicht einen laufenden Monat mit demselben Teilzeitraum des Vormonats', () => {
    const sessions = [...make(['2026-09-02', '2026-09-10', '2026-09-25', '2026-09-29']), ...make(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-20'])];
    const m = analyzeMonthlyProgress({ profile, plan, sessions, xpEvents: [] }, NOW, NOW);
    expect(m.provisional).toBe(true);
    expect(m.label).toBe('Oktober 2026');
    expect(m.completedWorkouts).toBe(4);
    expect(m.totalDurationSeconds).toBe(4 * 3600);
    expect(m.trainingDays).toBe(4);
    expect(m.comparison?.partial).toBe(true);
    expect(m.comparison?.label).toBe('1.–22. September');
    expect(m.comparison?.previousWorkouts).toBe(2); // 25. und 29.9. liegen außerhalb des Vergleichszeitraums
  });

  it('vergleicht abgeschlossene Monate vollständig und zählt erfüllte Wochen', () => {
    const sessions = [...make(['2026-08-05']), ...make(['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-16'])];
    const m = analyzeMonthlyProgress({ profile, plan, sessions, xpEvents: [] }, new Date('2026-09-15'), NOW);
    expect(m.provisional).toBe(false);
    expect(m.comparison).toEqual(expect.objectContaining({ partial: false, previousWorkouts: 1, label: 'August 2026' }));
    expect(m.goalWeeks.total).toBe(3); // 7.–13., 14.–20., 21.–27. September
    expect(m.goalWeeks.met).toBe(1);
  });

  it('zeigt Levelentwicklung und Körpergewicht nur aus vorhandenen Daten', () => {
    const xpEvents: XpEvent[] = [
      { id: '1', source: 'workout', refId: 'a', amount: 90, createdAt: '2026-09-30T10:00:00', label: '' },
      { id: '2', source: 'workout', refId: 'b', amount: 200, createdAt: '2026-10-05T10:00:00', label: '' },
    ];
    const withBody: Profile = { ...profile, bodyLog: { entries: [
      { id: 'w1', kind: 'weight', value: 80, recordedAt: '2026-10-02T08:00:00' },
      { id: 'w2', kind: 'weight', value: 79, recordedAt: '2026-10-20T08:00:00' },
    ] } };
    const m = analyzeMonthlyProgress({ profile: withBody, plan, sessions: make(['2026-10-05']), xpEvents }, NOW, NOW);
    expect(m.xp).toEqual(expect.objectContaining({ earnedXp: 200, levelStart: 1, levelEnd: getLevelProgress(290).level }));
    expect(m.body).toEqual({ weightStart: 80, weightEnd: 79, heightChange: null });
    const empty = analyzeMonthlyProgress({ profile, plan, sessions: [], xpEvents: [] }, NOW, NOW);
    expect(empty.body.weightStart).toBeNull();
    expect(empty.analysis).toEqual([INSUFFICIENT_DATA]);
    expect(empty.comparison).toBeNull();
  });
});

describe('recommendNextWorkout', () => {
  it('liefert die nächste Einheit mit einer Empfehlung je Übung', () => {
    const plan = generateTrainingPlan({ ...profile, equipment: ['gym'] }, EXERCISES, NOW);
    const r = recommendNextWorkout({ profile, plan, sessions: [], xpEvents: [] }, NOW);
    expect(r?.recommendations).toHaveLength(r?.next.day.exercises.length ?? -1);
    expect(r?.recommendations.every((x) => x.status === 'find' || x.status === 'pause')).toBe(true);
  });
});

describe('Diagrammdaten', () => {
  const a = session('2026-10-20T10:00:00', 'dumbbell_bench_press', [10, 10], 20, { durationSec: 1800 });
  const b = session('2026-10-13T10:00:00', 'dumbbell_bench_press', [12, 12], 18, { durationSec: 2400 });
  const c = session('2026-09-10T10:00:00', 'lat_pulldown', [10], 40, { durationSec: 600 });

  it('zählt Wochen und Monate ohne Duplikate und markiert den laufenden Zeitraum', () => {
    const weeks = weeklySeries([a, { ...a }, b, c], NOW, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toEqual(expect.objectContaining({ workouts: 1, sets: 2, minutes: 30, running: true }));
    expect(weeks[6].workouts).toBe(1);
    const months = monthlySeries([a, b, c], NOW, 6);
    expect(months.map((m) => m.label)).toEqual(['Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt']);
    expect(months[5]).toEqual(expect.objectContaining({ workouts: 2, minutes: 70, running: true }));
    expect(months[4].workouts).toBe(1);
  });

  it('zeigt im Übungsverlauf nur die gewählte Übung', () => {
    expect(exerciseSeries([a, b, c], 'dumbbell_bench_press', 'weight').map((p) => p.value)).toEqual([18, 20]);
    expect(exerciseSeries([a, b, c], 'dumbbell_bench_press', 'reps').map((p) => p.value)).toEqual([12, 10]);
    expect(trainedExercises([a, b, c]).map((e) => e.id)).toEqual(['dumbbell_bench_press', 'lat_pulldown']);
  });

  it('berechnet XP und Level je Woche kumuliert', () => {
    const events: XpEvent[] = [
      { id: '1', source: 'workout', refId: 'a', amount: 100, createdAt: '2026-10-13T10:00:00', label: '' },
      { id: '2', source: 'workout', refId: 'b', amount: 200, createdAt: '2026-10-20T10:00:00', label: '' },
    ];
    const s = xpSeries(events, NOW, 3);
    expect(s.map((x) => x.totalXp)).toEqual([0, 100, 300]);
    expect(s[2].level).toBe(getLevelProgress(300).level);
  });
});

describe('Profil und Training speichern', () => {
  it('speichert das Alter mit Datum und behält Verlauf und bekannte Leistungen', () => {
    const prev: Profile = { ...profile, ageYears: 30, ageRecordedAt: '2025-01-01T00:00:00.000Z', knownLoads: [{ exerciseId: 'x', weightKg: 10, reps: 8, recordedAt: '' }], bodyLog: { entries: [] } };
    const same = profileFromForm({ ...formFromProfile(prev, 30) }, prev.createdAt, true, prev, NOW);
    expect(same.ageRecordedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(same.knownLoads).toHaveLength(1);
    const changed = profileFromForm({ ...formFromProfile(prev, 31) }, prev.createdAt, true, prev, NOW);
    expect(changed.ageRecordedAt).toBe(NOW.toISOString());
    expect(profileFormSchema.safeParse({ ...formFromProfile(prev, 8) }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...formFromProfile(prev, 30), heightCm: 20 }).success).toBe(false);
  });

  it('übernimmt Anstrengung, Beschwerden und Tagesform ins gespeicherte Training', () => {
    const plan = generateTrainingPlan(profile, EXERCISES, NOW);
    const day = plan.days[0];
    const w = createActiveWorkout(day, 'w1', NOW, {}, { [day.exercises[0].exerciseId]: 22 });
    expect(w.exercises[0].sets[0].weightKg).toBe(22);
    w.exercises[0].sets[0].completed = true;
    w.exercises[0].feedback = { effort: 'hard', pain: true };
    w.exercises[1].feedback = { effort: 'easy' }; // kein Satz erledigt: wird nicht gespeichert
    w.readiness = 2;
    const { session: s } = finishWorkout(w, [], new Date(NOW.getTime() + 60_000));
    expect(s.feedback).toEqual([{ exerciseId: day.exercises[0].exerciseId, effort: 'hard', pain: true }]);
    expect(s.readiness).toBe(2);
  });
});
