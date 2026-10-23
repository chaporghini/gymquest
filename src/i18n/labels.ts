import type { Equipment, ExerciseCategory, Experience, Goal, Limitation, MuscleGroup, TrainingLocation } from '@/domain/types';

export const experienceLabels: Record<Experience, string> = {
  beginner: 'Anfänger',
  intermediate: 'Fortgeschritten',
  advanced: 'Erfahren',
};

export const goalLabels: Record<Goal, string> = {
  general: 'Allgemeine Fitness',
  strength: 'Kraft',
  hypertrophy: 'Muskelaufbau',
  full_body: 'Ganzkörpertraining',
  mobility: 'Technik & sichere Ausführung',
};

export const locationLabels: Record<TrainingLocation, string> = {
  gym: 'Fitnessstudio',
  home: 'Zuhause',
  outdoor: 'Draußen',
};

export const equipmentLabels: Record<Equipment, string> = {
  gym: 'Fitnessstudio',
  dumbbells: 'Kurzhanteln',
  bodyweight: 'Körpergewicht',
  kettlebell: 'Kettlebell',
  bands: 'Widerstandsbänder',
  pullup_bar: 'Klimmzugstange',
};

export const limitationLabels: Record<Limitation, string> = {
  knees: 'Knie',
  shoulders: 'Schultern',
  lower_back: 'Unterer Rücken',
  wrists: 'Handgelenke',
};

export const muscleLabels: Record<MuscleGroup, string> = {
  chest: 'Brust',
  back: 'Rücken',
  shoulders: 'Schultern',
  legs: 'Beine',
  glutes: 'Gesäß',
  arms: 'Arme',
  core: 'Rumpf',
  full_body: 'Ganzkörper',
};

export const categoryLabels: Record<ExerciseCategory, string> = {
  compound: 'Grundübung',
  isolation: 'Isolation',
  core: 'Rumpf',
  mobility: 'Mobilität',
};

export const difficultyLabels: Record<1 | 2 | 3, string> = { 1: 'Leicht', 2: 'Mittel', 3: 'Schwer' };
