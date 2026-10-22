import type { Profile, Settings, TrainingPlan, WorkoutSession, XpEvent } from '@/domain/types';
import type { GymRepository } from '../db/repository';
import { recordKey, updateMeta, type SingletonKind, type SyncKind } from './meta';
import { SINGLETON_ID, xpRecordId } from './records';

/**
 * Hüllt die lokale Datenbank ein und merkt sich jede Änderung für den nächsten Upload.
 * Die App schreibt nur über diese Hülle; die Synchronisierung selbst schreibt direkt in `inner`,
 * damit heruntergeladene Daten nicht gleich wieder hochgeladen werden.
 */
export class TrackingRepository implements GymRepository {
  private onChange: (() => void) | null = null;

  constructor(readonly inner: GymRepository) {}

  /** Wird nach jeder Änderung aufgerufen, z. B. um eine Synchronisierung anzustoßen. */
  setChangeListener(listener: (() => void) | null) {
    this.onChange = listener;
  }

  private async mark(entries: [SyncKind, string][], singleton?: SingletonKind) {
    if (entries.length === 0) return;
    const now = new Date().toISOString();
    await updateMeta(this.inner, (meta) => {
      for (const [kind, id] of entries) meta.dirty[recordKey(kind, id)] = now;
      if (singleton) meta.modified[singleton] = now;
    });
    this.onChange?.();
  }

  getProfile() {
    return this.inner.getProfile();
  }
  async saveProfile(profile: Profile) {
    await this.inner.saveProfile(profile);
    await this.mark([['profile', SINGLETON_ID]], 'profile');
  }
  getSettings() {
    return this.inner.getSettings();
  }
  async saveSettings(settings: Settings) {
    await this.inner.saveSettings(settings);
    await this.mark([['settings', SINGLETON_ID]], 'settings');
  }
  getActivePlan() {
    return this.inner.getActivePlan();
  }
  async savePlan(plan: TrainingPlan) {
    await this.inner.savePlan(plan);
    await this.mark([['plan', SINGLETON_ID]], 'plan');
  }
  listSessions() {
    return this.inner.listSessions();
  }
  getSession(id: string) {
    return this.inner.getSession(id);
  }
  async saveSession(session: WorkoutSession, xpEvents: XpEvent[]) {
    await this.inner.saveSession(session, xpEvents);
    await this.mark([['session', session.id], ...xpEvents.map((e): [SyncKind, string] => ['xp', xpRecordId(e)])]);
  }
  async importSessions(sessions: WorkoutSession[]) {
    await this.inner.importSessions(sessions);
    await this.mark(sessions.map((s): [SyncKind, string] => ['session', s.id]));
  }
  listXpEvents() {
    return this.inner.listXpEvents();
  }
  async addXpEvents(events: XpEvent[]) {
    await this.inner.addXpEvents(events);
    await this.mark(events.map((e): [SyncKind, string] => ['xp', xpRecordId(e)]));
  }
  getActiveWorkout() {
    return this.inner.getActiveWorkout();
  }
  saveActiveWorkout(workout: ActiveWorkoutArg) {
    return this.inner.saveActiveWorkout(workout);
  }
  resetAll() {
    return this.inner.resetAll();
  }
  getMeta<T>(key: string) {
    return this.inner.getMeta<T>(key);
  }
  setMeta(key: string, value: unknown) {
    return this.inner.setMeta(key, value);
  }
}

type ActiveWorkoutArg = Parameters<GymRepository['saveActiveWorkout']>[0];
