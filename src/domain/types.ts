// Kern-Datentypen von GYMQUEST. Diese Datei ist frei von UI- und Datenbankcode.

export type Experience = 'beginner' | 'intermediate' | 'advanced';
/** mobility = Technik und sichere Ausführung lernen (historischer Schlüssel). */
export type Goal = 'general' | 'strength' | 'hypertrophy' | 'full_body' | 'mobility';
export type TrainingLocation = 'gym' | 'home' | 'outdoor';
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
  | 'calves'
  | 'carry'
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
  /** Häufige Ausführungsfehler */
  mistakes: string[];
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
  /** Optional: Wo trainiert wird. null = unbekannt. */
  location?: TrainingLocation | null;
  /** Optional: Muskeln, die besonders berücksichtigt werden sollen (Schlüssel aus muscles.ts). */
  focusMuscles?: string[];
  /** Optional: bisherige Trainingshistorie in eigenen Worten. */
  history?: string;
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
  /** Abgelehnte Anpassungsvorschläge (IDs aus adaptations.ts) */
  dismissedSuggestions?: string[];
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
  /** Gesetzt, wenn der Nutzer den Plan gelöscht hat (bleibt für den Cloud-Abgleich erhalten). */
  deletedAt?: string | null;
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
  /** Momentaufnahme des Plans zum Zeitpunkt des Trainings. Spätere Planänderungen verändern sie nicht. */
  planName?: string | null;
  exercises?: SessionExercise[];
}

/** Geplante und tatsächliche Arbeit einer Übung in einem abgeschlossenen Training. */
export interface SessionExercise {
  exerciseId: string;
  plannedSets: number;
  repsMin: number;
  repsMax: number;
  durationSec?: number;
  restSec: number;
  completedSets: number;
  skipped?: boolean;
  /** Ursprünglich geplante Übung, wenn sie im Training ausgetauscht wurde. */
  replacedExerciseId?: string;
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
    skipped?: boolean;
    replacedExerciseId?: string;
  }[];
  planName?: string | null;
  readiness?: number | null;
  currentExerciseIndex: number;
  /** ISO-Zeitpunkt, an dem die laufende Pause endet. */
  restEndsAt: string | null;
  /** Training angehalten seit (ISO). Angehaltene Zeit zählt nicht zur Trainingsdauer. */
  pausedAt?: string | null;
  /** Bisher angehaltene Sekunden */
  pausedSec?: number;
}

export type XpSource = 'workout' | 'quest' | 'achievement' | 'lesson' | 'chapter';

export interface XpEvent {
  id: string;
  source: XpSource;
  refId: string;
  amount: number;
  createdAt: string;
  label: string;
}
