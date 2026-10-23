import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Repeat, Sparkles, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, Chip, prescriptionText } from '@/components';
import { EXERCISES, getExercise } from '@/data/exercises';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/domain/dates';
import { MUSCLE_LABELS, musclesOf, planMuscleLoad, suggestForMissing } from '@/domain/muscles';
import { addExercise, applyFocus, moveExercise, removeExercise, swapExercise, updateDay } from '@/domain/planBuilder';
import { DAY_FOCUS_LABELS, estimateDayMinutes, isExerciseAllowed, type DayFocus } from '@/domain/planGenerator';
import type { PlanDay, PlannedExercise, Profile } from '@/domain/types';
import { difficultyLabels, equipmentLabels } from '@/i18n/labels';
import { colors, MIN_TOUCH, spacing, typography } from '@/theme/tokens';

import { AddExerciseAssistant } from './AddExerciseAssistant';

const FOCUS_ORDER: DayFocus[] = ['full', 'upper', 'lower', 'push', 'pull', 'legs', 'mobility'];

/**
 * Übungen der Trainingstage bearbeiten: hinzufügen, entfernen, austauschen, sortieren, Schwerpunkt laden.
 * Wird im Plan-Ersteller und beim Bearbeiten eines bestehenden Plans verwendet.
 */
export function PlanDaysEditor({
  days,
  onChange,
  profile,
  selected,
  onSelect,
  onNotice,
}: {
  days: PlanDay[];
  onChange: (days: PlanDay[]) => void;
  profile: Profile;
  selected: number | null;
  onSelect: (weekday: number) => void;
  onNotice: (message: string | null) => void;
}) {
  const [picker, setPicker] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const day = days.find((d) => d.weekday === selected) ?? null;
  const weekLoad = useMemo(() => planMuscleLoad({ days }), [days]);
  const missing = useMemo(
    () => suggestForMissing(weekLoad, EXERCISES, (e) => isExerciseAllowed(e, profile), new Set(day?.exercises.map((e) => e.exerciseId) ?? [])),
    [weekLoad, profile, day],
  );

  const change = (next: PlanDay[] | null, failMessage?: string) => {
    onNotice(next ? null : failMessage ?? null);
    if (next) onChange(next);
  };

  return (
    <>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {days.map((d) => (
          <Chip key={d.weekday} role="radio" label={`${WEEKDAYS_SHORT[d.weekday]} · ${d.name}`} selected={d.weekday === selected} onPress={() => onSelect(d.weekday)} />
        ))}
      </View>

      {day ? (
        <Card style={styles.dayCard}>
          <TextInput
            value={day.name}
            onChangeText={(t) => onChange(updateDay(days, day.weekday, { name: t.slice(0, 30) }))}
            accessibilityLabel="Name der Einheit"
            placeholder="Name der Einheit"
            placeholderTextColor={colors.textSecondary}
            style={styles.nameInput}
          />
          <AppText variant="small" tone="secondary">{WEEKDAYS_LONG[day.weekday]} · {day.exercises.length} Übungen · ca. {estimateDayMinutes(day)} min</AppText>

          <View style={styles.suggest}>
            <View style={styles.inline}>
              <Sparkles size={16} color={colors.accent} />
              <AppText variant="small" tone="secondary">Schwerpunkt laden:</AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.chipsRow}>
              {FOCUS_ORDER.map((f) => (
                <Chip key={f} label={DAY_FOCUS_LABELS[f]} selected={day.focus === DAY_FOCUS_LABELS[f]} onPress={() => change(applyFocus(days, day.weekday, f, profile, EXERCISES))} />
              ))}
            </ScrollView>
          </View>

          <View>
            {day.exercises.length === 0 ? <AppText tone="secondary">Noch keine Übungen. Lade einen Schwerpunkt oder füge Übungen hinzu.</AppText> : null}
            {day.exercises.map((pe, i) => {
              const ex = getExercise(pe.exerciseId);
              const key = `${day.weekday}-${pe.exerciseId}`;
              const isOpen = open === key;
              return (
                <View key={`${pe.exerciseId}-${i}`} style={[styles.item, i > 0 && styles.divider]}>
                  <View style={styles.row}>
                    <Pressable
                      onPress={() => setOpen(isOpen ? null : key)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      accessibilityLabel={`${ex?.name ?? pe.exerciseId}, Details ${isOpen ? 'ausblenden' : 'anzeigen'}`}
                      style={styles.flex}>
                      <View style={styles.inline}>
                        <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>{ex?.name ?? pe.exerciseId}</AppText>
                        {isOpen ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
                      </View>
                      <AppText variant="small" tone="secondary" numberOfLines={1}>
                        {prescriptionText(pe)} · {musclesOf(pe.exerciseId).primary.map((m) => MUSCLE_LABELS[m]).join(', ') || 'Mobilität'}
                      </AppText>
                    </Pressable>
                    <IconBtn label="Nach oben" onPress={() => change(moveExercise(days, day.weekday, i, -1))} disabled={i === 0}><ArrowUp size={16} color={colors.textSecondary} /></IconBtn>
                    <IconBtn label="Nach unten" onPress={() => change(moveExercise(days, day.weekday, i, 1))} disabled={i === day.exercises.length - 1}><ArrowDown size={16} color={colors.textSecondary} /></IconBtn>
                    <IconBtn label={`${ex?.name ?? 'Übung'} austauschen`} onPress={() => change(swapExercise(days, day.weekday, i, profile, EXERCISES), 'Keine passende Alternative mit deiner Ausstattung.')}><Repeat size={16} color={colors.textSecondary} /></IconBtn>
                    <IconBtn label={`${ex?.name ?? 'Übung'} entfernen`} onPress={() => change(removeExercise(days, day.weekday, i))}><X size={18} color={colors.error} /></IconBtn>
                  </View>
                  {isOpen && ex ? <ExerciseDetails planned={pe} /> : null}
                </View>
              );
            })}
          </View>
          <Button label="Neue Übung" icon={Plus} variant="secondary" onPress={() => setPicker(true)} />
        </Card>
      ) : null}

      {missing.length > 0 && day ? (
        <Card variant="secondary" style={styles.missing}>
          <AppText variant="bodyStrong">Noch grün in deiner Woche</AppText>
          <AppText variant="small" tone="secondary">Diese Übungen trainieren Muskeln, die in deinem Plan noch fehlen. Tippen fügt sie zu {day.name} hinzu.</AppText>
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

      {day ? (
        <AddExerciseAssistant
          visible={picker}
          day={day}
          allDays={days}
          profile={profile}
          onClose={() => setPicker(false)}
          onAdd={(e) => onChange(addExercise(days, day.weekday, e, profile))}
        />
      ) : null}
    </>
  );
}

/** Ausführliche Angaben zu einer geplanten Übung (Plan-Ersteller Schritt 4). */
export function ExerciseDetails({ planned }: { planned: PlannedExercise }) {
  const ex = getExercise(planned.exerciseId);
  if (!ex) return null;
  const { primary, secondary } = musclesOf(ex.id);
  const rows: [string, string][] = [
    ['Primär', primary.map((m) => MUSCLE_LABELS[m]).join(', ') || '–'],
    ['Sekundär', secondary.map((m) => MUSCLE_LABELS[m]).join(', ') || '–'],
    ['Geräte', ex.equipment.map((e) => equipmentLabels[e]).join(' oder ')],
    ['Schwierigkeit', difficultyLabels[ex.difficulty]],
    ['Vorschlag', prescriptionText(planned)],
    ['Pause', `${planned.restSec} s`],
  ];
  return (
    <View style={styles.details}>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.detailRow}>
          <AppText variant="small" tone="secondary" style={styles.detailKey}>{k}</AppText>
          <AppText variant="small" style={styles.flex}>{v}</AppText>
        </View>
      ))}
      <AppText variant="small" tone="secondary">{ex.description} {ex.steps[0]}</AppText>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipsRow: { flexDirection: 'row', gap: spacing.sm },
  noGrow: { flexGrow: 0 },
  dayCard: { gap: spacing.md },
  nameInput: { ...typography.heading, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.xs },
  suggest: { gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  shrink: { flexShrink: 1 },
  item: { paddingVertical: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  flex: { flex: 1, gap: 2 },
  iconBtn: { width: 34, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.25 },
  missing: { gap: spacing.sm },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  details: { gap: 4, backgroundColor: colors.cardSecondary, borderRadius: 10, padding: spacing.md },
  detailRow: { flexDirection: 'row', gap: spacing.sm },
  detailKey: { width: 96 },
});
