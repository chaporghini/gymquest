import { useState } from 'react';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { AppText, Chip, Stepper } from '@/components';
import { EXERCISES } from '@/data/exercises';
import { equipmentValues, limitationValues, type ProfileForm } from '@/domain/profileSchema';
import type { Experience, Goal } from '@/domain/types';
import { equipmentLabels, experienceLabels, goalLabels, limitationLabels } from '@/i18n/labels';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface FieldProps {
  control: Control<ProfileForm>;
  errors: FieldErrors<ProfileForm>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <AppText variant="small" tone="error" accessibilityRole="alert">{message}</AppText>;
}

function Label({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.label}>
      <AppText variant="bodyStrong">{title}</AppText>
      {hint ? <AppText variant="small" tone="secondary">{hint}</AppText> : null}
    </View>
  );
}

export function NameField({ control, errors }: FieldProps) {
  return (
    <View style={styles.field}>
      <Label title="Spielername (optional)" hint="So begrüßen wir dich in der App." />
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextInput
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="z. B. Luis oder IronWolf"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={24}
            returnKeyType="done"
            accessibilityLabel="Spielername"
            style={styles.input}
          />
        )}
      />
      <FieldError message={errors.displayName?.message} />
    </View>
  );
}

const experienceHints: Record<Experience, string> = {
  beginner: 'Neu im Krafttraining oder lange Pause.',
  intermediate: 'Du kennst die Grundübungen.',
  advanced: 'Mehrere Jahre regelmäßiges Training.',
};

export function ExperienceField({ control }: FieldProps) {
  return (
    <View style={styles.field}>
      <Label title="Trainingserfahrung" />
      <Controller
        control={control}
        name="experience"
        render={({ field }) => (
          <View style={styles.options} accessibilityRole="radiogroup">
            {(Object.keys(experienceLabels) as Experience[]).map((key) => (
              <OptionRow key={key} title={experienceLabels[key]} hint={experienceHints[key]} selected={field.value === key} onPress={() => field.onChange(key)} />
            ))}
          </View>
        )}
      />
    </View>
  );
}

const goalHints: Record<Goal, string> = {
  general: 'Ausgewogenes Training für Alltag und Gesundheit.',
  strength: 'Schwerere Gewichte, weniger Wiederholungen.',
  hypertrophy: 'Mittlere Wiederholungen für Muskelwachstum.',
  mobility: 'Mehr Mobilität, Rumpf und kontrollierte Kraft.',
};

export function GoalField({ control }: FieldProps) {
  return (
    <View style={styles.field}>
      <Label title="Trainingsziel" />
      <Controller
        control={control}
        name="goal"
        render={({ field }) => (
          <View style={styles.options} accessibilityRole="radiogroup">
            {(Object.keys(goalLabels) as Goal[]).map((key) => (
              <OptionRow key={key} title={goalLabels[key]} hint={goalHints[key]} selected={field.value === key} onPress={() => field.onChange(key)} />
            ))}
          </View>
        )}
      />
    </View>
  );
}

export function ScheduleFields({ control, errors }: FieldProps) {
  return (
    <>
      <View style={styles.field}>
        <Label title="Trainingstage pro Woche" hint="Mindestens ein Ruhetag pro Woche ist eingeplant." />
        <Controller
          control={control}
          name="daysPerWeek"
          render={({ field }) => (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {[2, 3, 4, 5, 6].map((n) => (
                <Chip key={n} role="radio" label={`${n} Tage`} selected={field.value === n} onPress={() => field.onChange(n)} />
              ))}
            </View>
          )}
        />
        <FieldError message={errors.daysPerWeek?.message} />
      </View>
      <View style={styles.field}>
        <Label title="Zeit pro Training" hint="Inklusive Aufwärmen." />
        <Controller
          control={control}
          name="sessionMinutes"
          render={({ field }) => (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {[30, 45, 60, 75, 90].map((n) => (
                <Chip key={n} role="radio" label={`${n} min`} selected={field.value === n} onPress={() => field.onChange(n)} />
              ))}
            </View>
          )}
        />
      </View>
    </>
  );
}

export function EquipmentField({ control, errors }: FieldProps) {
  return (
    <View style={styles.field}>
      <Label title="Verfügbares Equipment" hint="Mehrfachauswahl möglich. Übungen mit Körpergewicht sind immer dabei." />
      <Controller
        control={control}
        name="equipment"
        render={({ field }) => (
          <View style={styles.chips}>
            {equipmentValues.map((key) => {
              const selected = field.value.includes(key);
              return (
                <Chip
                  key={key}
                  role="checkbox"
                  label={equipmentLabels[key]}
                  selected={selected}
                  onPress={() => field.onChange(selected ? field.value.filter((v) => v !== key) : [...field.value, key])}
                />
              );
            })}
          </View>
        )}
      />
      <FieldError message={errors.equipment?.message} />
    </View>
  );
}

export function LimitationFields({ control, errors }: FieldProps) {
  const [showExercises, setShowExercises] = useState(false);
  return (
    <>
      <View style={styles.field}>
        <Label
          title="Körperliche Einschränkungen (optional)"
          hint="Übungen, die diese Bereiche stark belasten, werden gemieden. Bei Schmerzen oder Verletzungen sprich bitte vorher mit einer Ärztin oder einem Arzt."
        />
        <Controller
          control={control}
          name="limitations"
          render={({ field }) => (
            <View style={styles.chips}>
              {limitationValues.map((key) => {
                const selected = field.value.includes(key);
                return (
                  <Chip
                    key={key}
                    role="checkbox"
                    label={limitationLabels[key]}
                    selected={selected}
                    onPress={() => field.onChange(selected ? field.value.filter((v) => v !== key) : [...field.value, key])}
                  />
                );
              })}
            </View>
          )}
        />
      </View>
      <View style={styles.field}>
        <Pressable
          onPress={() => setShowExercises((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showExercises }}
          accessibilityLabel="Übungen ausschließen"
          style={styles.expander}>
          <Label title="Übungen ausschließen (optional)" hint="Diese Übungen kommen nicht in deinen Plan." />
          <ChevronRight size={20} color={colors.textSecondary} style={{ transform: [{ rotate: showExercises ? '90deg' : '0deg' }] }} />
        </Pressable>
        {showExercises ? (
          <Controller
            control={control}
            name="excludedExerciseIds"
            render={({ field }) => (
              <View style={styles.chips}>
                {EXERCISES.map((e) => {
                  const selected = field.value.includes(e.id);
                  return (
                    <Chip
                      key={e.id}
                      role="checkbox"
                      label={e.name}
                      selected={selected}
                      onPress={() => field.onChange(selected ? field.value.filter((v) => v !== e.id) : [...field.value, e.id])}
                    />
                  );
                })}
              </View>
            )}
          />
        ) : null}
      </View>
      <View style={styles.field}>
        <Label title="Notizen (optional)" hint="Zum Beispiel: Physiotherapie-Empfehlungen." />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <TextInput
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              multiline
              maxLength={300}
              placeholder="Optional"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Notizen"
              style={[styles.input, styles.multiline]}
            />
          )}
        />
        <FieldError message={errors.notes?.message} />
      </View>
      <View style={styles.field}>
        <Controller
          control={control}
          name="bodyWeightKg"
          render={({ field }) => (
            <Stepper label="Körpergewicht – optional" unit="kg" value={field.value ?? null} onChange={field.onChange} step={0.5} min={0} max={300} decimals />
          )}
        />
        <AppText variant="small" tone="secondary">Freiwillig. Wird nur lokal gespeichert und nicht für die Planerstellung benötigt.</AppText>
        <FieldError message={errors.bodyWeightKg?.message} />
      </View>
    </>
  );
}

function OptionRow({ title, hint, selected, onPress }: { title: string; hint: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${hint}`}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.85 }]}>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="small" tone="secondary">{hint}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.md },
  label: { gap: 2, flex: 1 },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
  },
  multiline: { minHeight: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  options: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: 'rgba(199,255,85,0.06)' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  flex: { flex: 1, gap: 2 },
  expander: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
});
