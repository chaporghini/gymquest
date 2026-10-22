import type { Profile, Settings, TrainingPlan, WorkoutSession, XpEvent } from '@/domain/types';
import type { GymRepository } from '../db/repository';
import type { SingletonKind, SyncKind, SyncMeta } from './meta';
import { recordKey } from './meta';

/** Ein Datensatz, wie er in der Cloud oder im Backup liegt. */
export interface SyncRecord {
  kind: SyncKind;
  id: string;
  data: unknown;
  /** Zeitpunkt der Änderung auf dem Gerät. Bei Profil, Einstellungen und Plan gewinnt der neuere Stand. */
  modifiedAt: string;
}

export const SINGLETON_ID = 'main';
const EPOCH = '1970-01-01T00:00:00.000Z';

export const xpRecordId = (e: Pick<XpEvent, 'source' | 'refId'>) => `${e.source}:${e.refId}`;

/** Alle lokalen Daten als Datensätze (ohne laufendes Training, das bleibt auf dem Gerät). */
export async function collectLocalRecords(repo: GymRepository, meta: Pick<SyncMeta, 'modified'>): Promise<SyncRecord[]> {
  const [profile, settings, plan, sessions, xpEvents] = await Promise.all([
    repo.getProfile(),
    repo.getSettings(),
    repo.getActivePlan(),
    repo.listSessions(),
    repo.listXpEvents(),
  ]);
  const records: SyncRecord[] = [];
  if (profile) records.push({ kind: 'profile', id: SINGLETON_ID, data: profile, modifiedAt: meta.modified.profile ?? profile.createdAt });
  // Einstellungen ohne Änderung sind Standardwerte und sollen keinen Cloud-Stand überschreiben.
  if (meta.modified.settings) records.push({ kind: 'settings', id: SINGLETON_ID, data: settings, modifiedAt: meta.modified.settings });
  if (plan) records.push({ kind: 'plan', id: SINGLETON_ID, data: plan, modifiedAt: meta.modified.plan ?? plan.createdAt });
  for (const s of sessions) records.push({ kind: 'session', id: s.id, data: s, modifiedAt: s.finishedAt });
  for (const e of xpEvents) records.push({ kind: 'xp', id: xpRecordId(e), data: e, modifiedAt: e.createdAt });
  return records;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function isValid(r: SyncRecord): boolean {
  const d = r.data;
  if (!isObject(d)) return false;
  switch (r.kind) {
    case 'profile':
      return typeof d.displayName === 'string' && Array.isArray(d.equipment);
    case 'settings':
      return typeof d.hapticsEnabled === 'boolean';
    case 'plan':
      return typeof d.id === 'string' && Array.isArray(d.days);
    case 'session':
      return typeof d.id === 'string' && typeof d.finishedAt === 'string' && Array.isArray(d.sets);
    case 'xp':
      return typeof d.refId === 'string' && typeof d.amount === 'number' && typeof d.source === 'string';
    default:
      return false;
  }
}

export interface ApplyResult {
  /** Anzahl der Datensätze, die lokal etwas verändert haben. */
  changed: number;
  skippedInvalid: number;
}

/**
 * Übernimmt fremde Datensätze (aus der Cloud oder einem Backup) in die lokale Datenbank.
 * Trainings und XP werden zusammengeführt, Profil/Einstellungen/Plan: neuerer Stand gewinnt.
 * `preferIncoming` übernimmt Profil/Einstellungen/Plan immer (erste Anmeldung auf einem Gerät).
 * `meta` wird angepasst: übernommene Einzeldatensätze gelten als synchron.
 */
export async function applyRecords(repo: GymRepository, records: SyncRecord[], meta: SyncMeta, preferIncoming: boolean): Promise<ApplyResult> {
  let changed = 0;
  let skippedInvalid = 0;
  const latest = new Map<SingletonKind, SyncRecord>();
  const sessions: WorkoutSession[] = [];
  const xp: XpEvent[] = [];

  for (const r of records) {
    if (!isValid(r)) {
      skippedInvalid++;
      continue;
    }
    if (r.kind === 'session') sessions.push(r.data as WorkoutSession);
    else if (r.kind === 'xp') xp.push(r.data as XpEvent);
    else {
      const prev = latest.get(r.kind);
      if (!prev || r.modifiedAt > prev.modifiedAt) latest.set(r.kind, r);
    }
  }

  if (sessions.length) {
    const known = new Set((await repo.listSessions()).map((s) => s.id));
    const fresh = sessions.filter((s) => !known.has(s.id));
    await repo.importSessions(fresh);
    changed += fresh.length;
  }
  if (xp.length) {
    const known = new Set((await repo.listXpEvents()).map(xpRecordId));
    const fresh = xp.filter((e) => !known.has(xpRecordId(e)));
    await repo.addXpEvents(fresh);
    changed += fresh.length;
  }

  for (const [kind, r] of latest) {
    const local = meta.modified[kind] ?? (await localFallbackModified(repo, kind));
    if (!preferIncoming && local && local >= r.modifiedAt) continue;
    if (kind === 'profile') await repo.saveProfile(r.data as Profile);
    else if (kind === 'settings') await repo.saveSettings(r.data as Settings);
    else await repo.savePlan(r.data as TrainingPlan);
    meta.modified[kind] = r.modifiedAt;
    delete meta.dirty[recordKey(kind, SINGLETON_ID)];
    changed++;
  }
  return { changed, skippedInvalid };
}

async function localFallbackModified(repo: GymRepository, kind: SingletonKind): Promise<string | null> {
  if (kind === 'profile') return (await repo.getProfile())?.createdAt ?? null;
  if (kind === 'plan') return (await repo.getActivePlan())?.createdAt ?? null;
  return EPOCH;
}
