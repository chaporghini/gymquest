import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { ArrowLeft, Swords } from 'lucide-react-native';
import { useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, ProgressBar, Screen } from '@/components';
import { DEFAULT_PROFILE_FORM, profileFormSchema, type ProfileForm } from '@/domain/profileSchema';
import { BodyFields, EquipmentField, ExperienceField, FocusField, GoalField, HistoryField, LimitationFields, LocationField, NameField, ScheduleFields } from '@/features/ProfileFields';
import { equipmentLabels, experienceLabels, goalLabels, limitationLabels } from '@/i18n/labels';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

interface Step {
  title: string;
  subtitle: string;
  fields: FieldPath<ProfileForm>[];
}

const STEPS: Step[] = [
  { title: 'Willkommen bei GYMQUEST', subtitle: 'Sammle XP durch regelmäßiges, sicheres Training und steige im Rang auf.', fields: ['displayName'] },
  { title: 'Deine Erfahrung', subtitle: 'Damit Übungen und Umfang zu dir passen.', fields: ['experience'] },
  { title: 'Dein Ziel', subtitle: 'Bestimmt Wiederholungen, Pausen und Übungsauswahl.', fields: ['goal'] },
  { title: 'Dein Wochenrhythmus', subtitle: 'Wir planen Erholungstage automatisch ein.', fields: ['daysPerWeek', 'sessionMinutes'] },
  { title: 'Ort und Ausstattung', subtitle: 'Was steht dir beim Training zur Verfügung?', fields: ['location', 'equipment', 'focusMuscles'] },
  { title: 'Rücksicht nehmen', subtitle: 'Alles auf dieser Seite ist freiwillig.', fields: ['limitations', 'excludedExerciseIds', 'notes', 'history'] },
  { title: 'Über dich', subtitle: 'Hilft uns, Empfehlungen sicher zu halten.', fields: ['ageYears', 'heightCm', 'bodyWeightKg'] },
  { title: 'Bereit für die erste Quest', subtitle: 'Prüfe deine Angaben. Danach erstellst du deinen Trainingsplan, Schritt für Schritt.', fields: [] },
];

export default function Onboarding() {
  const { completeOnboarding, skipOnboarding, cloud } = useApp();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, formState, trigger, handleSubmit, getValues } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: DEFAULT_PROFILE_FORM,
    mode: 'onChange',
  });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = async () => {
    const valid = current.fields.length === 0 || (await trigger(current.fields));
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const finish = handleSubmit(async (form) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await completeOnboarding(form);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
      setBusy(false);
    }
  });

  const skip = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      await skipOnboarding();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
      setBusy(false);
    }
  };

  const fieldProps = { control, errors: formState.errors };
  const values = getValues();

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <View style={styles.footer}>
          {submitError ? <AppText tone="error" accessibilityRole="alert">{submitError}</AppText> : null}
          <Button
            label={isLast ? 'Plan erstellen und starten' : 'Weiter'}
            size="lg"
            fullWidth
            loading={busy}
            onPress={isLast ? finish : next}
          />
        </View>
      }>
      <View style={styles.topBar}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => s - 1)} accessibilityRole="button" accessibilityLabel="Zurück" hitSlop={12} style={styles.iconBtn}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
        <AppText variant="small" tone="secondary">Schritt {step + 1} von {STEPS.length}</AppText>
        <Pressable onPress={skip} disabled={busy} accessibilityRole="button" accessibilityLabel="Onboarding überspringen" accessibilityHint="Erstellt ein Standardprofil, das du später anpassen kannst" hitSlop={12} style={styles.skip}>
          <AppText variant="small" tone="accent" style={styles.bold}>Überspringen</AppText>
        </Pressable>
      </View>
      <ProgressBar value={(step + 1) / STEPS.length} height={4} accessibilityLabel="Fortschritt im Onboarding" />

      {step === 0 ? (
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Swords size={36} color={colors.onAccent} /></View>
        </View>
      ) : null}

      <View style={styles.heading}>
        <AppText variant="title" accessibilityRole="header">{current.title}</AppText>
        <AppText tone="secondary">{current.subtitle}</AppText>
      </View>

      {step === 0 && <NameField {...fieldProps} />}
      {step === 0 && (
        <Pressable onPress={() => router.push('/account')} accessibilityRole="button" style={styles.existing}>
          <AppText variant="small" tone="secondary">
            {cloud.configured ? 'Schon auf einem anderen Gerät gespielt? ' : 'Du hast eine Sicherung? '}
            <AppText variant="small" tone="accent" style={styles.bold}>{cloud.configured ? 'Anmelden' : 'Backup einspielen'}</AppText>
          </AppText>
        </Pressable>
      )}
      {step === 1 && <ExperienceField {...fieldProps} />}
      {step === 2 && <GoalField {...fieldProps} />}
      {step === 3 && <ScheduleFields {...fieldProps} />}
      {step === 4 && <LocationField {...fieldProps} />}
      {step === 4 && <EquipmentField {...fieldProps} />}
      {step === 4 && <FocusField {...fieldProps} />}
      {step === 5 && <LimitationFields {...fieldProps} />}
      {step === 5 && <HistoryField {...fieldProps} />}
      {step === 6 && <BodyFields {...fieldProps} />}
      {step === 7 && (
        <Card style={styles.summary}>
          <SummaryRow label="Name" value={values.displayName.trim() || 'Abenteurer'} />
          <SummaryRow label="Erfahrung" value={experienceLabels[values.experience]} />
          <SummaryRow label="Ziel" value={goalLabels[values.goal]} />
          <SummaryRow label="Rhythmus" value={`${values.daysPerWeek} Tage · ${values.sessionMinutes} min`} />
          <SummaryRow label="Equipment" value={values.equipment.map((e) => equipmentLabels[e]).join(', ')} />
          <SummaryRow label="Einschränkungen" value={values.limitations.length ? values.limitations.map((l) => limitationLabels[l]).join(', ') : 'Keine'} />
          {values.ageYears ? <SummaryRow label="Alter" value={`${values.ageYears} Jahre`} /> : null}
          {values.excludedExerciseIds.length > 0 ? <SummaryRow label="Ausgeschlossen" value={`${values.excludedExerciseIds.length} Übungen`} /> : null}
        </Card>
      )}
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant="small" tone="secondary" style={styles.summaryLabel}>{label}</AppText>
      <AppText variant="bodyStrong" style={styles.summaryValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, justifyContent: 'center' },
  skip: { minHeight: 44, justifyContent: 'center' },
  existing: { minHeight: 44, justifyContent: 'center' },
  bold: { fontWeight: '700' },
  hero: { alignItems: 'flex-start', marginTop: spacing.lg },
  heroIcon: { width: 72, height: 72, borderRadius: radius.xl, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  heading: { gap: spacing.sm },
  summary: { gap: spacing.md },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summaryLabel: { width: 120 },
  summaryValue: { flex: 1 },
});
