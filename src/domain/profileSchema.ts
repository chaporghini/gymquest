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
  goal: z.enum(['general', 'strength', 'hypertrophy', 'full_body', 'mobility']),
  daysPerWeek: z.number().int().min(2, 'Mindestens 2 Tage.').max(6, 'Mindestens ein Ruhetag pro Woche.'),
  sessionMinutes: z.number().int().min(20).max(120),
  equipment: z.array(z.enum(equipmentValues)).min(1, 'Wähle mindestens eine Option.'),
  limitations: z.array(z.enum(limitationValues)),
  excludedExerciseIds: z.array(z.string()),
  location: z.enum(['gym', 'home', 'outdoor']).nullable().optional(),
  focusMuscles: z.array(z.string()).max(4, 'Höchstens 4 Schwerpunkte.').optional(),
  history: z.string().max(300, 'Maximal 300 Zeichen.').optional(),
  notes: z.string().max(300, 'Maximal 300 Zeichen.').optional(),
  bodyWeightKg: z
    .number()
    .min(30, 'Bitte einen realistischen Wert eingeben.')
    .max(300, 'Bitte einen realistischen Wert eingeben.')
    .nullable()
    .optional(),
  ageYears: z
    .number()
    .int('Bitte ganze Jahre angeben.')
    .min(12, 'GYMQUEST ist ab 12 Jahren gedacht.')
    .max(100, 'Bitte einen realistischen Wert eingeben.')
    .nullable()
    .optional(),
  heightCm: z
    .number()
    .min(100, 'Bitte einen realistischen Wert eingeben.')
    .max(250, 'Bitte einen realistischen Wert eingeben.')
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
  location: null,
  focusMuscles: [],
  history: '',
  notes: '',
  bodyWeightKg: null,
  ageYears: null,
  heightCm: null,
};

/**
 * Baut das Profil aus dem Formular. Felder, die das Formular nicht kennt (Gewichtsverlauf,
 * bekannte Leistungen), werden aus `previous` übernommen.
 */
export function profileFromForm(form: ProfileForm, createdAt: string, onboardingCompleted = true, previous: Profile | null = null, now = new Date()): Profile {
  const ageYears = form.ageYears ?? null;
  // Das Alter wird mit Datum gespeichert, damit es sich später von selbst fortschreibt.
  const ageRecordedAt = ageYears == null ? null : previous?.ageYears === ageYears && previous.ageRecordedAt ? previous.ageRecordedAt : now.toISOString();
  return {
    ...previous,
    ...form,
    displayName: form.displayName.trim() || 'Abenteurer',
    notes: form.notes?.trim() || undefined,
    history: form.history?.trim() || undefined,
    location: form.location ?? null,
    focusMuscles: form.focusMuscles ?? [],
    bodyWeightKg: form.bodyWeightKg ?? null,
    heightCm: form.heightCm ?? null,
    ageYears,
    ageRecordedAt,
    onboardingCompleted,
    createdAt,
  };
}

/** Formularwerte aus einem gespeicherten Profil. Das Alter wird dabei fortgeschrieben. */
export function formFromProfile(profile: Profile, ageNow: number | null): ProfileForm {
  return {
    displayName: profile.displayName,
    experience: profile.experience,
    goal: profile.goal,
    daysPerWeek: profile.daysPerWeek,
    sessionMinutes: profile.sessionMinutes,
    equipment: profile.equipment,
    limitations: profile.limitations,
    excludedExerciseIds: profile.excludedExerciseIds,
    location: profile.location ?? null,
    focusMuscles: profile.focusMuscles ?? [],
    history: profile.history ?? '',
    notes: profile.notes ?? '',
    bodyWeightKg: profile.bodyWeightKg ?? null,
    ageYears: ageNow,
    heightCm: profile.heightCm ?? null,
  };
}
