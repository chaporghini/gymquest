import { startOfWeek, weekKey } from './dates';
import type { PlanDay, TrainingPlan } from './types';

// Einheiten für eine einzelne Woche auf einen anderen Tag verschieben. Der Plan selbst bleibt unverändert.

/** Wochentage der Einheiten in der Woche von `date`, mit Verschiebungen. */
export function daysForWeek(plan: TrainingPlan, date: Date): PlanDay[] {
  const week = weekKey(startOfWeek(date));
  const moves = (plan.moves ?? []).filter((m) => m.week === week);
  if (moves.length === 0) return plan.days;
  return plan.days.map((d) => {
    const m = moves.find((x) => x.dayId === d.id);
    return m ? { ...d, weekday: m.weekday } : d;
  });
}

/** Plan mit den Wochentagen der Woche von `date`. */
export function planForWeek<T extends TrainingPlan | null>(plan: T, date: Date): T {
  if (!plan) return plan;
  const days = daysForWeek(plan, date);
  return (days === plan.days ? plan : { ...plan, days }) as T;
}

/**
 * Verschiebt eine Einheit in dieser Woche auf `weekday`. Liegt dort schon eine Einheit, tauschen beide den Tag.
 * Alte Verschiebungen (vor `now`s Woche) werden aufgeräumt.
 */
export function moveDayInWeek(plan: TrainingPlan, dayId: string, date: Date, weekday: number, now: Date): TrainingPlan {
  const week = weekKey(startOfWeek(date));
  const current = daysForWeek(plan, date);
  const source = current.find((d) => d.id === dayId);
  if (!source || source.weekday === weekday) return plan;
  const target = current.find((d) => d.weekday === weekday);
  const effective = current.map((d) => (d.id === dayId ? { ...d, weekday } : target && d.id === target.id ? { ...d, weekday: source.weekday } : d));
  const nowWeek = weekKey(startOfWeek(now));
  const keep = (plan.moves ?? []).filter((m) => m.week !== week && m.week >= nowWeek);
  const added = effective
    .filter((d) => plan.days.find((o) => o.id === d.id)?.weekday !== d.weekday)
    .map((d) => ({ week, dayId: d.id, weekday: d.weekday }));
  return { ...plan, moves: [...keep, ...added] };
}

/** true, wenn die Einheit in der Woche von `date` nicht an ihrem üblichen Tag liegt. */
export function isMoved(plan: TrainingPlan, dayId: string, date: Date): boolean {
  const week = weekKey(startOfWeek(date));
  return (plan.moves ?? []).some((m) => m.week === week && m.dayId === dayId);
}
