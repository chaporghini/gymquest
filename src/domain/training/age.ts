import type { Profile } from '../types';

// Alter wird nur als Zahl mit Erfassungsdatum gespeichert, kein Geburtsdatum.

export type AgeGroup = 'minor' | 'adult' | 'senior' | 'unknown';

export const AGE_LIMITS = { min: 12, max: 100, adult: 18, senior: 65 } as const;

/** Aktuelles Alter, fortgeschrieben ab dem Erfassungsdatum. null, wenn nicht angegeben oder unplausibel. */
export function currentAge(profile: Pick<Profile, 'ageYears' | 'ageRecordedAt'>, now: Date): number | null {
  const age = profile.ageYears;
  if (age == null || !Number.isFinite(age) || age < AGE_LIMITS.min || age > AGE_LIMITS.max) return null;
  const recorded = profile.ageRecordedAt ? new Date(profile.ageRecordedAt) : null;
  if (!recorded || Number.isNaN(recorded.getTime())) return Math.floor(age);
  const years = Math.floor((now.getTime() - recorded.getTime()) / (365.25 * 86_400_000));
  return Math.floor(age) + Math.max(0, years);
}

export function ageGroup(profile: Pick<Profile, 'ageYears' | 'ageRecordedAt'>, now: Date): AgeGroup {
  const age = currentAge(profile, now);
  if (age === null) return 'unknown';
  if (age < AGE_LIMITS.adult) return 'minor';
  if (age >= AGE_LIMITS.senior) return 'senior';
  return 'adult';
}
