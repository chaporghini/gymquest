import type { GymRepository } from '../db/repository';
import { readMeta, recordKey, updateMeta } from './meta';
import { applyRecords, collectLocalRecords, type SyncRecord } from './records';

/** Ein Datensatz aus der Cloud, mit Server-Zeitstempel für den nächsten Abruf. */
export interface RemoteRecord extends SyncRecord {
  updatedAt: string;
}

/** Speicherort in der Cloud. Produktiv: Supabase (supabase.ts), in Tests: In-Memory. */
export interface RemoteStore {
  /** Alle Datensätze des Kontos, die nach `since` geändert wurden (null = alle), aufsteigend nach updatedAt. */
  fetchChanges(since: string | null): Promise<RemoteRecord[]>;
  /** Legt Datensätze an oder überschreibt sie. Bei Profil/Einstellungen/Plan behält der Server den neueren Stand. */
  upsert(records: SyncRecord[]): Promise<void>;
  /** Löscht alle Datensätze des Kontos. */
  deleteAll(): Promise<void>;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  /** true, wenn sich lokale Daten geändert haben und die App neu laden sollte. */
  localChanged: boolean;
  syncedAt: string;
}

// Abrufe überlappen um eine Minute, damit gleichzeitig gespeicherte Datensätze nicht verloren gehen.
// Doppelt geholte Datensätze sind unschädlich, weil das Zusammenführen idempotent ist.
const CURSOR_OVERLAP_MS = 60_000;

/**
 * Ein Synchronisierungsdurchlauf: erst holen, dann hochladen.
 * `repo` ist die lokale Datenbank OHNE TrackingRepository-Hülle.
 */
export async function syncOnce(repo: GymRepository, remote: RemoteStore, userId: string, now = new Date()): Promise<SyncResult> {
  const before = await readMeta(repo);
  const accountChanged = before.userId !== userId;
  const cursor = accountChanged ? null : before.cursor;
  // Erster Abgleich dieses Geräts mit diesem Konto: alles hochladen, Profil/Plan aus der Cloud bevorzugen.
  const firstSync = accountChanged;

  const since = cursor ? new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString() : null;
  const incoming = await remote.fetchChanges(since);
  const hasRemoteProfile = incoming.some((r) => r.kind === 'profile');

  // 1. Herunterladen und zusammenführen
  const applied = await updateMeta(repo, (meta) => applyRecords(repo, incoming, meta, firstSync && hasRemoteProfile));

  // 2. Hochladen: beim ersten Mal alles, danach nur Geändertes
  const snapshotAt = new Date().toISOString();
  const meta = await readMeta(repo);
  const local = await collectLocalRecords(repo, meta);
  const toPush = firstSync ? local : local.filter((r) => meta.dirty[recordKey(r.kind, r.id)] !== undefined);
  const localKeys = new Set(local.map((r) => recordKey(r.kind, r.id)));
  const pushedVersions = new Map(toPush.map((r) => [recordKey(r.kind, r.id), meta.dirty[recordKey(r.kind, r.id)]]));
  if (toPush.length) await remote.upsert(toPush);

  const newCursor = incoming.reduce<string | null>((max, r) => (max === null || r.updatedAt > max ? r.updatedAt : max), cursor);
  const syncedAt = now.toISOString();
  await updateMeta(repo, (m) => {
    // Nur Einträge entfernen, die seit dem Hochladen nicht erneut geändert wurden.
    for (const [key, version] of pushedVersions) if (m.dirty[key] === version) delete m.dirty[key];
    // Markierungen ohne lokalen Datensatz (z. B. bereits vorhandene Belohnung) aufräumen.
    for (const [key, version] of Object.entries(m.dirty)) if (version <= snapshotAt && !localKeys.has(key)) delete m.dirty[key];
    m.cursor = newCursor;
    m.userId = userId;
    m.lastSyncedAt = syncedAt;
  });

  return { pulled: incoming.length, pushed: toPush.length, localChanged: applied.changed > 0, syncedAt };
}

/** Vergisst den Synchronisierungsstand, z. B. nach Abmelden. Lokale Daten bleiben erhalten. */
export function forgetSyncState(repo: GymRepository) {
  return updateMeta(repo, (m) => {
    m.cursor = null;
    m.userId = null;
    m.lastSyncedAt = null;
  });
}
