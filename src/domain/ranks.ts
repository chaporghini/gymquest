export interface Rank {
  id: string;
  name: string;
  minLevel: number;
  description: string;
}

export const RANKS: Rank[] = [
  { id: 'recruit', name: 'Rekrut', minLevel: 1, description: 'Jede Reise beginnt mit dem ersten Satz.' },
  { id: 'apprentice', name: 'Lehrling', minLevel: 5, description: 'Du hast eine Routine gefunden.' },
  { id: 'fighter', name: 'Kämpfer', minLevel: 10, description: 'Training ist Teil deiner Woche.' },
  { id: 'veteran', name: 'Veteran', minLevel: 18, description: 'Beständigkeit über viele Wochen.' },
  { id: 'champion', name: 'Champion', minLevel: 28, description: 'Du gehörst zu den Ausdauernden.' },
  { id: 'master', name: 'Meister', minLevel: 40, description: 'Erfahrung, Technik und Geduld.' },
  { id: 'legend', name: 'Legende', minLevel: 60, description: 'Ein Vorbild für jede Gilde.' },
];

export function getRank(level: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) current = r;
  return current;
}

export function getNextRank(level: number): Rank | null {
  return RANKS.find((r) => r.minLevel > level) ?? null;
}
