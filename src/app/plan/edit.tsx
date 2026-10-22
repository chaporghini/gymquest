import { router } from 'expo-router';
import { Pencil, Plus, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, ConfirmDialog, Screen } from '@/components';
import { createId, WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/domain/dates';
import { estimateDayMinutes } from '@/domain/planGenerator';
import type { TrainingPlan } from '@/domain/types';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function PlanEdit() {
  const { plan, savePlan } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);

  if (!plan) return null;

  const save = async (next: TrainingPlan) => {
    setError(null);
    try {
      await savePlan(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    }
  };

  const used = new Set(plan.days.map((d) => d.weekday));
  const sorted = [...plan.days].sort((a, b) => a.weekday - b.weekday);
  const canAdd = plan.days.length < 6;

  const addDay = () => {
    const free = [0, 1, 2, 3, 4, 5, 6].find((w) => !used.has(w));
    if (free === undefined) return;
    void save({ ...plan, days: [...plan.days, { id: createId('day'), name: 'Zusatzeinheit', weekday: free, focus: 'Eigene Übungen', exercises: [] }] });
  };

  const toRemove = plan.days.find((d) => d.id === removeId);

  return (
    <Screen edges={['bottom']}>
      <AppText tone="secondary">
        Lege fest, an welchen Tagen du trainierst. Mindestens ein Ruhetag pro Woche bleibt immer frei.
      </AppText>
      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}

      {sorted.map((day) => (
        <Card key={day.id} style={styles.card}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="heading">{day.name}</AppText>
              <AppText variant="small" tone="secondary">
                {WEEKDAYS_LONG[day.weekday]} · {day.exercises.length} Übungen · ca. {estimateDayMinutes(day)} min
              </AppText>
            </View>
          </View>
          <View style={styles.weekdays} accessibilityRole="radiogroup" accessibilityLabel={`Wochentag für ${day.name}`}>
            {WEEKDAYS_SHORT.map((label, w) => {
              const selected = day.weekday === w;
              const taken = used.has(w) && !selected;
              return (
                <Pressable
                  key={label}
                  disabled={taken}
                  onPress={() => save({ ...plan, days: plan.days.map((d) => (d.id === day.id ? { ...d, weekday: w } : d)) })}
                  accessibilityRole="radio"
                  accessibilityLabel={WEEKDAYS_LONG[w]}
                  accessibilityState={{ checked: selected, disabled: taken }}
                  style={[styles.wd, selected && styles.wdSelected, taken && styles.wdTaken]}>
                  <AppText variant="small" tone={selected ? 'onAccent' : 'primary'} style={styles.bold}>{label}</AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.row}>
            <Button label="Übungen bearbeiten" icon={Pencil} variant="secondary" size="sm" onPress={() => router.push({ pathname: '/plan/day/[dayId]', params: { dayId: day.id } })} style={styles.flex} />
            <Button label="Entfernen" icon={Trash} variant="danger" size="sm" onPress={() => setRemoveId(day.id)} disabled={plan.days.length <= 1} accessibilityLabel={`${day.name} entfernen`} />
          </View>
        </Card>
      ))}

      <Button label="Trainingstag hinzufügen" icon={Plus} variant="secondary" onPress={addDay} disabled={!canAdd} accessibilityHint={canAdd ? undefined : 'Maximal 6 Trainingstage, damit ein Ruhetag bleibt'} />

      <ConfirmDialog
        visible={!!toRemove}
        title="Einheit entfernen?"
        message={`„${toRemove?.name ?? ''}“ wird aus deinem Plan entfernt. Bereits absolvierte Trainings bleiben in der Historie.`}
        confirmLabel="Entfernen"
        destructive
        onConfirm={() => {
          if (toRemove) void save({ ...plan, days: plan.days.filter((d) => d.id !== toRemove.id) });
          setRemoveId(null);
        }}
        onCancel={() => setRemoveId(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  weekdays: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  wd: { minWidth: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.border, flexGrow: 1 },
  wdSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  wdTaken: { opacity: 0.3 },
  bold: { fontWeight: '700' },
});
