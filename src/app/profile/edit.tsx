import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Card, ConfirmDialog, Screen } from '@/components';
import { Trash2 } from 'lucide-react-native';
import { formFromProfile, profileFormSchema, type ProfileForm } from '@/domain/profileSchema';
import { currentAge } from '@/domain/training';
import { BodyFields, EquipmentField, ExperienceField, FocusField, GoalField, HistoryField, LimitationFields, LocationField, NameField, ScheduleFields } from '@/features/ProfileFields';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

export default function EditProfile() {
  const { profile, updateProfile, clearBodyData } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const [regenerate, setRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, formState, handleSubmit, setValue } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onChange',
    defaultValues: profile ? formFromProfile(profile, currentAge(profile, new Date())) : undefined,
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
      <LocationField {...props} />
      <EquipmentField {...props} />
      <FocusField {...props} />
      <LimitationFields {...props} />
      <HistoryField {...props} />
      <AppText variant="heading" accessibilityRole="header">Über dich</AppText>
      <BodyFields {...props} />
      <Button label="Körperdaten löschen" variant="secondary" icon={Trash2} onPress={() => setConfirmClear(true)} />
      <Card variant="secondary" style={styles.toggle}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Trainingsplan neu erstellen</AppText>
          <AppText variant="small" tone="secondary">Erstellt aus den neuen Angaben sofort einen neuen Plan. Eigene Planänderungen gehen dabei verloren. Ohne Haken bleibt dein Plan, und unter Training erscheinen passende Vorschläge.</AppText>
        </View>
        <Switch
          value={regenerate}
          onValueChange={setRegenerate}
          trackColor={{ true: colors.accent, false: colors.cardSecondary }}
          thumbColor={colors.text}
          accessibilityLabel="Trainingsplan neu erstellen"
        />
      </Card>
      <ConfirmDialog
        visible={confirmClear}
        title="Körperdaten löschen?"
        message="Alter, Größe, Körpergewicht und der gesamte Gewichtsverlauf werden gelöscht, auf diesem Gerät und im Konto. Trainings bleiben erhalten."
        confirmLabel="Löschen"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false);
          await clearBodyData();
          setValue('ageYears', null);
          setValue('heightCm', null);
          setValue('bodyWeightKg', null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
