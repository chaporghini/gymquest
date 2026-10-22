import type { GymRepository } from './db/repository';
import { applyRecords, collectLocalRecords, readMeta, recordKey, updateMeta, type SyncRecord } from './sync';

// Datensicherung als JSON-Datei. Nutzt dasselbe Datenformat und Zusammenführen wie die Cloud-Synchronisierung.

export interface Backup {
  app: 'gymquest';
  version: 1;
  exportedAt: string;
  records: SyncRecord[];
}

export async function createBackup(repo: GymRepository, now = new Date()): Promise<Backup> {
  const meta = await readMeta(repo);
  return { app: 'gymquest', version: 1, exportedAt: now.toISOString(), records: await collectLocalRecords(repo, meta) };
}

export function backupFileName(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `gymquest-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function parseBackup(text: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist keine gültige GYMQUEST-Sicherung (kein JSON).');
  }
  const b = parsed as Partial<Backup> | null;
  if (!b || b.app !== 'gymquest' || !Array.isArray(b.records)) throw new Error('Die Datei ist keine GYMQUEST-Sicherung.');
  if (b.version !== 1) throw new Error('Diese Sicherung stammt aus einer neueren App-Version.');
  return b as Backup;
}

/**
 * Spielt eine Sicherung ein, ohne vorhandene Daten zu löschen: Trainings und XP werden ergänzt,
 * Profil/Einstellungen/Plan nur übernommen, wenn sie in der Sicherung neuer sind.
 * `repo` ist die lokale Datenbank ohne TrackingRepository-Hülle. Alle Datensätze werden für den
 * nächsten Upload markiert; die Cloud behält bei Profil/Einstellungen/Plan ohnehin den neueren Stand.
 */
export async function restoreBackup(repo: GymRepository, backup: Backup) {
  const now = new Date().toISOString();
  return updateMeta(repo, async (meta) => {
    const result = await applyRecords(repo, backup.records, meta, false);
    for (const r of backup.records) meta.dirty[recordKey(r.kind, r.id)] = now;
    return result;
  });
}
