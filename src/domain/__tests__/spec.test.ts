import { BrowserGymRepository } from '@/data/browserRepository';
import { EXERCISES } from '@/data/exercises';
import { applySuggestion, computeSuggestions } from '../adaptations';
import { alternativesFor, exerciseLocations } from '../exerciseInfo';
import { doneMuscleSets, hasAnySets, loadFromSets, muscleDetail, muscleSetsFor, plannedMuscleSets } from '../muscleStats';
import { musclesOf } from '../muscles';
import { buildCustomPlan } from '../planBuilder';
import { buildSplitDays, isExerciseAllowed, splitOptions } from '../planGenerator';
import { DEFAULT_PROFILE_FORM, formFromProfile, profileFromForm } from '../profileSchema';
import { collectPendingRewards, computeChapters, computeWeeklyQuests, isFullWorkout } from '../progression';
import type { Profile, TrainingPlan, WorkoutSession, XpEvent } from '../types';
import { createActiveWorkout, finishWorkout, getNextSession, replaceActiveExercise, togglePause, toggleSkipExercise, activeDurationSec } from '../workout';
import { prescribe } from '../planGenerator';
import { daysForWeek, moveDayInWeek } from '../planMoves';

// Donnerstag, 22.10.2026, 10:00 Ortszeit
const NOW = new Date(2026, 9, 22, 10, 0, 0);
const profile = (patch: Partial<Profile> = {}): Profile => ({ ...profileFromForm(DEFAULT_PROFILE_FORM, NOW.toISOString(), true, null, NOW), ...patch });
let n = 0;
const id = () => `id${n++}`;

function planFor(p: Profile, split: Parameters<typeof buildSplitDays>[0] = 'full', weekdays = [0, 2, 4]): TrainingPlan {
  return buildCustomPlan(buildSplitDays(split, p, EXERCISES, weekdays), NOW);
}

function completeAll(p: TrainingPlan, at: Date, sessionId = 's1'): WorkoutSession {
  const w = createActiveWorkout(p.days[0], sessionId, new Date(at.getTime() - 45 * 60_000), {}, {}, p.name);
  w.exercises.forEach((e) => e.sets.forEach((s) => (s.completed = true)));
  return finishWorkout(w, [], at).session;
}

describe('Neuer Nutzer', () => {
  it('hat keinen automatisch gespeicherten Trainingsplan', async () => {
    const repo = new BrowserGymRepository();
    await repo.resetAll();
    await repo.saveProfile(profile());
    expect(await repo.getActivePlan()).toBeNull();
    expect(getNextSession(null, [], NOW)).toBeNull();
    // Ohne Plan keine Wochenquests und keine erfundenen Ziele
    expect(computeWeeklyQuests({ sessions: [], xpEvents: [], plan: null, now: NOW })).toEqual([]);
  });

  it('zeigt bei fehlenden Daten einen neutralen Zustand', () => {
    expect(hasAnySets(muscleSetsFor('planned', null, [], NOW))).toBe(false);
    expect(hasAnySets(muscleSetsFor('week', null, [], NOW))).toBe(false);
    expect(computeSuggestions({ plan: null, profile: profile(), sessions: [], library: EXERCISES, now: NOW })).toEqual([]);
    const detail = muscleDetail('chest', null, [], NOW);
    expect(detail.exercises).toEqual([]);
    expect(detail.planned.direct).toBe(0);
  });
});

describe('Plan-Ersteller', () => {
  it('bietet nur Aufteilungen an, die zur Häufigkeit passen', () => {
    expect(splitOptions(3, 'intermediate', 'hypertrophy').map((o) => o.id)).toEqual(['full', 'ppl', 'custom']);
    expect(splitOptions(4, 'intermediate', 'hypertrophy').find((o) => o.recommended)?.id).toBe('upper_lower');
    expect(splitOptions(6, 'advanced', 'strength').map((o) => o.id)).toEqual(['ppl', 'custom']);
    // Anfänger: höchstens 3 Krafttage, weitere Tage werden Erholung
    expect(splitOptions(5, 'beginner', 'general').find((o) => o.recommended)?.id).toBe('full');
  });

  it('leitet den Plan aus Ausstattung und Tagen ab', () => {
    const p = profile({ equipment: ['bodyweight'], experience: 'beginner' });
    const plan = planFor(p);
    expect(plan.days.map((d) => d.weekday)).toEqual([0, 2, 4]);
    for (const d of plan.days) {
      expect(d.exercises.length).toBeGreaterThanOrEqual(3);
      for (const e of d.exercises) expect(isExerciseAllowed(EXERCISES.find((x) => x.id === e.exerciseId)!, p)).toBe(true);
    }
  });

  it('nutzt Fitnessstudio-Geräte nur, wenn vorhanden', () => {
    const home = planFor(profile({ equipment: ['bodyweight'] }));
    const gymOnly = (id: string) => EXERCISES.find((e) => e.id === id)!.equipment.every((x) => x === 'gym');
    expect(home.days.flatMap((d) => d.exercises).some((e) => gymOnly(e.exerciseId))).toBe(false);
    expect(exerciseLocations(EXERCISES.find((e) => e.id === 'leg_press')!)).toEqual(['gym']);
  });

  it('berücksichtigt Schwerpunkt-Muskeln', () => {
    const plan = planFor(profile({ equipment: ['bodyweight', 'dumbbells'], focusMuscles: ['calves'] }));
    expect(plan.days.every((d) => d.exercises.some((e) => musclesOf(e.exerciseId).primary.includes('calves')))).toBe(true);
  });

  it('lässt individuelle Tage leer, bis ein Schwerpunkt gewählt wird', () => {
    const days = buildSplitDays('custom', profile(), EXERCISES, [1, 3]);
    expect(days.map((d) => d.exercises.length)).toEqual([0, 0]);
  });

  it('wird gespeichert und wieder geladen', async () => {
    const repo = new BrowserGymRepository();
    await repo.resetAll();
    const plan = planFor(profile());
    await repo.savePlan(plan);
    expect(await repo.getActivePlan()).toEqual(plan);
  });

  it('prüft beim Austausch die Ausstattung', () => {
    const p = profile({ equipment: ['bodyweight'] });
    const bench = EXERCISES.find((e) => e.id === 'bench_press')!;
    const alts = alternativesFor(bench, EXERCISES, p);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => isExerciseAllowed(a, p))).toBe(true);
  });
});

describe('Muskelgruppen', () => {
  it('trennt primäre und sekundäre Muskeln', () => {
    expect(musclesOf('bench_press')).toEqual({ primary: ['chest'], secondary: ['front_delts', 'triceps'] });
  });

  it('zählt direkte Sätze getrennt von indirekter Beteiligung', () => {
    const plan: Pick<TrainingPlan, 'days'> = {
      days: [{ id: 'd', name: 'A', weekday: 0, focus: '', exercises: [{ exerciseId: 'bench_press', sets: 3, repsMin: 8, repsMax: 12, restSec: 90 }, { exerciseId: 'triceps_extension', sets: 2, repsMin: 10, repsMax: 15, restSec: 60 }] }],
    };
    const sets = plannedMuscleSets(plan);
    expect(sets.chest).toEqual({ direct: 3, indirect: 0 });
    // Bankdrücken zählt für den Trizeps nicht als direkter Satz
    expect(sets.triceps).toEqual({ direct: 2, indirect: 3 });
    expect(loadFromSets(sets).front_delts).toBe('secondary');
    expect(loadFromSets(sets).quads).toBe('none');
  });

  it('zählt absolvierte Sätze nur aus abgehakten Sätzen im Zeitraum', () => {
    const plan = planFor(profile({ equipment: ['gym', 'dumbbells'] }));
    const session = completeAll(plan, new Date(2026, 9, 19, 18));
    const week = doneMuscleSets([session], new Date(2026, 9, 19), new Date(2026, 9, 26));
    const before = doneMuscleSets([session], new Date(2026, 9, 12), new Date(2026, 9, 19));
    expect(Object.values(week).some((m) => m.direct > 0)).toBe(true);
    expect(Object.values(before).every((m) => m.direct === 0 && m.indirect === 0)).toBe(true);
  });
});

describe('Training und Historie', () => {
  it('speichert die Einheit mit Momentaufnahme und lädt sie wieder', async () => {
    const repo = new BrowserGymRepository();
    await repo.resetAll();
    const plan = planFor(profile({ equipment: ['gym', 'dumbbells'] }));
    const session = completeAll(plan, NOW);
    await repo.saveSession(session, []);
    const [loaded] = await repo.listSessions();
    expect(loaded.exercises?.length).toBe(plan.days[0].exercises.length);
    expect(loaded.planName).toBe(plan.name);
    expect(loaded.sets.length).toBe(plan.days[0].exercises.reduce((s, e) => s + e.sets, 0));
  });

  it('bleibt nach Planänderungen unverändert', () => {
    const plan = planFor(profile({ equipment: ['gym', 'dumbbells'] }));
    const session = completeAll(plan, NOW);
    const snapshot = JSON.stringify(session);
    const changed: TrainingPlan = { ...plan, days: plan.days.map((d) => ({ ...d, exercises: [...d.exercises, ...d.exercises.slice(0, 1).map((e) => ({ ...e, sets: e.sets + 2 }))] })) };
    // Der geänderte Plan hätte mehr Sätze; die abgeschlossene Einheit zählt trotzdem als vollständig.
    expect(isFullWorkout(session, changed)).toBe(true);
    expect(JSON.stringify(session)).toBe(snapshot);
  });

  it('vermerkt übersprungene und ersetzte Übungen', () => {
    const p = profile({ equipment: ['gym', 'dumbbells'] });
    const plan = planFor(p);
    let w = createActiveWorkout(plan.days[0], 'w', NOW);
    w = toggleSkipExercise(w, 1);
    const original = w.exercises[0].exerciseId;
    const alt = alternativesFor(EXERCISES.find((e) => e.id === original)!, EXERCISES, p).find((a) => !w.exercises.some((e) => e.exerciseId === a.id))!;
    w = replaceActiveExercise(w, 0, prescribe(alt, p))!;
    w.exercises[0].sets.forEach((s) => (s.completed = true));
    w.exercises[2].sets.forEach((s) => (s.completed = true));
    const { session } = finishWorkout(w, [], new Date(NOW.getTime() + 30 * 60_000));
    expect(session.exercises?.[0]).toMatchObject({ exerciseId: alt.id, replacedExerciseId: original });
    expect(session.exercises?.[1].skipped).toBe(true);
    // Nach dem ersten erledigten Satz ist kein Austausch mehr möglich
    expect(replaceActiveExercise(w, 0, prescribe(EXERCISES[0], p))).toBeNull();
  });

  it('rechnet angehaltene Zeit nicht zur Trainingsdauer', () => {
    const plan = planFor(profile());
    let w = createActiveWorkout(plan.days[0], 'w', NOW);
    w = togglePause(w, new Date(NOW.getTime() + 10 * 60_000));
    w = togglePause(w, new Date(NOW.getTime() + 25 * 60_000));
    expect(activeDurationSec(w, new Date(NOW.getTime() + 40 * 60_000))).toBe(25 * 60);
  });
});

describe('Quests, Kapitel und Belohnungen', () => {
  it('vergibt Kapitel-XP nur einmal und erst, wenn alle Schritte erfüllt sind', () => {
    const plan = planFor(profile({ equipment: ['gym', 'dumbbells'] }));
    const sessions = [completeAll(plan, new Date(2026, 9, 19, 18))];
    const noLesson = collectPendingRewards({ sessions, xpEvents: [], plan, now: NOW }, id);
    expect(noLesson.some((r) => r.source === 'chapter')).toBe(false);

    const lesson: XpEvent = { id: 'l', source: 'lesson', refId: 'goblet_squat', amount: 20, createdAt: NOW.toISOString(), label: '' };
    const first = collectPendingRewards({ sessions, xpEvents: [lesson, ...noLesson], plan, now: NOW }, id);
    expect(first.filter((r) => r.source === 'chapter').map((r) => r.refId)).toEqual(['chapter_1']);
    expect(first.find((r) => r.source === 'chapter')?.amount).toBe(150);

    const again = collectPendingRewards({ sessions, xpEvents: [lesson, ...noLesson, ...first], plan, now: NOW }, id);
    expect(again).toEqual([]);
  });

  it('schaltet Kapitel nacheinander frei und passt Ziele an die Erfahrung an', () => {
    const beginner = computeChapters({ sessions: [], xpEvents: [], plan: null, now: NOW, experience: 'beginner' });
    const advanced = computeChapters({ sessions: [], xpEvents: [], plan: null, now: NOW, experience: 'advanced' });
    expect(beginner.map((c) => c.status)).toEqual(['active', 'locked', 'locked', 'locked']);
    expect(beginner[1].steps.find((s) => s.id === 'workouts')?.target).toBeLessThan(advanced[1].steps.find((s) => s.id === 'workouts')!.target);
  });

  it('richtet Wochenquests an der Erfahrung aus und belohnt kein Zusatzvolumen', () => {
    const plan = planFor(profile());
    const b = computeWeeklyQuests({ sessions: [], xpEvents: [], plan, now: NOW, experience: 'beginner' });
    const a = computeWeeklyQuests({ sessions: [], xpEvents: [], plan, now: NOW, experience: 'advanced' });
    expect(b.find((q) => q.id === 'weekly_workouts')?.target).toBe(plan.days.length);
    expect(a.find((q) => q.id === 'weekly_full_workout')!.target).toBeGreaterThan(b.find((q) => q.id === 'weekly_full_workout')!.target);
    expect(b.find((q) => q.id === 'weekly_workouts')?.rewardXp).toBe(100);
    expect(b.every((q) => q.status === 'active' && q.startedAt && q.completedAt === null)).toBe(true);
  });
});

describe('Anpassungsvorschläge', () => {
  it('schlägt bei Beschwerden einen Austausch vor und ändert erst beim Annehmen', () => {
    const p = profile({ equipment: ['gym', 'dumbbells'] });
    const plan = planFor(p);
    const session = completeAll(plan, new Date(2026, 9, 19, 18));
    const painful = plan.days[0].exercises[0].exerciseId;
    session.feedback = [{ exerciseId: painful, pain: true }];
    const list = computeSuggestions({ plan, profile: p, sessions: [session], library: EXERCISES, now: NOW });
    const pain = list.find((s) => s.id.startsWith('pain:'))!;
    expect(pain.reason).toContain('Beschwerden');
    const next = applySuggestion(plan, pain.action, p, EXERCISES)!;
    expect(next.days[0].exercises[0].exerciseId).not.toBe(painful);
    expect(plan.days[0].exercises[0].exerciseId).toBe(painful);
    // Abgelehnte Vorschläge kommen nicht wieder
    expect(computeSuggestions({ plan, profile: p, sessions: [session], library: EXERCISES, now: NOW, dismissed: [pain.id] }).some((s) => s.id === pain.id)).toBe(false);
  });

  it('bietet verpasste Einheiten nur an freien Tagen zum Nachholen an', () => {
    const p = profile();
    const plan = planFor(p, 'full', [0, 2, 4]);
    // Donnerstag ist frei, Montag und Mittwoch sind offen → Mittwoch nachholen
    const list = computeSuggestions({ plan, profile: p, sessions: [], library: EXERCISES, now: NOW });
    expect(list.find((s) => s.action.type === 'catch_up')?.action).toEqual({ type: 'catch_up', dayId: plan.days[1].id });
    // Freitag ist ein Trainingstag → kein zusätzliches Training
    const friday = new Date(2026, 9, 23, 10);
    expect(computeSuggestions({ plan, profile: p, sessions: [], library: EXERCISES, now: friday }).some((s) => s.action.type === 'catch_up')).toBe(false);
  });

  it('weist auf Übungen hin, die nach einer Profiländerung nicht mehr passen', () => {
    const gym = profile({ equipment: ['gym', 'dumbbells'] });
    const plan = planFor(gym);
    const home = { ...gym, equipment: ['bodyweight' as const] };
    const list = computeSuggestions({ plan, profile: home, sessions: [], library: EXERCISES, now: NOW });
    expect(list.some((s) => s.id.startsWith('equipment:'))).toBe(true);
  });
});

describe('Profil', () => {
  it('speichert neue optionale Angaben und lässt fehlende als unbekannt', () => {
    const p = profileFromForm({ ...DEFAULT_PROFILE_FORM, location: 'home', focusMuscles: ['glutes'], history: ' 2 Jahre Fußball ' }, NOW.toISOString());
    expect(p.location).toBe('home');
    expect(p.focusMuscles).toEqual(['glutes']);
    expect(p.history).toBe('2 Jahre Fußball');
    const unknown = profileFromForm(DEFAULT_PROFILE_FORM, NOW.toISOString());
    expect(unknown.location).toBeNull();
    expect(unknown.ageYears).toBeNull();
    expect(formFromProfile(p, null).location).toBe('home');
  });
});

describe('Kompletter Ablauf', () => {
  it('vom ersten Start über den Plan bis zur ersten abgeschlossenen Einheit', async () => {
    const repo = new BrowserGymRepository();
    await repo.resetAll();
    const p = profile({ equipment: ['dumbbells'], experience: 'beginner', goal: 'hypertrophy' });
    await repo.saveProfile(p);
    expect(await repo.getActivePlan()).toBeNull();

    const plan = planFor(p, splitOptions(3, p.experience, p.goal).find((o) => o.recommended)!.id);
    await repo.savePlan(plan);
    const stored = (await repo.getActivePlan())!;

    const session = completeAll(stored, new Date(2026, 9, 19, 18), 'first');
    const workoutXp: XpEvent = { id: 'xp1', source: 'workout', refId: session.id, amount: session.xpEarned, createdAt: session.finishedAt, label: '' };
    const rewards = collectPendingRewards({ sessions: [session], xpEvents: [workoutXp], plan: stored, now: NOW, experience: p.experience }, id);
    await repo.saveSession(session, [workoutXp, ...rewards]);
    // Erneutes Speichern derselben Belohnungen ändert nichts
    await repo.addXpEvents([workoutXp, ...rewards]);

    const events = await repo.listXpEvents();
    expect(session.xpEarned).toBe(60 + 10 * Math.min(10, stored.days[0].exercises.length));
    expect(events.filter((e) => e.source === 'workout')).toHaveLength(1);
    expect(events.map((e) => e.refId)).toContain('first_workout');
    expect((await repo.listSessions())[0].id).toBe('first');
  });
});

describe('Training verschieben', () => {
  const mk = (id: string, weekday: number) => ({ id, name: id, focus: '', weekday, exercises: [{ exerciseId: 'goblet_squat', sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 }] });
  const plan = { id: 'p', name: 'P', createdAt: '2026-10-01T00:00:00.000Z', split: 'x', days: [mk('upper', 2), mk('lower', 4)] } as never;
  const monday = new Date(2026, 9, 26, 9);

  it('verschiebt Oberkörper diese Woche von Mittwoch auf Montag', () => {
    const moved = moveDayInWeek(plan, 'upper', monday, 0, monday);
    expect(daysForWeek(moved, monday).find((d) => d.id === 'upper')?.weekday).toBe(0);
    expect(getNextSession(moved, [], monday)?.day.id).toBe('upper');
    expect(getNextSession(moved, [], monday)?.isToday).toBe(true);
    // Nächste Woche gilt wieder der normale Tag
    expect(daysForWeek(moved, new Date(2026, 10, 2)).find((d) => d.id === 'upper')?.weekday).toBe(2);
  });

  it('tauscht, wenn am Zieltag schon eine Einheit liegt, und hebt Rückverschiebung auf', () => {
    const swapped = moveDayInWeek(plan, 'upper', monday, 4, monday);
    const days = daysForWeek(swapped, monday);
    expect(days.find((d) => d.id === 'upper')?.weekday).toBe(4);
    expect(days.find((d) => d.id === 'lower')?.weekday).toBe(2);
    const back = moveDayInWeek(swapped, 'upper', monday, 2, monday);
    expect(back.moves).toEqual([]);
  });
});
