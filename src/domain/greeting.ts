// Begrüßung auf dem Dashboard: abwechslungsreich, aber ruhig.
// Der Text wechselt täglich (nicht bei jedem Öffnen) und passt zur aktuellen Situation.

export interface GreetingContext {
  name: string;
  date: Date;
  hasSessions: boolean;
  hasActiveWorkout: boolean;
  trainingToday: boolean;
  /** Heute bereits ein Training abgeschlossen */
  trainedToday: boolean;
  openQuests: number;
}

export interface Greeting {
  title: string;
  subtitle: string;
}

const ACTIVE = ['Dein Training läuft noch – mach weiter, wo du aufgehört hast.'];
const TODAY = ['Bereit für deine nächste Trainingseinheit?', 'Heute steht eine Einheit an.', 'Deine Einheit für heute ist vorbereitet.'];
const QUESTS = ['Deine nächste Quest wartet.', 'Ein paar Quests sind diese Woche noch offen.', 'Jede Einheit bringt dich deinem nächsten Level näher.'];
const REST = ['Heute ist Ruhetag – Erholung gehört zum Training.', 'Gönn deinem Körper heute Erholung.', 'Kein Training geplant. Ein Spaziergang tut trotzdem gut.'];
const DONE_TODAY = ['Starke Einheit heute. Jetzt zählt die Erholung.', 'Training für heute erledigt – gut gemacht.'];
const FIRST = ['Deine erste Quest wartet auf dich.', 'Bereit für dein erstes Training?'];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function pick(list: string[], date: Date): string {
  return list[dayOfYear(date) % list.length];
}

export function getGreeting(ctx: GreetingContext): Greeting {
  const name = ctx.name.trim() || 'Abenteurer';
  const title = ctx.hasSessions ? `Willkommen zurück, ${name}.` : `Willkommen, ${name}.`;
  let pool: string[];
  if (ctx.hasActiveWorkout) pool = ACTIVE;
  else if (!ctx.hasSessions) pool = FIRST;
  else if (ctx.trainedToday) pool = DONE_TODAY;
  else if (ctx.trainingToday) pool = TODAY;
  else if (ctx.openQuests > 0) pool = QUESTS;
  else pool = REST;
  return { title, subtitle: pick(pool, ctx.date) };
}
