export interface Rank {
  id: string;
  name: string;
  minLevel: number;
  description: string;
}

export const RANKS: Rank[] = [
  { id: 'novice', name: 'Novice', minLevel: 1, description: 'Jede Reise beginnt mit dem ersten Satz.' },
  { id: 'warrior', name: 'Warrior', minLevel: 6, description: 'Training ist Teil deiner Woche geworden.' },
  { id: 'elite', name: 'Elite', minLevel: 16, description: 'Beständigkeit über viele Wochen.' },
  { id: 'master', name: 'Master', minLevel: 31, description: 'Erfahrung, Technik und Geduld.' },
  { id: 'legend', name: 'Legend', minLevel: 51, description: 'Ein Vorbild für jede Gilde.' },
];

export function getRank(level: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) current = r;
  return current;
}

export function getNextRank(level: number): Rank | null {
  return RANKS.find((r) => r.minLevel > level) ?? null;
}
