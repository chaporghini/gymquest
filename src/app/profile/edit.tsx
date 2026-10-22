import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components';
import { profileFormSchema, type ProfileForm } from '@/domain/profileSchema';
import { EquipmentField, ExperienceField, GoalField, LimitationFields, NameField, ScheduleFields } from '@/features/ProfileFields';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

export default function EditProfile() {
  const { profile, updateProfile } = useApp();
  const [regenerate, setRegenerate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { control, formState, handleSubmit } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onChange',
    defaultValues: profile
      ? {
          displayName: profile.displayName,
          experience: profile.experience,
          goal: profile.goal,
          daysPerWeek: profile.daysPerWeek,
          sessionMinutes: profile.sessionMinutes,
          equipment: profile.equipment,
          limitations: profile.limitations,
          excludedExerciseIds: profile.excludedExerciseIds,
          notes: profile.notes ?? '',
          bodyWeightKg: profile.bodyWeightKg ?? null,
        }
      : undefined,
  });

  const save = handleSubmit(async (form) => {
    setError(null);
    try {
      await updateProfile(form, regenerate);
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    }
  });

  const props = { control, errors: formState.errors };
  const hasErrors = Object.keys(formState.errors).length > 0;

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.footer}>
          {hasErrors ? <AppText tone="error" accessibilityRole="alert">Bitte prüfe die markierten Felder.</AppText> : null}
          {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}
          <Button label="Speichern" size="lg" fullWidth loading={formState.isSubmitting} onPress={save} />
        </View>
      }>
      <NameField {...props} />
      <ExperienceField {...props} />
      <GoalField {...props} />
      <ScheduleFields {...props} />
      <EquipmentField {...props} />
      <LimitationFields {...props} />
      <Card variant="secondary" style={styles.toggle}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Trainingsplan neu erstellen</AppText>
          <AppText variant="small" tone="secondary">Empfohlen, wenn du Tage, Ziel oder Equipment geändert hast. Eigene Planänderungen gehen dabei verloren.</AppText>
        </View>
        <Switch
          value={regenerate}
          onValueChange={setRegenerate}
          trackColor={{ true: colors.accent, false: colors.cardSecondary }}
          thumbColor={colors.text}
          accessibilityLabel="Trainingsplan neu erstellen"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
