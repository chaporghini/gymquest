import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, Plus, Repeat, Sparkles, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, Chip, prescriptionText, Screen } from '@/components';
import { EXERCISES, getExercise } from '@/data/exercises';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/domain/dates';
import { dayMuscleLoad, MUSCLE_LABELS, musclesOf, planMuscleLoad, suggestForMissing } from '@/domain/muscles';
import {
  addExercise,
  applyFocus,
  buildCustomPlan,
  MAX_TRAINING_DAYS,
  moveExercise,
  removeExercise,
  swapExercise,
  toggleWeekday,
  updateDay,
  validateDraft,
} from '@/domain/planBuilder';
import { DAY_FOCUS_LABELS, estimateDayMinutes, isExerciseAllowed, type DayFocus } from '@/domain/planGenerator';
import type { PlanDay } from '@/domain/types';
import { AddExerciseAssistant } from '@/features/AddExerciseAssistant';
import { BodyMap } from '@/features/BodyMap';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const FOCUS_ORDER: DayFocus[] = ['full', 'upper', 'lower', 'push', 'pull', 'legs', 'mobility'];

/** Eigenen Plan zusammenstellen: Tage wählen, Vorschlag übernehmen, Übungen anpassen. */
export default function PlanBuilder() {
  const { plan, profile, savePlan } = useApp();
  const params = useLocalSearchParams<{ day?: string }>();
  const [days, setDays] = useState<PlanDay[]>(() => plan?.days.map((d) => ({ ...d })) ?? []);
  const [selected, setSelected] = useState<number | null>(() => {
    const wanted = Number(params.day);
    if (plan?.days.some((d) => d.weekday === wanted)) return wanted;
    return plan?.days.slice().sort((a, b) => a.weekday - b.weekday)[0]?.weekday ?? null;
  });
  const [mapScope, setMapScope] = useState<'day' | 'week'>('day');
  const [picker, setPicker] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const day = days.find((d) => d.weekday === selected) ?? null;
  const weekLoad = useMemo(() => planMuscleLoad({ days }), [days]);
  const dayLoad = useMemo(() => (day ? dayMuscleLoad(day) : weekLoad), [day, weekLoad]);
  const missing = useMemo(
    () => (profile ? suggestForMissing(weekLoad, EXERCISES, (e) => isExerciseAllowed(e, profile), new Set(day?.exercises.map((e) => e.exerciseId) ?? [])) : []),
    [weekLoad, profile, day],
  );

  if (!profile) return null;

  const change = (next: PlanDay[] | null, failMessage?: string) => {
    setNotice(next ? null : failMessage ?? null);
    if (next) setDays(next);
  };

  const toggle = (w: number) => {
    const isOn = days.some((d) => d.weekday === w);
    if (!isOn && days.length >= MAX_TRAINING_DAYS) return setNotice('Höchstens 6 Trainingstage, ein Ruhetag bleibt frei.');
    const next = toggleWeekday(days, w, profile, EXERCISES);
    change(next);
    setSelected(isOn ? (next[0]?.weekday ?? null) : w);
  };

  const save = async () => {
    const problem = validateDraft(days);
    if (problem) return setNotice(problem);
    setSaving(true);
    try {
      await savePlan(buildCustomPlan(days, new Date()));
      if (router.canGoBack()) router.back();
      else router.replace('/training');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.footer}>
          {notice ? <AppText tone="warning" accessibilityRole="alert">{notice}</AppText> : null}
          <Button label="Plan speichern" size="lg" fullWidth loading={saving} onPress={save} />
        </View>
      }>
      <Step n={1} title="Trainingstage wählen" />
      <View style={styles.weekdays}>
        {WEEKDAYS_SHORT.map((label, w) => {
          const on = days.some((d) => d.weekday === w);
          return (
            <Pressable
              key={label}
              onPress={() => toggle(w)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={WEEKDAYS_LONG[w]}
              style={[styles.wd, on && styles.wdOn]}>
              <AppText variant="bodyStrong" tone={on ? 'onAccent' : 'secondary'}>{label}</AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="small" tone="secondary">
        {days.length === 0 ? 'Tippe auf die Tage, an denen du trainieren willst. Wir schlagen passende Übungen vor.' : `${days.length} Trainingstage · ${7 - days.length} Ruhetage`}
      </AppText>

      {days.length > 0 ? (
        <>
          <Step n={2} title="Tag anpassen" />
          <View style={styles.chips} accessibilityRole="radiogroup">
            {days.map((d) => (
              <Chip key={d.weekday} role="radio" label={`${WEEKDAYS_SHORT[d.weekday]} · ${d.name}`} selected={d.weekday === selected} onPress={() => setSelected(d.weekday)} />
            ))}
          </View>

          {day ? (
            <Card style={styles.dayCard}>
              <TextInput
                value={day.name}
                onChangeText={(t) => setDays(updateDay(days, day.weekday, { name: t.slice(0, 30) }))}
                accessibilityLabel="Name der Einheit"
                placeholder="Name der Einheit"
                placeholderTextColor={colors.textSecondary}
                style={styles.nameInput}
              />
              <AppText variant="small" tone="secondary">{WEEKDAYS_LONG[day.weekday]} · {day.exercises.length} Übungen · ca. {estimateDayMinutes(day)} min</AppText>

              <View style={styles.suggest}>
                <View style={styles.inline}>
                  <Sparkles size={16} color={colors.accent} />
                  <AppText variant="small" tone="secondary">Vorschlag laden:</AppText>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.chipsRow}>
                  {FOCUS_ORDER.map((f) => (
                    <Chip key={f} label={DAY_FOCUS_LABELS[f]} selected={day.focus === DAY_FOCUS_LABELS[f]} onPress={() => change(applyFocus(days, day.weekday, f, profile, EXERCISES))} />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.list}>
                {day.exercises.length === 0 ? <AppText tone="secondary">Noch keine Übungen. Lade einen Vorschlag oder füge Übungen hinzu.</AppText> : null}
                {day.exercises.map((pe, i) => {
                  const ex = getExercise(pe.exerciseId);
                  return (
                    <View key={`${pe.exerciseId}-${i}`} style={[styles.row, i > 0 && styles.divider]}>
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong" numberOfLines={1}>{ex?.name ?? pe.exerciseId}</AppText>
                        <AppText variant="small" tone="secondary" numberOfLines={1}>
                          {prescriptionText(pe)} · {musclesOf(pe.exerciseId).primary.map((m) => MUSCLE_LABELS[m]).join(', ') || 'Mobilität'}
                        </AppText>
                      </View>
                      <IconBtn label="Nach oben" onPress={() => change(moveExercise(days, day.weekday, i, -1))} disabled={i === 0}><ArrowUp size={16} color={colors.textSecondary} /></IconBtn>
                      <IconBtn label="Nach unten" onPress={() => change(moveExercise(days, day.weekday, i, 1))} disabled={i === day.exercises.length - 1}><ArrowDown size={16} color={colors.textSecondary} /></IconBtn>
                      <IconBtn label={`${ex?.name ?? 'Übung'} tauschen`} onPress={() => change(swapExercise(days, day.weekday, i, profile, EXERCISES), 'Keine passende Alternative mit deinem Equipment.')}><Repeat size={16} color={colors.textSecondary} /></IconBtn>
                      <IconBtn label={`${ex?.name ?? 'Übung'} entfernen`} onPress={() => change(removeExercise(days, day.weekday, i))}><X size={18} color={colors.error} /></IconBtn>
                    </View>
                  );
                })}
              </View>
              <Button label="Neue Übung" icon={Plus} variant="secondary" onPress={() => setPicker(true)} />
            </Card>
          ) : null}

          <Step n={3} title="Muskeln prüfen" />
          <Card style={styles.mapCard}>
            <View style={styles.chips} accessibilityRole="radiogroup">
              <Chip role="radio" label={day ? `${WEEKDAYS_SHORT[day.weekday]} · ${day.name}` : 'Tag'} selected={mapScope === 'day'} onPress={() => setMapScope('day')} />
              <Chip role="radio" label="Ganze Woche" selected={mapScope === 'week'} onPress={() => setMapScope('week')} />
            </View>
            <BodyMap load={mapScope === 'day' ? dayLoad : weekLoad} />
          </Card>

          {missing.length > 0 && day ? (
            <Card variant="secondary" style={styles.missing}>
              <AppText variant="bodyStrong">Noch grün in deiner Woche</AppText>
              <AppText variant="small" tone="secondary">Diese Übungen würden fehlende Muskeln trainieren. Tippen fügt sie zu {day.name} hinzu.</AppText>
              {missing.map(({ exercise, covers }) => (
                <Pressable
                  key={exercise.id}
                  onPress={() => change(addExercise(days, day.weekday, exercise, profile))}
                  accessibilityRole="button"
                  accessibilityLabel={`${exercise.name} hinzufügen`}
                  style={styles.missingRow}>
                  <Plus size={18} color={colors.accent} />
                  <View style={styles.flex}>
                    <AppText>{exercise.name}</AppText>
                    <AppText variant="caption" tone="secondary">{covers.map((m) => MUSCLE_LABELS[m]).join(', ')}</AppText>
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {day ? (
        <AddExerciseAssistant
          visible={picker}
          day={day}
          allDays={days}
          profile={profile}
          onClose={() => setPicker(false)}
          onAdd={(e) => setDays((current) => addExercise(current, day.weekday, e, profile))}
        />
      ) : null}
    </Screen>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNo}><AppText variant="small" tone="onAccent" style={styles.bold}>{n}</AppText></View>
      <AppText variant="heading" accessibilityRole="header">{title}</AppText>
    </View>
  );
}

function IconBtn({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={[styles.iconBtn, disabled && styles.disabled]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  weekdays: { flexDirection: 'row', gap: 6 },
  wd: { flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  wdOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipsRow: { flexDirection: 'row', gap: spacing.sm },
  noGrow: { flexGrow: 0 },
  dayCard: { gap: spacing.md },
  nameInput: { ...typography.heading, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.xs },
  suggest: { gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  list: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  flex: { flex: 1, gap: 2 },
  iconBtn: { width: 34, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.25 },
  mapCard: { gap: spacing.md, alignItems: 'center' },
  missing: { gap: spacing.sm },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { height: '85%', backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', alignItems: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { ...typography.body, color: colors.text, flex: 1, minHeight: 46 },
  pickList: { gap: 0, paddingBottom: spacing.xxl },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
});
