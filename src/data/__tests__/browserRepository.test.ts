import { BrowserGymRepository } from '../browserRepository';
import type { XpEvent } from '@/domain/types';

const xp = (id: string, refId: string): XpEvent => ({ id, source: 'quest', refId, amount: 10, createdAt: '2026-10-22T10:00:00.000Z', label: '' });

describe('BrowserGymRepository', () => {
  it('vergibt dieselbe Belohnung nur einmal', async () => {
    const repo = new BrowserGymRepository();
    await repo.addXpEvents([xp('a', 'q:1')]);
    await repo.addXpEvents([xp('b', 'q:1'), xp('c', 'q:2')]);
    expect((await repo.listXpEvents()).map((e) => e.refId).sort()).toEqual(['q:1', 'q:2']);
  });

  it('löscht beim Zurücksetzen alles', async () => {
    const repo = new BrowserGymRepository();
    await repo.saveActiveWorkout({ id: 'w', planDayId: null, name: 'x', startedAt: '', exercises: [], currentExerciseIndex: 0, restEndsAt: null });
    await repo.resetAll();
    expect(await repo.getActiveWorkout()).toBeNull();
    expect(await repo.listXpEvents()).toEqual([]);
    expect(await repo.listSessions()).toEqual([]);
  });
});
