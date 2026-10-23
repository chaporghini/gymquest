import { router } from 'expo-router';
import { Check, CircleCheck } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, prescriptionText, ProgressBar, Screen } from '@/components';
import { EXERCISES, getExercise } from '@/data/exercises';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/domain/dates';
import { plannedMuscleSets } from '@/domain/muscleStats';
import { MUSCLE_LABELS, MUSCLES, planMuscleLoad, type Muscle } from '@/domain/muscles';
import { buildCustomPlan, validateDraft } from '@/domain/planBuilder';
import { buildSplitDays, clampDays, estimateDayMinutes, SPLIT_LABELS, splitOptions, WEEKDAY_LAYOUTS, type SplitId } from '@/domain/planGenerator';
import { equipmentValues } from '@/domain/profileSchema';
import type { Equipment, Goal, PlanDay, Profile, TrainingLocation } from '@/domain/types';
import { BodyMap } from '@/features/BodyMap';
import { PlanDaysEditor } from '@/features/PlanDaysEditor';
import { equipmentLabels, goalLabels, locationLabels } from '@/i18n/labels';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

const STEPS = ['Trainingsziel', 'Zeit und Ausstattung', 'Aufteilung', 'Übungen', 'Plan überprüfen', 'Speichern'];
const GOALS: Goal[] = ['hypertrophy', 'strength', 'general', 'full_body', 'mobility'];
const GOAL_HINTS: Record<Goal, string> = {
  hypertrophy: 'Mittlere Wiederholungen, genug Sätze pro Muskel.',
  strength: 'Schwerere Grundübungen, weniger Wiederholungen, längere Pausen.',
  general: 'Ausgewogenes Training für Alltag und Gesundheit.',
  full_body: 'Jede Einheit trainiert den ganzen Körper.',
  mobility: 'Bewegungen sauber lernen, leichtere Übungen, mehr Mobilität.',
};
const FOCUS_CHOICES: Muscle[] = ['chest', 'side_delts', 'lats', 'upper_back', 'biceps', 'triceps', 'abs', 'glutes', 'quads', 'hamstrings', 'calves'];
const LOCATION_EQUIPMENT: Record<TrainingLocation, Equipment[]> = {
  gym: ['gym', 'dumbbells', 'pullup_bar'],
  home: ['bodyweight', 'dumbbells'],
  outdoor: ['bodyweight', 'pullup_bar'],
};

/** Plan-Ersteller in sechs Schritten. Gespeichert wird erst nach ausdrücklicher Bestätigung. */
export default function PlanCreate() {
  const { profile, savePlan, patchProfile } = useApp();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'general');
  const [daysPerWeek, setDaysPerWeek] = useState(clampDays(profile?.daysPerWeek ?? 3));
  const [minutes, setMinutes] = useState(profile?.sessionMinutes ?? 45);
  const [location, setLocation] = useState<TrainingLocation | null>(profile?.location ?? null);
  const [equipment, setEquipment] = useState<Equipment[]>(profile?.equipment ?? ['bodyweight']);
  const [focus, setFocus] = useState<Muscle[]>((profile?.focusMuscles ?? []) as Muscle[]);
  const [split, setSplit] = useState<SplitId | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>(WEEKDAY_LAYOUTS[daysPerWeek]);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [builtFor, setBuiltFor] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const draft: Profile | null = useMemo(
    () => (profile ? { ...profile, goal, daysPerWeek, sessionMinutes: minutes, location, equipment, focusMuscles: focus } : null),
    [profile, goal, daysPerWeek, minutes, location, equipment, focus],
  );
  const options = useMemo(() => splitOptions(daysPerWeek, draft?.experience ?? 'beginner', goal), [daysPerWeek, draft?.experience, goal]);
  const chosenSplit = split && options.some((o) => o.id === split) ? split : (options.find((o) => o.recommended)?.id ?? 'full');

  if (!profile || !draft) return null;

  const config = JSON.stringify([chosenSplit, weekdays, goal, minutes, equipment, focus]);

  const goTo = (next: number) => {
    setNotice(null);
    if (step === 1 && next > 1 && equipment.length === 0) return setNotice('Wähle mindestens eine Ausstattung.');
    if (step === 2 && next > 2 && weekdays.length !== daysPerWeek) return setNotice(`Wähle genau ${daysPerWeek} Trainingstage.`);
    if (next === 3 && builtFor !== config) {
      // Vorschlag aus den Angaben ableiten. Bei geänderten Angaben wird neu vorgeschlagen.
      const built = buildSplitDays(chosenSplit, draft, EXERCISES, weekdays);
      setDays(built);
      setSelected(built[0]?.weekday ?? null);
      setBuiltFor(config);
    }
    if (step === 3 && next > 3) {
      const problem = validateDraft(days);
      if (problem) return setNotice(problem);
    }
    setStep(next);
  };

  const changeDays = (n: number) => {
    setDaysPerWeek(n);
    setWeekdays(WEEKDAY_LAYOUTS[n]);
  };

  const toggleWeekday = (w: number) => {
    setNotice(null);
    if (weekdays.includes(w)) setWeekdays(weekdays.filter((x) => x !== w));
    else if (weekdays.length < daysPerWeek) setWeekdays([...weekdays, w].sort((a, b) => a - b));
    else setNotice(`Du hast ${daysPerWeek} Tage gewählt. Entferne zuerst einen anderen Tag.`);
  };

  const save = async () => {
    setSaving(true);
    try {
      await patchProfile({ goal, daysPerWeek, sessionMinutes: minutes, location, equipment, focusMuscles: focus });
      const plan = buildCustomPlan(days, new Date());
      await savePlan({ ...plan, name: `${SPLIT_LABELS[chosenSplit]} · ${days.length}× pro Woche`, split: SPLIT_LABELS[chosenSplit] });
      router.replace('/training');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      {notice ? <AppText tone="warning" accessibilityRole="alert">{notice}</AppText> : null}
      <View style={styles.footerRow}>
        {step > 0 ? <Button label="Zurück" variant="secondary" onPress={() => goTo(step - 1)} style={styles.flex} /> : null}
        {step < 5 ? (
          <Button label="Weiter" onPress={() => goTo(step + 1)} style={styles.flex} />
        ) : (
          <Button label="Plan speichern" icon={Check} loading={saving} onPress={save} style={styles.flex} />
        )}
      </View>
    </View>
  );

  return (
    <Screen edges={['bottom']} footer={footer}>
      <View style={styles.progress}>
        <AppText variant="caption" tone="accent">SCHRITT {step + 1} VON {STEPS.length}</AppText>
        <AppText variant="title" accessibilityRole="header">{STEPS[step]}</AppText>
        <ProgressBar value={(step + 1) / STEPS.length} accessibilityLabel={`Schritt ${step + 1} von ${STEPS.length}`} />
      </View>

      {step === 0 ? (
        <View style={styles.gap} accessibilityRole="radiogroup">
          {GOALS.map((g) => (
            <Option key={g} title={goalLabels[g]} hint={GOAL_HINTS[g]} selected={goal === g} onPress={() => setGoal(g)} />
          ))}
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.section}>
          <Field title="Wie oft pro Woche?" hint="Mindestens ein Ruhetag bleibt frei.">
            {[2, 3, 4, 5, 6].map((n) => <Chip key={n} role="radio" label={`${n} Tage`} selected={daysPerWeek === n} onPress={() => changeDays(n)} />)}
          </Field>
          <Field title="Wie lange pro Einheit?" hint="Inklusive Aufwärmen.">
            {[30, 45, 60, 75, 90].map((n) => <Chip key={n} role="radio" label={`${n} min`} selected={minutes === n} onPress={() => setMinutes(n)} />)}
          </Field>
          <Field title="Wo trainierst du?">
            {(Object.keys(locationLabels) as TrainingLocation[]).map((l) => (
              <Chip key={l} role="radio" label={locationLabels[l]} selected={location === l} onPress={() => { setLocation(l); setEquipment(LOCATION_EQUIPMENT[l]); }} />
            ))}
          </Field>
          <Field title="Welche Geräte hast du?" hint="Nur Übungen mit dieser Ausstattung werden vorgeschlagen.">
            {equipmentValues.map((e) => (
              <Chip key={e} role="checkbox" label={equipmentLabels[e]} selected={equipment.includes(e)} onPress={() => setEquipment(equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e])} />
            ))}
          </Field>
          <Field title="Besonders berücksichtigen (optional)" hint="Bis zu 4 Muskelgruppen, die im Plan sicher direkt vorkommen sollen.">
            {FOCUS_CHOICES.map((m) => (
              <Chip
                key={m}
                role="checkbox"
                label={MUSCLE_LABELS[m]}
                selected={focus.includes(m)}
                onPress={() => setFocus(focus.includes(m) ? focus.filter((x) => x !== m) : focus.length < 4 ? [...focus, m] : focus)}
              />
            ))}
          </Field>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.section}>
          <AppText tone="secondary">Passend zu {daysPerWeek} Trainingstagen{profile.experience === 'beginner' && daysPerWeek > 3 ? ' und deiner Erfahrung' : ''}:</AppText>
          <View style={styles.gap} accessibilityRole="radiogroup">
            {options.map((o) => (
              <Option key={o.id} title={o.label} badge={o.recommended ? 'Empfohlen' : undefined} hint={o.description} selected={chosenSplit === o.id} onPress={() => setSplit(o.id)} />
            ))}
          </View>
          <Field title="An welchen Tagen?" hint={`${weekdays.length} von ${daysPerWeek} gewählt. Ruhetage dazwischen helfen bei der Erholung.`}>
            {WEEKDAYS_SHORT.map((label, w) => (
              <Chip key={label} role="checkbox" label={label} selected={weekdays.includes(w)} onPress={() => toggleWeekday(w)} />
            ))}
          </Field>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.section}>
          <AppText tone="secondary">
            {chosenSplit === 'custom'
              ? 'Wähle für jeden Tag einen Schwerpunkt oder füge Übungen selbst hinzu.'
              : 'Vorschlag aus deinen Angaben. Tippe auf eine Übung für Details. Du kannst Übungen hinzufügen, entfernen, austauschen und sortieren.'}
          </AppText>
          <PlanDaysEditor days={days} onChange={setDays} profile={draft} selected={selected} onSelect={setSelected} onNotice={setNotice} />
        </View>
      ) : null}

      {step === 4 ? <Review days={days} minutes={minutes} /> : null}

      {step === 5 ? (
        <Card style={styles.gap}>
          <CircleCheck size={32} color={colors.accent} />
          <AppText variant="heading">{SPLIT_LABELS[chosenSplit]} · {days.length}× pro Woche</AppText>
          <AppText tone="secondary">
            {goalLabels[goal]} · {days.map((d) => WEEKDAYS_SHORT[d.weekday]).join(', ')} · {days.reduce((n, d) => n + d.exercises.length, 0)} Übungen
          </AppText>
          <AppText variant="small" tone="secondary">
            Mit „Plan speichern“ wird der Plan dauerhaft gespeichert und ersetzt einen bisherigen Plan. Deine Angaben zu Ziel, Zeit und Ausstattung werden im Profil übernommen. Bereits absolvierte Trainings bleiben unverändert.
          </AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

function Review({ days, minutes }: { days: PlanDay[]; minutes: number }) {
  const sets = useMemo(() => plannedMuscleSets({ days }), [days]);
  const load = useMemo(() => planMuscleLoad({ days }), [days]);
  const trained = MUSCLES.filter((m) => sets[m].direct > 0).sort((a, b) => sets[b].direct - sets[a].direct);
  const untouched = MUSCLES.filter((m) => sets[m].direct === 0 && sets[m].indirect === 0);
  return (
    <View style={styles.section}>
      {days.map((d) => {
        const mins = estimateDayMinutes(d);
        return (
          <Card key={d.weekday} style={styles.gapSm}>
            <View style={styles.rowBetween}>
              <AppText variant="heading" style={styles.flex}>{WEEKDAYS_SHORT[d.weekday]} · {d.name}</AppText>
              <AppText variant="small" tone={mins > minutes + 10 ? 'warning' : 'secondary'}>ca. {mins} min</AppText>
            </View>
            {d.exercises.map((pe, i) => (
              <View key={`${pe.exerciseId}-${i}`} style={styles.rowBetween}>
                <AppText style={styles.flex} numberOfLines={1}>{getExercise(pe.exerciseId)?.name ?? pe.exerciseId}</AppText>
                <AppText variant="small" tone="secondary">{prescriptionText(pe)} · {pe.restSec} s Pause</AppText>
              </View>
            ))}
          </Card>
        );
      })}
      <AppText variant="heading" accessibilityRole="header">Beanspruchte Muskeln</AppText>
      <Card style={styles.gap}>
        <BodyMap load={load} size={190} />
        <AppText variant="bodyStrong">Direkte Sätze pro Woche</AppText>
        {trained.map((m) => (
          <View key={m} style={styles.rowBetween}>
            <AppText style={styles.flex}>{MUSCLE_LABELS[m]}</AppText>
            <AppText variant="small" tone="secondary">{sets[m].direct} direkt{sets[m].indirect ? ` · ${sets[m].indirect} indirekt` : ''}</AppText>
          </View>
        ))}
        {untouched.length ? <AppText variant="small" tone="secondary">Nicht beansprucht: {untouched.map((m) => MUSCLE_LABELS[m]).join(', ')}</AppText> : null}
        <AppText variant="small" tone="secondary">Indirekte Beteiligung zählt nicht als direkter Satz.</AppText>
      </Card>
      <AppText variant="small" tone="secondary">Trainingstage: {days.map((d) => WEEKDAYS_LONG[d.weekday]).join(', ')}</AppText>
    </View>
  );
}

function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.gapSm}>
      <AppText variant="bodyStrong">{title}</AppText>
      {hint ? <AppText variant="small" tone="secondary">{hint}</AppText> : null}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Option({ title, hint, badge, selected, onPress }: { title: string; hint: string; badge?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[styles.option, selected && styles.optionOn]}>
      <View style={styles.flex}>
        <View style={styles.inline}>
          <AppText variant="bodyStrong">{title}</AppText>
          {badge ? <View style={styles.badge}><AppText variant="caption" tone="onAccent">{badge}</AppText></View> : null}
        </View>
        <AppText variant="small" tone="secondary">{hint}</AppText>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progress: { gap: spacing.sm },
  section: { gap: spacing.lg },
  gap: { gap: spacing.md },
  gapSm: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, minHeight: MIN_TOUCH },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong },
  radioOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  badge: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
