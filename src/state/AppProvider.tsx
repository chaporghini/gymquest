import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { createBackup, parseBackup, restoreBackup, type Backup } from '@/data/backup';
import { BrowserGymRepository } from '@/data/browserRepository';
import { EXERCISES } from '@/data/exercises';
import { DEFAULT_SETTINGS, SqliteGymRepository, type GymRepository } from '@/data/db/repository';
import { TrackingRepository } from '@/data/sync';
import { createId } from '@/domain/dates';
import { generateTrainingPlan } from '@/domain/planGenerator';
import { moveDayInWeek } from '@/domain/planMoves';
import { DEFAULT_PROFILE_FORM, profileFromForm, type ProfileForm } from '@/domain/profileSchema';
import { applySuggestion, type Suggestion } from '@/domain/adaptations';
import { collectPendingRewards } from '@/domain/progression';
import { getRank, type Rank } from '@/domain/ranks';
import { clearBodyData, recommendationsForDay, withBodyChanges, type TrainingData } from '@/domain/training';
import type { ActiveWorkout, Profile, Settings, TrainingPlan, WorkoutSession, XpEvent } from '@/domain/types';
import { createActiveWorkout, finishWorkout, lastSetsByExercise } from '@/domain/workout';
import { getLevelProgress, XP_REWARDS, type LevelProgress, type WorkoutXpBreakdown } from '@/domain/xp';
import { useCloudSync, type CloudSync } from './useCloudSync';

export interface RewardSummary {
  session: WorkoutSession;
  breakdown: WorkoutXpBreakdown;
  rewards: XpEvent[];
  levelBefore: number;
  levelAfter: LevelProgress;
  rankBefore: Rank;
  rankAfter: Rank;
}

interface AppContextValue {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  retry: () => void;
  profile: Profile | null;
  settings: Settings;
  plan: TrainingPlan | null;
  sessions: WorkoutSession[];
  xpEvents: XpEvent[];
  activeWorkout: ActiveWorkout | null;
  level: LevelProgress;
  rank: Rank;
  lastReward: RewardSummary | null;
  cloud: CloudSync;
  completeOnboarding: (form: ProfileForm) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  updateProfile: (form: ProfileForm, regeneratePlan: boolean) => Promise<void>;
  /** Einzelne Profilangaben ändern, z. B. aus dem Plan-Ersteller. */
  patchProfile: (patch: Partial<Profile>) => Promise<void>;
  clearBodyData: () => Promise<void>;
  /** Bekannte Leistung als Startpunkt für eine Übung speichern (null löscht sie). */
  saveKnownLoad: (exerciseId: string, value: { weightKg: number; reps: number } | null) => Promise<void>;
  /** Daten für den Analyse-Service (Berichte, Empfehlungen). */
  trainingData: TrainingData;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  savePlan: (plan: TrainingPlan) => Promise<void>;
  /** Löscht den aktuellen Plan. Vergangene Trainings bleiben unverändert. */
  deletePlan: () => Promise<void>;
  moveTraining: (dayId: string, date: Date, weekday: number) => Promise<void>;
  regeneratePlan: () => Promise<void>;
  /** Techniklektion abschließen (einmal je Übung belohnt). */
  completeLesson: (exerciseId: string) => Promise<XpEvent[]>;
  acceptSuggestion: (s: Suggestion) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  startWorkout: (planDayId: string) => Promise<ActiveWorkout>;
  updateActiveWorkout: (updater: (w: ActiveWorkout) => ActiveWorkout) => void;
  discardWorkout: () => Promise<void>;
  completeWorkout: () => Promise<RewardSummary>;
  resetAll: () => Promise<void>;
  exportBackup: () => Promise<Backup>;
  /** Spielt eine Sicherung ein und gibt die Anzahl der übernommenen Datensätze zurück. */
  importBackup: (json: string) => Promise<number>;
}

function createRepository(): GymRepository {
  // Web-App (auch installiert auf iPhone/Mac): Daten im Browser. SQLite im Browser bräuchte
  // spezielle Server-Header, die GitHub Pages nicht setzt.
  if (Platform.OS === 'web' || process.env.EXPO_PUBLIC_STORAGE === 'browser') return new BrowserGymRepository();
  return new SqliteGymRepository();
}

const AppContext = createContext<AppContextValue | null>(null);

/** Ein gelöschter Plan bleibt gespeichert (für den Cloud-Abgleich), gilt aber als „kein Plan“. */
const visiblePlan = (p: TrainingPlan | null) => (p && !p.deletedAt ? p : null);

export function AppProvider({ children, repository }: { children: ReactNode; repository?: GymRepository }) {
  // Alle Schreibzugriffe der App laufen über TrackingRepository, damit sie in die Cloud übertragen werden.
  const repo = useMemo(() => new TrackingRepository(repository ?? createRepository()), [repository]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [lastReward, setLastReward] = useState<RewardSummary | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  // Schreibzugriffe für das aktive Training nacheinander ausführen, damit kein älterer Stand gewinnt.
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const activeRef = useRef<ActiveWorkout | null>(null);
  useEffect(() => {
    activeRef.current = activeWorkout;
  }, [activeWorkout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus('loading');
        const [p, s, pl, ss, xp, aw] = await Promise.all([
          repo.getProfile(),
          repo.getSettings(),
          repo.getActivePlan(),
          repo.listSessions(),
          repo.listXpEvents(),
          repo.getActiveWorkout(),
        ]);
        if (cancelled) return;
        setProfile(p);
        setSettings(s);
        setPlan(visiblePlan(pl));
        setSessions(ss);
        setXpEvents(xp);
        setActiveWorkout(aw);
        setError(null);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, loadKey]);

  // Nach dem Abgleich mit der Cloud: gespeicherte Daten neu lesen, ohne Ladebildschirm.
  // Das laufende Training bleibt unangetastet, es wird nicht synchronisiert.
  const reloadSynced = useCallback(async () => {
    const [p, s, pl, ss, xp] = await Promise.all([
      repo.getProfile(),
      repo.getSettings(),
      repo.getActivePlan(),
      repo.listSessions(),
      repo.listXpEvents(),
    ]);
    setProfile(p);
    setSettings(s);
    setPlan(visiblePlan(pl));
    setSessions(ss);
    setXpEvents(xp);
  }, [repo]);

  const cloud = useCloudSync(repo, reloadSynced);
  const { signOut: cloudSignOut, syncNow: cloudSyncNow } = cloud;

  const totalXp = useMemo(() => xpEvents.reduce((n, e) => n + e.amount, 0), [xpEvents]);
  const level = useMemo(() => getLevelProgress(totalXp), [totalXp]);
  const rank = useMemo(() => getRank(level.level), [level.level]);

  const createPlanFor = useCallback(async (p: Profile) => {
    const newPlan = generateTrainingPlan(p, EXERCISES);
    await repo.savePlan(newPlan);
    setPlan(newPlan);
  }, [repo]);

  const completeOnboarding = useCallback(async (form: ProfileForm) => {
    const now = new Date();
    const p = withBodyChanges(null, profileFromForm(form, now.toISOString(), true, null, now), now, () => createId('body'));
    // Kein automatischer Plan: der Nutzer erstellt ihn bewusst über den Plan-Ersteller.
    await repo.saveProfile(p);
    setProfile(p);
  }, [repo]);

  const skipOnboarding = useCallback(async () => {
    // Fehlende Angaben bleiben auf Standardwerten und sind als unvollständig markiert. Später im Profil anpassbar.
    const p = profileFromForm(DEFAULT_PROFILE_FORM, new Date().toISOString(), false);
    await repo.saveProfile(p);
    setProfile(p);
  }, [repo]);

  const updateProfile = useCallback(async (form: ProfileForm, regenerate: boolean) => {
    const now = new Date();
    const p = withBodyChanges(profile, profileFromForm(form, profile?.createdAt ?? now.toISOString(), true, profile, now), now, () => createId('body'));
    await repo.saveProfile(p);
    setProfile(p);
    if (regenerate) await createPlanFor(p);
  }, [repo, profile, createPlanFor]);

  const patchProfile = useCallback(async (patch: Partial<Profile>) => {
    if (!profile) return;
    const p = { ...profile, ...patch };
    await repo.saveProfile(p);
    setProfile(p);
  }, [repo, profile]);

  const clearBody = useCallback(async () => {
    if (!profile) return;
    const p = clearBodyData(profile, new Date());
    await repo.saveProfile(p);
    setProfile(p);
  }, [repo, profile]);

  const saveKnownLoad = useCallback(async (exerciseId: string, value: { weightKg: number; reps: number } | null) => {
    if (!profile) return;
    const others = (profile.knownLoads ?? []).filter((k) => k.exerciseId !== exerciseId);
    const knownLoads = value ? [...others, { exerciseId, ...value, recordedAt: new Date().toISOString() }] : others;
    const p = { ...profile, knownLoads };
    await repo.saveProfile(p);
    setProfile(p);
  }, [repo, profile]);

  const trainingData = useMemo<TrainingData>(() => ({ profile, plan, sessions, xpEvents, settings }), [profile, plan, sessions, xpEvents, settings]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    await repo.saveSettings(next);
    setSettings(next);
  }, [repo, settings]);

  /** Verbucht alle fälligen Quest-, Kapitel- und Meilenstein-Belohnungen für den angegebenen Stand. */
  const grantRewards = useCallback(async (state: { plan: TrainingPlan | null; xpEvents: XpEvent[] }) => {
    const rewards = collectPendingRewards(
      { sessions, xpEvents: state.xpEvents, plan: state.plan, now: new Date(), experience: profile?.experience, startedAt: profile?.createdAt },
      () => createId('xp'),
    );
    if (rewards.length) await repo.addXpEvents(rewards);
    const next = [...rewards.slice().reverse(), ...state.xpEvents];
    setXpEvents(next);
    return rewards;
  }, [repo, sessions, profile]);

  const savePlan = useCallback(async (next: TrainingPlan) => {
    const clean = { ...next, deletedAt: null };
    await repo.savePlan(clean);
    setPlan(clean);
    await grantRewards({ plan: clean, xpEvents });
  }, [repo, grantRewards, xpEvents]);

  /** Verschiebt eine Einheit nur für die Woche von `date`. */
  const moveTraining = useCallback(async (dayId: string, date: Date, weekday: number) => {
    if (!plan) return;
    const next = moveDayInWeek(plan, dayId, date, weekday, new Date());
    if (next === plan) return;
    await repo.savePlan(next);
    setPlan(next);
  }, [repo, plan]);

  const deletePlan = useCallback(async () => {
    if (!plan) return;
    await repo.savePlan({ ...plan, deletedAt: new Date().toISOString() });
    setPlan(null);
  }, [repo, plan]);

  const completeLesson = useCallback(async (exerciseId: string) => {
    if (xpEvents.some((e) => e.source === 'lesson' && e.refId === exerciseId)) return [];
    const now = new Date();
    const name = EXERCISES.find((e) => e.id === exerciseId)?.name ?? exerciseId;
    const event: XpEvent = { id: createId('xp'), source: 'lesson', refId: exerciseId, amount: XP_REWARDS.lesson, createdAt: now.toISOString(), label: `Techniklektion: ${name}` };
    await repo.addXpEvents([event]);
    const rewards = await grantRewards({ plan, xpEvents: [event, ...xpEvents] });
    return [event, ...rewards];
  }, [repo, xpEvents, plan, grantRewards]);

  const dismissSuggestion = useCallback(async (id: string) => {
    const list = [...new Set([...(settings.dismissedSuggestions ?? []), id])].slice(-200);
    const next = { ...settings, dismissedSuggestions: list };
    await repo.saveSettings(next);
    setSettings(next);
  }, [repo, settings]);

  const regeneratePlan = useCallback(async () => {
    if (profile) await createPlanFor(profile);
  }, [profile, createPlanFor]);

  const persistActive = useCallback((w: ActiveWorkout | null) => {
    writeQueue.current = writeQueue.current
      .then(() => repo.saveActiveWorkout(w))
      .catch((e) => console.warn('Aktives Training konnte nicht gespeichert werden', e));
    return writeQueue.current;
  }, [repo]);

  const startWorkout = useCallback(async (planDayId: string) => {
    if (activeRef.current) return activeRef.current;
    const day = plan?.days.find((d) => d.id === planDayId);
    if (!day) throw new Error('Diese Trainingseinheit gibt es im Plan nicht mehr.');
    if (day.exercises.length === 0) throw new Error('Diese Einheit enthält noch keine Übungen.');
    const now = new Date();
    const recs = recommendationsForDay(trainingData, day.id, now);
    const suggested = Object.fromEntries(Object.entries(recs).map(([id, r]) => [id, r.suggestedLoadKg]));
    const workout = createActiveWorkout(day, createId('session'), now, lastSetsByExercise(sessions), suggested, plan?.name ?? null);
    setActiveWorkout(workout);
    await persistActive(workout);
    return workout;
  }, [plan, sessions, trainingData, persistActive]);

  const acceptSuggestion = useCallback(async (sg: Suggestion) => {
    if (sg.action.type === 'catch_up') {
      await startWorkout(sg.action.dayId);
      return;
    }
    if (sg.action.type === 'open_exercise' || !plan || !profile) return;
    const next = applySuggestion(plan, sg.action, profile, EXERCISES);
    if (next) {
      await repo.savePlan(next);
      setPlan(next);
    }
  }, [plan, profile, repo, startWorkout]);

  const updateActiveWorkout = useCallback((updater: (w: ActiveWorkout) => ActiveWorkout) => {
    const current = activeRef.current;
    if (!current) return;
    const next = updater(current);
    activeRef.current = next;
    setActiveWorkout(next);
    void persistActive(next);
  }, [persistActive]);

  const discardWorkout = useCallback(async () => {
    activeRef.current = null;
    setActiveWorkout(null);
    await persistActive(null);
  }, [persistActive]);

  const completeWorkout = useCallback(async () => {
    const workout = activeRef.current;
    if (!workout) throw new Error('Kein aktives Training gefunden.');
    await writeQueue.current;
    const now = new Date();
    const { session, xp } = finishWorkout(workout, sessions, now);
    const workoutEvent: XpEvent = {
      id: createId('xp'),
      source: 'workout',
      refId: session.id,
      amount: xp.total,
      createdAt: now.toISOString(),
      label: `Training: ${session.name}`,
    };
    const nextSessions = [session, ...sessions];
    const eventsWithWorkout = [workoutEvent, ...xpEvents];
    const rewards = collectPendingRewards(
      { sessions: nextSessions, xpEvents: eventsWithWorkout, plan, now, experience: profile?.experience, startedAt: profile?.createdAt },
      () => createId('xp'),
    );
    const allNew = [workoutEvent, ...rewards];

    await repo.saveSession(session, allNew);

    const levelBefore = level.level;
    const nextEvents = [...rewards.slice().reverse(), ...eventsWithWorkout];
    const levelAfter = getLevelProgress(nextEvents.reduce((n, e) => n + e.amount, 0));
    const summary: RewardSummary = {
      session,
      breakdown: xp,
      rewards,
      levelBefore,
      levelAfter,
      rankBefore: getRank(levelBefore),
      rankAfter: getRank(levelAfter.level),
    };
    activeRef.current = null;
    setActiveWorkout(null);
    setSessions(nextSessions);
    setXpEvents(nextEvents);
    setLastReward(summary);
    return summary;
  }, [repo, sessions, xpEvents, plan, level.level, profile]);

  const resetAll = useCallback(async () => {
    await writeQueue.current;
    // Abmelden, sonst würde der nächste Abgleich die Cloud-Daten sofort wiederherstellen.
    await cloudSignOut();
    await repo.resetAll();
    activeRef.current = null;
    setProfile(null);
    setSettings(DEFAULT_SETTINGS);
    setPlan(null);
    setSessions([]);
    setXpEvents([]);
    setActiveWorkout(null);
    setLastReward(null);
  }, [repo, cloudSignOut]);

  const exportBackup = useCallback(() => createBackup(repo.inner), [repo]);

  const importBackup = useCallback(async (json: string) => {
    const result = await restoreBackup(repo.inner, parseBackup(json));
    await reloadSynced();
    void cloudSyncNow();
    return result.changed;
  }, [repo, reloadSynced, cloudSyncNow]);

  const value: AppContextValue = {
    status,
    error,
    retry: () => setLoadKey((k) => k + 1),
    profile,
    settings,
    plan,
    sessions,
    xpEvents,
    activeWorkout,
    level,
    rank,
    lastReward,
    cloud,
    completeOnboarding,
    skipOnboarding,
    updateProfile,
    patchProfile,
    clearBodyData: clearBody,
    saveKnownLoad,
    trainingData,
    updateSettings,
    savePlan,
    deletePlan,
    moveTraining,
    regeneratePlan,
    completeLesson,
    acceptSuggestion,
    dismissSuggestion,
    startWorkout,
    updateActiveWorkout,
    discardWorkout,
    completeWorkout,
    resetAll,
    exportBackup,
    importBackup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp muss innerhalb von <AppProvider> verwendet werden.');
  return ctx;
}
