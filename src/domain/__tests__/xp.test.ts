import { calculateWorkoutXp, getLevelProgress, totalXpForLevel, xpToNextLevel, XP_REWARDS, XP_RULES } from '../xp';
import { getNextRank, getRank } from '../ranks';

describe('Levelkurve', () => {
  it('folgt XP(L) = 100 × (L − 1) + 25 × (L − 1)²', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(125);
    expect(totalXpForLevel(3)).toBe(300);
    expect(totalXpForLevel(11)).toBe(1000 + 2500);
  });

  it('startet bei Level 1 mit 0 XP', () => {
    const p = getLevelProgress(0);
    expect(p.level).toBe(1);
    expect(p.xpRemaining).toBe(125);
    expect(p.progress).toBe(0);
  });

  it('steigt genau an der Grenze auf', () => {
    expect(getLevelProgress(124).level).toBe(1);
    expect(getLevelProgress(125).level).toBe(2);
    expect(getLevelProgress(125).xpIntoLevel).toBe(0);
    expect(getLevelProgress(300).level).toBe(3);
    expect(getLevelProgress(299).xpRemaining).toBe(1);
  });

  it('ist konsistent mit totalXpForLevel', () => {
    for (const level of [2, 5, 10, 37]) {
      expect(getLevelProgress(totalXpForLevel(level)).level).toBe(level);
      expect(getLevelProgress(totalXpForLevel(level) - 1).level).toBe(level - 1);
    }
  });

  it('wird mit jedem Level etwas teurer', () => {
    expect(xpToNextLevel(1)).toBe(125);
    expect(xpToNextLevel(2)).toBe(175);
  });

  it('ignoriert negative Werte und deckelt bei Maxlevel', () => {
    expect(getLevelProgress(-50).level).toBe(1);
    const max = getLevelProgress(10_000_000);
    expect(max.isMaxLevel).toBe(true);
    expect(max.progress).toBe(1);
  });
});

const ex = (plannedSets: number, completedSets: number) => ({ plannedSets, completedSets });

describe('Training-XP', () => {
  it('gibt 60 XP für die Einheit und 10 XP je abgeschlossener Übung', () => {
    const xp = calculateWorkoutXp([ex(3, 3), ex(2, 2), ex(3, 1)]);
    expect(xp.base).toBe(XP_REWARDS.workout);
    expect(xp.completedExercises).toBe(2);
    expect(xp.total).toBe(60 + 2 * 10);
  });

  it('zählt eine Übung nur, wenn alle geplanten Sätze erledigt sind', () => {
    const xp = calculateWorkoutXp([ex(4, 3)]);
    expect(xp.completedSets).toBe(3);
    expect(xp.completedExercises).toBe(0);
    expect(xp.total).toBe(60);
  });

  it('gibt für Mini-Einheiten keine XP', () => {
    const xp = calculateWorkoutXp([ex(1, 1), ex(1, 1)]);
    expect(xp.total).toBe(0);
  });

  it('belohnt übermäßig viele Übungen nicht', () => {
    const many = Array.from({ length: 25 }, () => ex(1, 1));
    expect(calculateWorkoutXp(many).exercises).toBe(XP_RULES.maxCountedExercises * XP_REWARDS.exercise);
  });

  it('reduziert XP für weitere Trainings am selben Tag', () => {
    const list = [ex(3, 3)];
    const first = calculateWorkoutXp(list, 0).total;
    const second = calculateWorkoutXp(list, 1).total;
    expect(second).toBe(Math.round(first * XP_RULES.repeatSameDayFactor));
  });
});

describe('Ränge', () => {
  it('ordnet Level den Rängen zu', () => {
    expect(getRank(1).name).toBe('Novice');
    expect(getRank(5).name).toBe('Novice');
    expect(getRank(6).name).toBe('Warrior');
    expect(getRank(15).name).toBe('Warrior');
    expect(getRank(16).name).toBe('Elite');
    expect(getRank(31).name).toBe('Master');
    expect(getRank(51).name).toBe('Legend');
    expect(getNextRank(1)?.name).toBe('Warrior');
    expect(getNextRank(60)).toBeNull();
  });
});
