import type { SQLiteDatabase } from 'expo-sqlite';

import type { ActiveWorkout, Profile, Settings, TrainingPlan, WorkoutSession, XpEvent } from '@/domain/types';
import { getDatabase } from './database';

/**
 * Datenzugriff der App. Die UI kennt nur dieses Interface, nicht SQLite.
 * Die Supabase-Synchronisierung (src/data/sync) baut ausschließlich auf diesem Interface auf.
 */
export interface GymRepository {
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  getActivePlan(): Promise<TrainingPlan | null>;
  savePlan(plan: TrainingPlan): Promise<void>;
  listSessions(): Promise<WorkoutSession[]>;
  getSession(id: string): Promise<WorkoutSession | null>;
  /** Speichert Training und zugehörige XP atomar. */
  saveSession(session: WorkoutSession, xpEvents: XpEvent[]): Promise<void>;
  listXpEvents(): Promise<XpEvent[]>;
  addXpEvents(events: XpEvent[]): Promise<void>;
  /** Übernimmt Trainings von anderen Geräten oder aus einem Backup. Vorhandene IDs werden übersprungen. */
  importSessions(sessions: WorkoutSession[]): Promise<void>;
  getActiveWorkout(): Promise<ActiveWorkout | null>;
  saveActiveWorkout(workout: ActiveWorkout | null): Promise<void>;
  resetAll(): Promise<void>;
  /** Interne Verwaltungsdaten, z. B. der Stand der Synchronisierung. */
  getMeta<T>(key: string): Promise<T | null>;
  setMeta(key: string, value: unknown): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  hapticsEnabled: true,
  defaultRestSeconds: null,
  weightUnit: 'kg',
};

const KEY_PROFILE = 'profile';
const KEY_SETTINGS = 'settings';
const KEY_ACTIVE_WORKOUT = 'active_workout';

interface SessionRow {
  id: string;
  plan_day_id: string | null;
  name: string;
  started_at: string;
  finished_at: string;
  duration_sec: number;
  xp_earned: number;
  extra: string | null;
}

interface SetRow {
  session_id: string;
  exercise_id: string;
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  duration_sec: number | null;
  completed: number;
}

interface XpRow {
  id: string;
  source: XpEvent['source'];
  ref_id: string;
  amount: number;
  label: string;
  created_at: string;
}

function parseJson<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export class SqliteGymRepository implements GymRepository {
  constructor(private readonly open: () => Promise<SQLiteDatabase> = getDatabase) {}

  private async getKv<T>(key: string): Promise<T | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
    return parseJson<T>(row?.value);
  }

  private async setKv(key: string, value: unknown): Promise<void> {
    const db = await this.open();
    if (value === null) {
      await db.runAsync('DELETE FROM kv WHERE key = ?', key);
      return;
    }
    await db.runAsync(
      'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      key,
      JSON.stringify(value),
      new Date().toISOString(),
    );
  }

  getProfile() {
    return this.getKv<Profile>(KEY_PROFILE);
  }

  saveProfile(profile: Profile) {
    return this.setKv(KEY_PROFILE, profile);
  }

  async getSettings() {
    return { ...DEFAULT_SETTINGS, ...(await this.getKv<Partial<Settings>>(KEY_SETTINGS)) };
  }

  saveSettings(settings: Settings) {
    return this.setKv(KEY_SETTINGS, settings);
  }

  async getActivePlan() {
    const db = await this.open();
    const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM plans WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1');
    return parseJson<TrainingPlan>(row?.data);
  }

  async savePlan(plan: TrainingPlan) {
    const db = await this.open();
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE plans SET is_active = 0 WHERE id != ?', plan.id);
      await db.runAsync(
        `INSERT INTO plans (id, name, split, data, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, split = excluded.split, data = excluded.data, is_active = 1, updated_at = excluded.updated_at`,
        plan.id,
        plan.name,
        plan.split,
        JSON.stringify(plan),
        plan.createdAt,
        now,
      );
    });
  }

  async listSessions() {
    const db = await this.open();
    const rows = await db.getAllAsync<SessionRow>('SELECT * FROM workout_sessions ORDER BY finished_at DESC');
    const sets = await db.getAllAsync<SetRow>('SELECT * FROM set_logs ORDER BY session_id, exercise_id, set_index');
    const bySession = new Map<string, SetRow[]>();
    for (const s of sets) {
      const list = bySession.get(s.session_id) ?? [];
      list.push(s);
      bySession.set(s.session_id, list);
    }
    return rows.map((r) => toSession(r, bySession.get(r.id) ?? []));
  }

  async getSession(id: string) {
    const db = await this.open();
    const row = await db.getFirstAsync<SessionRow>('SELECT * FROM workout_sessions WHERE id = ?', id);
    if (!row) return null;
    const sets = await db.getAllAsync<SetRow>('SELECT * FROM set_logs WHERE session_id = ? ORDER BY id', id);
    return toSession(row, sets);
  }

  async saveSession(session: WorkoutSession, xpEvents: XpEvent[]) {
    const db = await this.open();
    await db.withTransactionAsync(async () => {
      await insertSession(db, session);
      await insertXp(db, xpEvents);
      await db.runAsync('DELETE FROM kv WHERE key = ?', KEY_ACTIVE_WORKOUT);
    });
  }

  async importSessions(sessions: WorkoutSession[]) {
    if (sessions.length === 0) return;
    const db = await this.open();
    await db.withTransactionAsync(async () => {
      for (const session of sessions) {
        const exists = await db.getFirstAsync('SELECT id FROM workout_sessions WHERE id = ?', session.id);
        if (!exists) await insertSession(db, session);
      }
    });
  }

  async listXpEvents() {
    const db = await this.open();
    const rows = await db.getAllAsync<XpRow>('SELECT * FROM xp_events ORDER BY created_at DESC');
    return rows.map((r) => ({ id: r.id, source: r.source, refId: r.ref_id, amount: r.amount, label: r.label, createdAt: r.created_at }));
  }

  async addXpEvents(events: XpEvent[]) {
    if (events.length === 0) return;
    const db = await this.open();
    await db.withTransactionAsync(() => insertXp(db, events));
  }

  getActiveWorkout() {
    return this.getKv<ActiveWorkout>(KEY_ACTIVE_WORKOUT);
  }

  saveActiveWorkout(workout: ActiveWorkout | null) {
    return this.setKv(KEY_ACTIVE_WORKOUT, workout);
  }

  async resetAll() {
    const db = await this.open();
    await db.withTransactionAsync(async () => {
      await db.execAsync('DELETE FROM set_logs; DELETE FROM workout_sessions; DELETE FROM xp_events; DELETE FROM plans; DELETE FROM kv;');
    });
  }

  getMeta<T>(key: string) {
    return this.getKv<T>(`meta:${key}`);
  }

  setMeta(key: string, value: unknown) {
    return this.setKv(`meta:${key}`, value);
  }
}

async function insertSession(db: SQLiteDatabase, session: WorkoutSession) {
  await db.runAsync(
    'INSERT INTO workout_sessions (id, plan_day_id, name, started_at, finished_at, duration_sec, xp_earned, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    session.id,
    session.planDayId,
    session.name,
    session.startedAt,
    session.finishedAt,
    session.durationSec,
    session.xpEarned,
    session.feedback?.length || session.readiness != null || session.exercises
      ? JSON.stringify({ feedback: session.feedback, readiness: session.readiness, planName: session.planName, exercises: session.exercises })
      : null,
  );
  for (const set of session.sets) {
    await db.runAsync(
      'INSERT INTO set_logs (session_id, exercise_id, set_index, reps, weight_kg, duration_sec, completed) VALUES (?, ?, ?, ?, ?, ?, ?)',
      session.id,
      set.exerciseId,
      set.setIndex,
      set.reps,
      set.weightKg,
      set.durationSec,
      set.completed ? 1 : 0,
    );
  }
}

async function insertXp(db: SQLiteDatabase, events: XpEvent[]) {
  for (const e of events) {
    // UNIQUE(source, ref_id) verhindert doppelte Belohnungen.
    await db.runAsync(
      'INSERT OR IGNORE INTO xp_events (id, source, ref_id, amount, label, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      e.id,
      e.source,
      e.refId,
      e.amount,
      e.label,
      e.createdAt,
    );
  }
}

function toSession(row: SessionRow, sets: SetRow[]): WorkoutSession {
  const extra = parseJson<Pick<WorkoutSession, 'feedback' | 'readiness' | 'planName' | 'exercises'>>(row.extra);
  return {
    ...(extra?.feedback ? { feedback: extra.feedback } : {}),
    ...(extra?.readiness != null ? { readiness: extra.readiness } : {}),
    ...(extra?.planName ? { planName: extra.planName } : {}),
    ...(extra?.exercises ? { exercises: extra.exercises } : {}),
    id: row.id,
    planDayId: row.plan_day_id,
    name: row.name,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSec: row.duration_sec,
    xpEarned: row.xp_earned,
    sets: sets.map((s) => ({
      exerciseId: s.exercise_id,
      setIndex: s.set_index,
      reps: s.reps,
      weightKg: s.weight_kg,
      durationSec: s.duration_sec,
      completed: s.completed === 1,
    })),
  };
}
