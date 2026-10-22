import type { GymRepository } from '../db/repository';

// Verwaltungsdaten der Synchronisierung, gespeichert über GymRepository.getMeta/setMeta.

export type SingletonKind = 'profile' | 'settings' | 'plan';
export type SyncKind = SingletonKind | 'session' | 'xp';

export interface SyncMeta {
  /** Datensätze, die noch hochgeladen werden müssen: "kind|id" → Zeitpunkt der Änderung. */
  dirty: Record<string, string>;
  /** Wann Profil, Einstellungen und Plan zuletzt auf diesem Gerät geändert wurden. */
  modified: Partial<Record<SingletonKind, string>>;
  /** Server-Zeitstempel (updated_at) des zuletzt geholten Datensatzes. */
  cursor: string | null;
  /** Konto, zu dem `cursor` gehört. Bei einem anderen Konto beginnt die Synchronisierung neu. */
  userId: string | null;
  lastSyncedAt: string | null;
}

const KEY = 'sync';

export const EMPTY_META: SyncMeta = { dirty: {}, modified: {}, cursor: null, userId: null, lastSyncedAt: null };

export async function readMeta(repo: GymRepository): Promise<SyncMeta> {
  const stored = await repo.getMeta<Partial<SyncMeta>>(KEY);
  return { ...EMPTY_META, ...stored, dirty: { ...stored?.dirty }, modified: { ...stored?.modified } };
}

export function writeMeta(repo: GymRepository, meta: SyncMeta) {
  return repo.setMeta(KEY, meta);
}

// Lese-Ändern-Schreiben der Metadaten darf sich nicht überschneiden (App speichert, während synchronisiert wird).
const locks = new WeakMap<GymRepository, Promise<unknown>>();

export function updateMeta<T>(repo: GymRepository, fn: (meta: SyncMeta) => T | Promise<T>): Promise<T> {
  const previous = locks.get(repo) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(async () => {
    const meta = await readMeta(repo);
    const result = await fn(meta);
    await writeMeta(repo, meta);
    return result;
  });
  locks.set(repo, run);
  return run;
}

export const recordKey = (kind: SyncKind, id: string) => `${kind}|${id}`;
