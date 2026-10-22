import { z } from 'zod';

import type { Profile } from './types';

export const equipmentValues = ['gym', 'dumbbells', 'bodyweight', 'kettlebell', 'bands', 'pullup_bar'] as const;
export const limitationValues = ['knees', 'shoulders', 'lower_back', 'wrists'] as const;

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(24, 'Maximal 24 Zeichen.')
    .regex(/^[^<>]*$/, 'Bitte keine spitzen Klammern verwenden.'),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  goal: z.enum(['general', 'strength', 'hypertrophy', 'mobility']),
  daysPerWeek: z.number().int().min(2, 'Mindestens 2 Tage.').max(6, 'Mindestens ein Ruhetag pro Woche.'),
  sessionMinutes: z.number().int().min(20).max(120),
  equipment: z.array(z.enum(equipmentValues)).min(1, 'Wähle mindestens eine Option.'),
  limitations: z.array(z.enum(limitationValues)),
  excludedExerciseIds: z.array(z.string()),
  notes: z.string().max(300, 'Maximal 300 Zeichen.').optional(),
  bodyWeightKg: z
    .number()
    .min(30, 'Bitte einen realistischen Wert eingeben.')
    .max(300, 'Bitte einen realistischen Wert eingeben.')
    .nullable()
    .optional(),
});

export type ProfileForm = z.infer<typeof profileFormSchema>;

export const DEFAULT_PROFILE_FORM: ProfileForm = {
  displayName: '',
  experience: 'beginner',
  goal: 'general',
  daysPerWeek: 3,
  sessionMinutes: 45,
  equipment: ['bodyweight'],
  limitations: [],
  excludedExerciseIds: [],
  notes: '',
  bodyWeightKg: null,
};

export function profileFromForm(form: ProfileForm, createdAt: string, onboardingCompleted = true): Profile {
  return {
    ...form,
    displayName: form.displayName.trim() || 'Abenteurer',
    notes: form.notes?.trim() || undefined,
    bodyWeightKg: form.bodyWeightKg ?? null,
    onboardingCompleted,
    createdAt,
  };
}
