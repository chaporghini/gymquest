import type { ActiveWorkout, Profile, Settings, TrainingPlan, WorkoutSession, XpEvent } from '@/domain/types';
import { DEFAULT_SETTINGS, type GymRepository } from './db/repository';

// Speicherung im Browser (localStorage) für die reine Web-Vorschau, z. B. als geteilte Webseite.
// Wird nur genutzt, wenn beim Build EXPO_PUBLIC_STORAGE=browser gesetzt ist.
// Auf iPhone und im normalen Expo-Start bleibt SQLite die Datenbank.

const PREFIX = 'gymquest:';
const memoryFallback = new Map<string, string>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(PREFIX + key) ?? null;
  } catch {
    raw = memoryFallback.get(key) ?? null;
  }
  if (raw === null) raw = memoryFallback.get(key) ?? null;
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  if (value === null) memoryFallback.delete(key);
  else memoryFallback.set(key, raw);
  try {
    if (value === null) globalThis.localStorage?.removeItem(PREFIX + key);
    else globalThis.localStorage?.setItem(PREFIX + key, raw);
  } catch {
    // Speicher blockiert (z. B. privates Fenster): Daten bleiben bis zum Neuladen im Speicher.
  }
}

export class BrowserGymRepository implements GymRepository {
  async getProfile() {
    return read<Profile | null>('profile', null);
  }
  async saveProfile(profile: Profile) {
    write('profile', profile);
  }
  async getSettings() {
    return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>('settings', {}) };
  }
  async saveSettings(settings: Settings) {
    write('settings', settings);
  }
  async getActivePlan() {
    return read<TrainingPlan | null>('plan', null);
  }
  async savePlan(plan: TrainingPlan) {
    write('plan', plan);
  }
  async listSessions() {
    return read<WorkoutSession[]>('sessions', []).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  }
  async getSession(id: string) {
    return read<WorkoutSession[]>('sessions', []).find((s) => s.id === id) ?? null;
  }
  async saveSession(session: WorkoutSession, xpEvents: XpEvent[]) {
    write('sessions', [session, ...read<WorkoutSession[]>('sessions', []).filter((s) => s.id !== session.id)]);
    await this.addXpEvents(xpEvents);
    write('active_workout', null);
  }
  async listXpEvents() {
    return read<XpEvent[]>('xp_events', []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addXpEvents(events: XpEvent[]) {
    const existing = read<XpEvent[]>('xp_events', []);
    // Wie UNIQUE(source, ref_id) in SQLite: keine doppelten Belohnungen.
    const fresh = events.filter((e) => !existing.some((x) => x.source === e.source && x.refId === e.refId));
    write('xp_events', [...existing, ...fresh]);
  }
  async getActiveWorkout() {
    return read<ActiveWorkout | null>('active_workout', null);
  }
  async saveActiveWorkout(workout: ActiveWorkout | null) {
    write('active_workout', workout);
  }
  async resetAll() {
    for (const key of ['profile', 'settings', 'plan', 'sessions', 'xp_events', 'active_workout']) write(key, null);
    memoryFallback.clear();
  }
}
