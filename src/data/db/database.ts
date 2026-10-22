import * as SQLite from 'expo-sqlite';

// Lokale SQLite-Datenbank. Bleibt über App-Neustarts hinweg erhalten.

export const DATABASE_NAME = 'gymquest.db';
const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await migrate(db);
      return db;
    })().catch((error) => {
      // Beim nächsten Versuch neu öffnen statt einen fehlgeschlagenen Promise zu cachen.
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version > SCHEMA_VERSION) {
    throw new Error('Die gespeicherten Daten stammen aus einer neueren App-Version.');
  }
  if (version === SCHEMA_VERSION) return;

  await db.withTransactionAsync(async () => {
    if (version < 1) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS plans (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          split TEXT NOT NULL,
          data TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS workout_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          plan_day_id TEXT,
          name TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT NOT NULL,
          duration_sec INTEGER NOT NULL,
          xp_earned INTEGER NOT NULL,
          synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_finished ON workout_sessions (finished_at);
        CREATE TABLE IF NOT EXISTS set_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
          exercise_id TEXT NOT NULL,
          set_index INTEGER NOT NULL,
          reps INTEGER,
          weight_kg REAL,
          duration_sec INTEGER,
          completed INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sets_session ON set_logs (session_id);
        CREATE TABLE IF NOT EXISTS xp_events (
          id TEXT PRIMARY KEY NOT NULL,
          source TEXT NOT NULL,
          ref_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          label TEXT NOT NULL,
          created_at TEXT NOT NULL,
          synced_at TEXT,
          UNIQUE (source, ref_id)
        );
      `);
    }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}
