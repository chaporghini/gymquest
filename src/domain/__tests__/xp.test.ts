import { calculateWorkoutXp, getLevelProgress, totalXpForLevel, xpToNextLevel, XP_RULES } from '../xp';
import { getNextRank, getRank } from '../ranks';
import type { SetLog } from '../types';

const set = (completed: boolean, reps = 10, weightKg: number | null = 20): SetLog => ({
  exerciseId: 'goblet_squat',
  setIndex: 0,
  reps,
  weightKg,
  durationSec: null,
  completed,
});

describe('Levelkurve', () => {
  it('startet bei Level 1 mit 0 XP', () => {
    const p = getLevelProgress(0);
    expect(p.level).toBe(1);
    expect(p.xpRemaining).toBe(100);
    expect(p.progress).toBe(0);
  });

  it('steigt genau an der Grenze auf', () => {
    expect(getLevelProgress(99).level).toBe(1);
    expect(getLevelProgress(100).level).toBe(2);
    expect(getLevelProgress(100).xpIntoLevel).toBe(0);
    expect(getLevelProgress(250).level).toBe(3);
  });

  it('ist konsistent mit totalXpForLevel', () => {
    for (const level of [2, 5, 10, 37]) {
      expect(getLevelProgress(totalXpForLevel(level)).level).toBe(level);
      expect(getLevelProgress(totalXpForLevel(level) - 1).level).toBe(level - 1);
    }
  });

  it('wird mit jedem Level etwas teurer', () => {
    expect(xpToNextLevel(2)).toBeGreaterThan(xpToNextLevel(1));
  });

  it('ignoriert negative Werte und deckelt bei Maxlevel', () => {
    expect(getLevelProgress(-50).level).toBe(1);
    const max = getLevelProgress(10_000_000);
    expect(max.isMaxLevel).toBe(true);
    expect(max.progress).toBe(1);
  });
});

describe('Training-XP', () => {
  it('belohnt abgeschlossene Sätze und ein vollständiges Training', () => {
    const sets = [set(true), set(true), set(true), set(true)];
    const xp = calculateWorkoutXp(sets, 4);
    expect(xp.total).toBe(XP_RULES.base + 4 * XP_RULES.perSet + XP_RULES.completionBonus);
  });

  it('zählt nicht abgeschlossene Sätze nicht', () => {
    const xp = calculateWorkoutXp([set(true), set(true), set(true), set(false)], 4);
    expect(xp.completedSets).toBe(3);
    expect(xp.completion).toBe(0);
  });

  it('gibt für Mini-Einheiten keinen Basisbonus', () => {
    const xp = calculateWorkoutXp([set(true)], 10);
    expect(xp.base).toBe(0);
    expect(xp.total).toBe(XP_RULES.perSet);
  });

  it('belohnt übermäßiges Volumen nicht', () => {
    const many = Array.from({ length: 80 }, () => set(true));
    const xp = calculateWorkoutXp(many, 80);
    expect(xp.sets).toBe(XP_RULES.maxCountedSets * XP_RULES.perSet);
  });

  it('reduziert XP für weitere Trainings am selben Tag', () => {
    const sets = [set(true), set(true), set(true)];
    const first = calculateWorkoutXp(sets, 3, 0).total;
    const second = calculateWorkoutXp(sets, 3, 1).total;
    expect(second).toBe(Math.round(first * XP_RULES.repeatSameDayFactor));
  });
});

describe('Ränge', () => {
  it('ordnet Level den Rängen zu', () => {
    expect(getRank(1).name).toBe('Rekrut');
    expect(getRank(5).name).toBe('Lehrling');
    expect(getRank(99).name).toBe('Legende');
    expect(getNextRank(1)?.name).toBe('Lehrling');
    expect(getNextRank(99)).toBeNull();
  });
});
