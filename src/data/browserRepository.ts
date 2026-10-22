import type { ActiveWorkout, Profile, Settings, TrainingPlan, WorkoutSession, XpEvent } from '@/domain/types';
import { DEFAULT_SETTINGS, type GymRepository } from './db/repository';

// Speicherung im Browser (localStorage) für die Web-App (auch als installierte App auf iPhone und Mac).
// Auf iPhone/Android über Expo bleibt SQLite die Datenbank.

const DEFAULT_PREFIX = 'gymquest:';
const memoryFallback = new Map<string, string>();

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export class BrowserGymRepository implements GymRepository {
  /** `prefix` trennt mehrere Datenbestände, z. B. in Tests zwei simulierte Geräte. */
  constructor(private readonly prefix = DEFAULT_PREFIX) {}

  private read<T>(key: string, fallback: T): T {
    let raw: string | null = null;
    try {
      raw = storage()?.getItem(this.prefix + key) ?? null;
    } catch {
      raw = null;
    }
    if (raw === null) raw = memoryFallback.get(this.prefix + key) ?? null;
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown) {
    const full = this.prefix + key;
    const raw = JSON.stringify(value);
    if (value === null) memoryFallback.delete(full);
    else memoryFallback.set(full, raw);
    try {
      if (value === null) storage()?.removeItem(full);
      else storage()?.setItem(full, raw);
    } catch {
      // Speicher blockiert oder voll: Daten bleiben bis zum Neuladen im Speicher.
    }
  }

  async getProfile() {
    return this.read<Profile | null>('profile', null);
  }
  async saveProfile(profile: Profile) {
    this.write('profile', profile);
  }
  async getSettings() {
    return { ...DEFAULT_SETTINGS, ...this.read<Partial<Settings>>('settings', {}) };
  }
  async saveSettings(settings: Settings) {
    this.write('settings', settings);
  }
  async getActivePlan() {
    return this.read<TrainingPlan | null>('plan', null);
  }
  async savePlan(plan: TrainingPlan) {
    this.write('plan', plan);
  }
  async listSessions() {
    return this.read<WorkoutSession[]>('sessions', []).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  }
  async getSession(id: string) {
    return this.read<WorkoutSession[]>('sessions', []).find((s) => s.id === id) ?? null;
  }
  async saveSession(session: WorkoutSession, xpEvents: XpEvent[]) {
    this.write('sessions', [session, ...this.read<WorkoutSession[]>('sessions', []).filter((s) => s.id !== session.id)]);
    await this.addXpEvents(xpEvents);
    this.write('active_workout', null);
  }
  async importSessions(sessions: WorkoutSession[]) {
    const existing = this.read<WorkoutSession[]>('sessions', []);
    const known = new Set(existing.map((s) => s.id));
    const fresh = sessions.filter((s) => !known.has(s.id));
    if (fresh.length) this.write('sessions', [...fresh, ...existing]);
  }
  async listXpEvents() {
    return this.read<XpEvent[]>('xp_events', []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addXpEvents(events: XpEvent[]) {
    const existing = this.read<XpEvent[]>('xp_events', []);
    // Wie UNIQUE(source, ref_id) in SQLite: keine doppelten Belohnungen.
    const seen = new Set(existing.map((x) => `${x.source}:${x.refId}`));
    const fresh: XpEvent[] = [];
    for (const e of events) {
      const key = `${e.source}:${e.refId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.push(e);
    }
    if (fresh.length) this.write('xp_events', [...existing, ...fresh]);
  }
  async getActiveWorkout() {
    return this.read<ActiveWorkout | null>('active_workout', null);
  }
  async saveActiveWorkout(workout: ActiveWorkout | null) {
    this.write('active_workout', workout);
  }
  async getMeta<T>(key: string) {
    return this.read<T | null>(`meta:${key}`, null);
  }
  async setMeta(key: string, value: unknown) {
    this.write(`meta:${key}`, value);
  }
  async resetAll() {
    for (const key of [...memoryFallback.keys()]) if (key.startsWith(this.prefix)) memoryFallback.delete(key);
    try {
      const s = storage();
      if (!s) return;
      const keys: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(this.prefix)) keys.push(k);
      }
      for (const k of keys) s.removeItem(k);
    } catch {
      // Speicher nicht verfügbar: Speicherkopie ist bereits geleert.
    }
  }
}
