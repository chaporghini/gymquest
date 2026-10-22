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
  /** Optional, nie verpflichtend. Aktueller Wert; der Verlauf steht in `bodyLog`. */
  bodyWeightKg?: number | null;
  /** Optional. Statt eines Geburtsdatums wird nur das Alter mit Erfassungsdatum gespeichert (Datensparsamkeit). */
  ageYears?: number | null;
  ageRecordedAt?: string | null;
  /** Optional, in Zentimetern. */
  heightCm?: number | null;
  /** Verlauf von Körpergewicht und -größe, jeweils mit Datum. */
  bodyLog?: BodyLog;
  /** Optional: bereits bekannte Arbeitsgewichte, z. B. aus einem früheren Training. */
  knownLoads?: KnownLoad[];
  onboardingCompleted: boolean;
  createdAt: string;
}

export type BodyMetric = 'weight' | 'height';

/** Ein Messwert mit Datum (WeightEntry bzw. HeightEntry). */
export interface BodyEntry {
  id: string;
  kind: BodyMetric;
  /** kg bei Gewicht, cm bei Größe */
  value: number;
  recordedAt: string;
}

export interface BodyLog {
  entries: BodyEntry[];
  /** Zeitpunkt, an dem der Nutzer alle Körperdaten gelöscht hat. Ältere Einträge anderer Geräte werden verworfen. */
  clearedAt?: string | null;
}

export interface KnownLoad {
  exerciseId: string;
  weightKg: number;
  reps: number;
  recordedAt: string;
}

/** Art der Last, bestimmt sinnvolle Steigerungsschritte. */
export type LoadType = 'barbell' | 'dumbbell' | 'machine' | 'kettlebell' | 'bodyweight';

export interface Settings {
  hapticsEnabled: boolean;
  defaultRestSeconds: number | null; // null = Pausenzeit aus dem Plan verwenden
  weightUnit: 'kg';
  /** Kleinste verfügbare Gewichtsstufe je Gerätetyp in kg (überschreibt die Standardwerte). */
  loadSteps?: Partial<Record<LoadType, number>>;
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

export type Effort = 'easy' | 'good' | 'hard' | 'max';

/** Rückmeldung zu einer Übung in einem Training. Alle Angaben sind freiwillig. */
export interface ExerciseFeedback {
  exerciseId: string;
  /** easy: deutlich mehr möglich, good: ca. 2–3 Wdh. in Reserve, hard: 0–1 in Reserve, max: am Limit */
  effort?: Effort | null;
  techniqueUnsure?: boolean;
  /** Beschwerden/Schmerzen während der Übung */
  pain?: boolean;
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
  feedback?: ExerciseFeedback[];
  /** Selbst eingeschätzte Erholung vor dem Training, 1 = erschöpft … 5 = frisch */
  readiness?: number | null;
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
    feedback?: Omit<ExerciseFeedback, 'exerciseId'>;
  }[];
  readiness?: number | null;
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
