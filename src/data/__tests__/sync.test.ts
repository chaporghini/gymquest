import { BrowserGymRepository } from '../browserRepository';
import { createBackup, parseBackup, restoreBackup } from '../backup';
import { readMeta, syncOnce, TrackingRepository, type RemoteRecord, type RemoteStore, type SyncRecord } from '../sync';
import type { Profile, TrainingPlan, WorkoutSession, XpEvent } from '@/domain/types';

/** Verhält sich wie die Supabase-Tabelle inkl. Trigger (Serverzeit, neuerer Stand gewinnt). */
class FakeRemote implements RemoteStore {
  rows = new Map<string, RemoteRecord>();
  private clock = Date.parse('2026-10-01T00:00:00Z');
  online = true;

  private tick() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }
  async fetchChanges(since: string | null) {
    if (!this.online) throw new Error('offline');
    return [...this.rows.values()].filter((r) => !since || r.updatedAt > since).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }
  async upsert(records: SyncRecord[]) {
    if (!this.online) throw new Error('offline');
    for (const r of records) {
      const key = `${r.kind}|${r.id}`;
      const old = this.rows.get(key);
      if (old && r.modifiedAt < old.modifiedAt) continue;
      this.rows.set(key, { ...r, data: JSON.parse(JSON.stringify(r.data)), updatedAt: this.tick() });
    }
  }
  async deleteAll() {
    this.rows.clear();
  }
}

let n = 0;
function device() {
  const inner = new BrowserGymRepository(`test${++n}:`);
  return { inner, app: new TrackingRepository(inner) };
}

const profile = (name: string, createdAt = '2026-10-01T08:00:00.000Z'): Profile => ({
  displayName: name,
  experience: 'beginner',
  goal: 'general',
  daysPerWeek: 3,
  sessionMinutes: 45,
  equipment: ['gym'],
  limitations: [],
  excludedExerciseIds: [],
  onboardingCompleted: true,
  createdAt,
});
const plan = (id: string, name: string): TrainingPlan => ({ id, name, createdAt: '2026-10-01T08:00:00.000Z', split: 'full', days: [] });
const session = (id: string, finishedAt: string): WorkoutSession => ({
  id,
  planDayId: null,
  name: 'Ganzkörper',
  startedAt: finishedAt,
  finishedAt,
  durationSec: 1800,
  xpEarned: 80,
  sets: [{ exerciseId: 'squat', setIndex: 0, reps: 8, weightKg: 60, durationSec: null, completed: true }],
});
const xp = (id: string, refId: string, source: XpEvent['source'] = 'workout'): XpEvent => ({ id, source, refId, amount: 50, createdAt: '2026-10-02T10:00:00.000Z', label: '' });

describe('Cloud-Synchronisierung', () => {
  it('überträgt Trainings und XP vom MacBook auf ein neues iPhone', async () => {
    const remote = new FakeRemote();
    const mac = device();
    await mac.app.saveProfile(profile('Luis'));
    await mac.app.savePlan(plan('p1', 'Mein Plan'));
    await mac.app.saveSession(session('s1', '2026-10-02T10:00:00.000Z'), [xp('x1', 's1')]);
    await syncOnce(mac.inner, remote, 'user-1');
    expect(remote.rows.size).toBe(4);

    const phone = device();
    const result = await syncOnce(phone.inner, remote, 'user-1');
    expect(result.localChanged).toBe(true);
    expect((await phone.inner.getProfile())?.displayName).toBe('Luis');
    expect((await phone.inner.getActivePlan())?.name).toBe('Mein Plan');
    expect((await phone.inner.listSessions()).map((s) => s.id)).toEqual(['s1']);
    expect((await phone.inner.listXpEvents()).map((e) => e.id)).toEqual(['x1']);
  });

  it('übernimmt bei der ersten Anmeldung Profil und Plan aus der Cloud, auch wenn das Gerät schon ein Onboarding hatte', async () => {
    const remote = new FakeRemote();
    const mac = device();
    await mac.app.saveProfile(profile('Luis'));
    await mac.app.savePlan(plan('p1', 'Echter Plan'));
    await syncOnce(mac.inner, remote, 'u');

    const phone = device();
    await phone.app.saveProfile(profile('Neu', '2026-10-20T08:00:00.000Z'));
    await phone.app.savePlan(plan('p2', 'Standardplan'));
    await phone.app.saveSession(session('s-phone', '2026-10-20T09:00:00.000Z'), []);
    await syncOnce(phone.inner, remote, 'u');

    expect((await phone.inner.getProfile())?.displayName).toBe('Luis');
    expect((await phone.inner.getActivePlan())?.id).toBe('p1');
    // Das Training vom iPhone geht trotzdem nicht verloren.
    expect(remote.rows.has('session|s-phone')).toBe(true);
    expect((remote.rows.get('profile|main')?.data as Profile).displayName).toBe('Luis');
  });

  it('führt offline gemachte Trainings beider Geräte zusammen und lädt nur Geändertes hoch', async () => {
    const remote = new FakeRemote();
    const mac = device();
    const phone = device();
    await mac.app.saveProfile(profile('Luis'));
    await syncOnce(mac.inner, remote, 'u');
    await syncOnce(phone.inner, remote, 'u');

    await mac.app.saveSession(session('a', '2026-10-05T10:00:00.000Z'), [xp('xa', 'a')]);
    await phone.app.saveSession(session('b', '2026-10-05T18:00:00.000Z'), [xp('xb', 'b')]);
    const r1 = await syncOnce(phone.inner, remote, 'u');
    expect(r1.pushed).toBe(2);
    await syncOnce(mac.inner, remote, 'u');
    await syncOnce(phone.inner, remote, 'u');

    for (const d of [mac, phone]) {
      expect((await d.inner.listSessions()).map((s) => s.id).sort()).toEqual(['a', 'b']);
      expect(await d.inner.listXpEvents()).toHaveLength(2);
    }
    expect((await readMeta(phone.inner)).dirty).toEqual({});
    const again = await syncOnce(phone.inner, remote, 'u');
    expect(again.pushed).toBe(0);
  });

  it('vergibt dieselbe Quest-Belohnung nicht doppelt, wenn beide Geräte sie offline erhalten haben', async () => {
    const remote = new FakeRemote();
    const mac = device();
    const phone = device();
    await mac.app.addXpEvents([xp('m1', 'weekly_workouts:2026-W41', 'quest')]);
    await phone.app.addXpEvents([xp('p1', 'weekly_workouts:2026-W41', 'quest')]);
    await syncOnce(mac.inner, remote, 'u');
    await syncOnce(phone.inner, remote, 'u');
    await syncOnce(mac.inner, remote, 'u');
    expect(await mac.inner.listXpEvents()).toHaveLength(1);
    expect(await phone.inner.listXpEvents()).toHaveLength(1);
    expect([...remote.rows.keys()].filter((k) => k.startsWith('xp|'))).toHaveLength(1);
  });

  it('nimmt beim Plan den neueren Stand, egal welches Gerät zuletzt synchronisiert', async () => {
    const remote = new FakeRemote();
    const mac = device();
    const phone = device();
    await mac.app.savePlan(plan('p1', 'Start'));
    await mac.app.saveProfile(profile('Luis'));
    await syncOnce(mac.inner, remote, 'u');
    await syncOnce(phone.inner, remote, 'u');

    await phone.app.savePlan(plan('p1', 'Älter (iPhone)'));
    await new Promise((r) => setTimeout(r, 5));
    await mac.app.savePlan(plan('p1', 'Neuer (Mac)'));
    await syncOnce(mac.inner, remote, 'u');
    await syncOnce(phone.inner, remote, 'u');
    expect((await phone.inner.getActivePlan())?.name).toBe('Neuer (Mac)');
    expect((remote.rows.get('plan|main')?.data as TrainingPlan).name).toBe('Neuer (Mac)');
  });

  it('behält Änderungen, wenn der Server nicht erreichbar ist, und lädt sie später hoch', async () => {
    const remote = new FakeRemote();
    const phone = device();
    await phone.app.saveProfile(profile('Luis'));
    await syncOnce(phone.inner, remote, 'u');
    remote.online = false;
    await phone.app.saveSession(session('gym', '2026-10-06T10:00:00.000Z'), []);
    await expect(syncOnce(phone.inner, remote, 'u')).rejects.toThrow('offline');
    expect(Object.keys((await readMeta(phone.inner)).dirty)).toContain('session|gym');
    remote.online = true;
    await syncOnce(phone.inner, remote, 'u');
    expect(remote.rows.has('session|gym')).toBe(true);
  });

  it('stößt nach jeder Änderung eine Synchronisierung an', async () => {
    const phone = device();
    const onChange = jest.fn();
    phone.app.setChangeListener(onChange);
    await phone.app.saveSettings({ hapticsEnabled: false, defaultRestSeconds: 90, weightUnit: 'kg' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Datensicherung', () => {
  it('exportiert alles und spielt es ohne Duplikate wieder ein', async () => {
    const mac = device();
    await mac.app.saveProfile(profile('Luis'));
    await mac.app.savePlan(plan('p1', 'Plan'));
    await mac.app.saveSession(session('s1', '2026-10-02T10:00:00.000Z'), [xp('x1', 's1')]);
    const json = JSON.stringify(await createBackup(mac.inner));

    const fresh = device();
    await restoreBackup(fresh.inner, parseBackup(json));
    await restoreBackup(fresh.inner, parseBackup(json));
    expect((await fresh.inner.getProfile())?.displayName).toBe('Luis');
    expect(await fresh.inner.listSessions()).toHaveLength(1);
    expect(await fresh.inner.listXpEvents()).toHaveLength(1);
    expect(Object.keys((await readMeta(fresh.inner)).dirty)).toContain('session|s1');
  });

  it('lehnt fremde Dateien verständlich ab', () => {
    expect(() => parseBackup('hallo')).toThrow('kein JSON');
    expect(() => parseBackup('{"foo":1}')).toThrow('keine GYMQUEST-Sicherung');
  });
});
