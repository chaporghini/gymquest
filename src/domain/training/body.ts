import type { BodyEntry, BodyLog, BodyMetric, Profile } from '../types';

// Körpergewicht und -größe mit Datum. Nur Kontext für Berichte, nie Grundlage einer Gewichtsformel.

export const BODY_LIMITS = {
  weight: { min: 30, max: 300 },
  height: { min: 100, max: 250 },
} as const;

export function isValidBodyValue(kind: BodyMetric, value: unknown): value is number {
  const l = BODY_LIMITS[kind];
  return typeof value === 'number' && Number.isFinite(value) && value >= l.min && value <= l.max;
}

/**
 * Ergänzt den Verlauf, wenn sich Gewicht oder Größe gegenüber dem vorherigen Profil geändert haben.
 * Ungültige Werte werden ignoriert.
 */
export function withBodyChanges(previous: Profile | null, next: Profile, now: Date, createId: () => string): Profile {
  const log: BodyLog = { entries: [...(previous?.bodyLog?.entries ?? next.bodyLog?.entries ?? [])], clearedAt: previous?.bodyLog?.clearedAt ?? next.bodyLog?.clearedAt ?? null };
  const add = (kind: BodyMetric, value: number | null | undefined, before: number | null | undefined) => {
    if (value == null || value === before || !isValidBodyValue(kind, value)) return;
    log.entries.push({ id: createId(), kind, value, recordedAt: now.toISOString() });
  };
  add('weight', next.bodyWeightKg, previous?.bodyWeightKg);
  add('height', next.heightCm, previous?.heightCm);
  return { ...next, bodyLog: log };
}

/** Löscht alle Körperdaten (Alter, Größe, Gewicht und Verlauf). */
export function clearBodyData(profile: Profile, now: Date): Profile {
  return { ...profile, ageYears: null, ageRecordedAt: null, heightCm: null, bodyWeightKg: null, bodyLog: { entries: [], clearedAt: now.toISOString() } };
}

/** Führt die Verläufe zweier Geräte zusammen. Löschungen (clearedAt) gelten für alle älteren Einträge. */
export function mergeBodyLog(a: BodyLog | undefined, b: BodyLog | undefined): BodyLog {
  const clearedAt = [a?.clearedAt, b?.clearedAt].filter((x): x is string => !!x).sort().pop() ?? null;
  const byId = new Map<string, BodyEntry>();
  for (const e of [...(a?.entries ?? []), ...(b?.entries ?? [])]) {
    if (clearedAt && e.recordedAt <= clearedAt) continue;
    byId.set(e.id, e);
  }
  return { entries: [...byId.values()].sort((x, y) => x.recordedAt.localeCompare(y.recordedAt)), clearedAt };
}

export function sameBodyLog(a: BodyLog | undefined, b: BodyLog | undefined): boolean {
  const ids = (l?: BodyLog) => (l?.entries ?? []).map((e) => e.id).sort().join(',');
  return ids(a) === ids(b) && (a?.clearedAt ?? null) === (b?.clearedAt ?? null);
}

export function bodySeries(profile: Profile | null, kind: BodyMetric): BodyEntry[] {
  return (profile?.bodyLog?.entries ?? []).filter((e) => e.kind === kind).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}
