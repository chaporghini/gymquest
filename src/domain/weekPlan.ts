import { addDays, isSameDay, startOfDay, startOfWeek, weekKey } from './dates';
import { planForWeek } from './planMoves';
import { sessionsInWeek } from './progression';
import type { PlanDay, TrainingPlan, WorkoutSession } from './types';

// Wochenansicht des Trainingsplans – ausschließlich aus gespeicherten Trainingsdaten berechnet.

export type DayStatus = 'rest' | 'planned' | 'today' | 'done' | 'missed';

export interface WeekDayEntry {
  date: Date;
  weekday: number;
  planDay: PlanDay | null;
  status: DayStatus;
  /** Alle an diesem Kalendertag abgeschlossenen Trainings (auch ungeplante). */
  sessions: WorkoutSession[];
  /** Training, mit dem die geplante Einheit in dieser Woche erledigt wurde. */
  completedBy: WorkoutSession | null;
}

export interface WeekOverview {
  weekStart: Date;
  label: string;
  rangeLabel: string;
  isCurrentWeek: boolean;
  isPast: boolean;
  days: WeekDayEntry[];
  planned: number;
  completed: number;
  extraSessions: number;
}

const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  return sameMonth
    ? `${weekStart.getDate()}.–${end.getDate()}. ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
    : `${weekStart.getDate()}. ${MONTHS[weekStart.getMonth()]} – ${end.getDate()}. ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

export function getWeekOverview(basePlan: TrainingPlan | null, sessions: WorkoutSession[], anyDateInWeek: Date, now: Date): WeekOverview {
  const weekStart = startOfWeek(anyDateInWeek);
  const plan = planForWeek(basePlan, weekStart);
  const currentWeekStart = startOfWeek(now);
  const inWeek = sessionsInWeek(sessions, weekStart);
  const today = startOfDay(now);
  const used = new Set<string>();

  const days: WeekDayEntry[] = Array.from({ length: 7 }, (_, weekday) => {
    const date = addDays(weekStart, weekday);
    const planDay = plan?.days.find((d) => d.weekday === weekday) ?? null;
    const onDate = inWeek.filter((s) => isSameDay(new Date(s.finishedAt), date));
    let completedBy: WorkoutSession | null = null;
    if (planDay) {
      // Eine Einheit gilt als erledigt, wenn sie in dieser Woche trainiert wurde – auch an einem anderen Tag.
      completedBy = inWeek.find((s) => s.planDayId === planDay.id && !used.has(s.id)) ?? null;
      if (completedBy) used.add(completedBy.id);
    }
    let status: DayStatus;
    if (!planDay) status = 'rest';
    else if (completedBy) status = 'done';
    else if (isSameDay(date, today)) status = 'today';
    else if (date.getTime() < today.getTime()) status = 'missed';
    else status = 'planned';
    return { date, weekday, planDay, status, sessions: onDate, completedBy };
  });

  const planned = days.filter((d) => d.planDay).length;
  const completed = days.filter((d) => d.status === 'done').length;
  return {
    weekStart,
    label: `KW ${Number(weekKey(weekStart).split('-W')[1])}`,
    rangeLabel: formatWeekRange(weekStart),
    isCurrentWeek: weekStart.getTime() === currentWeekStart.getTime(),
    isPast: weekStart.getTime() < currentWeekStart.getTime(),
    days,
    planned,
    completed,
    extraSessions: inWeek.length - used.size,
  };
}
