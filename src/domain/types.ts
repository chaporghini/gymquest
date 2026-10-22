// Kern-Datentypen von GYMQUEST. Diese Datei ist frei von UI- und Datenbankcode.

export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'general' | 'strength' | 'hypertrophy' | 'mobility';
export type Equipment = 'gym' | 'dumbbells' | 'bodyweight' | 'kettlebell' | 'bands' | 'pullup_bar';
export type Limitation = 'knees' | 'shoulders' | 'lower_back' | 'wrists';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'legs'
  | 'glutes'
  | 'arms'
  | 'core'
  | 'full_body';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push_horizontal'
  | 'push_vertical'
  | 'pull_horizontal'
  | 'pull_vertical'
  | 'arms'
  | 'core'
  | 'mobility';

export type ExerciseCategory = 'compound' | 'isolation' | 'core' | 'mobility';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  pattern: MovementPattern;
  category: ExerciseCategory;
  /** Die Übung ist möglich, wenn mindestens eines dieser Geräte vorhanden ist. */
  equipment: Equipment[];
  /** 1 = einsteigerfreundlich, 3 = anspruchsvoll */
  difficulty: 1 | 2 | 3;
  /** Gelenke/Bereiche, die bei dieser Übung stark belastet werden. */
  stresses: Limitation[];
  measurement: 'reps' | 'time';
  /** Ob ein Zusatzgewicht protokolliert wird. */
  usesWeight: boolean;
  description: string;
  steps: string[];
  tips: string[];
}

export interface Profile {
  displayName: string;
  experience: Experience;
  goal: Goal;
  daysPerWeek: number; // 2–6
  sessionMinutes: number; // 30, 45, 60, 75, 90
  equipment: Equipment[];
  limitations: Limitation[];
  excludedExerciseIds: string[];
  notes?: string;
  /** Optional, nie verpflichtend. */
  bodyWeightKg?: number | null;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface Settings {
  hapticsEnabled: boolean;
  defaultRestSeconds: number | null; // null = Pausenzeit aus dem Plan verwenden
  weightUnit: 'kg';
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** Bei Zeitübungen: Sekunden pro Satz. */
  durationSec?: number;
  restSec: number;
}

export interface PlanDay {
  id: string;
  name: string;
  /** 0 = Montag … 6 = Sonntag */
  weekday: number;
  focus: string;
  exercises: PlannedExercise[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  createdAt: string;
  split: string;
  days: PlanDay[];
}

export interface SetLog {
  exerciseId: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  durationSec: number | null;
  completed: boolean;
}

export interface WorkoutSession {
  id: string;
  planDayId: string | null;
  name: string;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  xpEarned: number;
  sets: SetLog[];
}

/** Ein laufendes Training, das bei jeder Änderung gespeichert wird. */
export interface ActiveWorkout {
  id: string;
  planDayId: string | null;
  name: string;
  startedAt: string;
  exercises: {
    exerciseId: string;
    restSec: number;
    targetRepsMin: number;
    targetRepsMax: number;
    targetDurationSec?: number;
    sets: SetLog[];
  }[];
  currentExerciseIndex: number;
  /** ISO-Zeitpunkt, an dem die laufende Pause endet. */
  restEndsAt: string | null;
}

export type XpSource = 'workout' | 'quest' | 'achievement';

export interface XpEvent {
  id: string;
  source: XpSource;
  refId: string;
  amount: number;
  createdAt: string;
  label: string;
}
