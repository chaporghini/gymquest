import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, ConfirmDialog, Screen } from '@/components';
import { EXERCISES } from '@/data/exercises';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/domain/dates';
import { dayMuscleLoad, planMuscleLoad } from '@/domain/muscles';
import { MAX_TRAINING_DAYS, toggleWeekday, validateDraft } from '@/domain/planBuilder';
import type { PlanDay } from '@/domain/types';
import { BodyMap } from '@/features/BodyMap';
import { PlanDaysEditor } from '@/features/PlanDaysEditor';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

/** Bestehenden Plan bearbeiten: Tage, Übungen, Muskeln prüfen. Vergangene Trainings bleiben unverändert. */
export default function PlanBuilder() {
  const { plan, profile, savePlan, deletePlan } = useApp();
  const params = useLocalSearchParams<{ day?: string }>();
  const [days, setDays] = useState<PlanDay[]>(() => plan?.days.map((d) => ({ ...d })) ?? []);
  const [selected, setSelected] = useState<number | null>(() => {
    const wanted = Number(params.day);
    if (plan?.days.some((d) => d.weekday === wanted)) return wanted;
    return plan?.days.slice().sort((a, b) => a.weekday - b.weekday)[0]?.weekday ?? null;
  });
  const [mapScope, setMapScope] = useState<'day' | 'week'>('day');
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const day = days.find((d) => d.weekday === selected) ?? null;
  const weekLoad = useMemo(() => planMuscleLoad({ days }), [days]);
  const dayLoad = useMemo(() => (day ? dayMuscleLoad(day) : weekLoad), [day, weekLoad]);

  if (!plan) return <Redirect href="/plan/create" />;
  if (!profile) return null;

  const toggle = (w: number) => {
    const isOn = days.some((d) => d.weekday === w);
    if (!isOn && days.length >= MAX_TRAINING_DAYS) return setNotice('Höchstens 6 Trainingstage, ein Ruhetag bleibt frei.');
    const next = toggleWeekday(days, w, profile, EXERCISES);
    setNotice(null);
    setDays(next);
    setSelected(isOn ? (next[0]?.weekday ?? null) : w);
  };

  const save = async () => {
    const problem = validateDraft(days);
    if (problem) return setNotice(problem);
    setSaving(true);
    try {
      const sorted = [...days].sort((a, b) => a.weekday - b.weekday).map((d, i) => ({ ...d, name: d.name.trim() || `Training ${i + 1}` }));
      await savePlan({ ...plan, days: sorted });
      if (router.canGoBack()) router.back();
      else router.replace('/training');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  };

  const remove = async () => {
    await deletePlan();
    setConfirmDelete(false);
    router.replace('/training');
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.footer}>
          {notice ? <AppText tone="warning" accessibilityRole="alert">{notice}</AppText> : null}
          <Button label="Änderungen speichern" size="lg" fullWidth loading={saving} onPress={save} />
        </View>
      }>
      <Step n={1} title="Trainingstage" />
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
      <AppText variant="small" tone="secondary">{days.length} Trainingstage · {7 - days.length} Ruhetage</AppText>

      {days.length > 0 ? (
        <>
          <Step n={2} title="Übungen anpassen" />
          <PlanDaysEditor days={days} onChange={setDays} profile={profile} selected={selected} onSelect={setSelected} onNotice={setNotice} />

          <Step n={3} title="Muskeln prüfen" />
          <Card style={styles.mapCard}>
            <View style={styles.chips} accessibilityRole="radiogroup">
              <Chip role="radio" label={day ? `${WEEKDAYS_SHORT[day.weekday]} · ${day.name}` : 'Tag'} selected={mapScope === 'day'} onPress={() => setMapScope('day')} />
              <Chip role="radio" label="Ganze Woche" selected={mapScope === 'week'} onPress={() => setMapScope('week')} />
            </View>
            <BodyMap load={mapScope === 'day' ? dayLoad : weekLoad} />
          </Card>
        </>
      ) : null}

      <AppText variant="small" tone="secondary">Änderungen gelten für kommende Trainings. Bereits absolvierte Trainings bleiben so gespeichert, wie du sie gemacht hast.</AppText>
      <Button label="Plan löschen" icon={Trash2} variant="ghost" onPress={() => setConfirmDelete(true)} />
      <Button label="Neuen Plan erstellen" variant="ghost" onPress={() => router.push('/plan/create')} />

      <ConfirmDialog
        visible={confirmDelete}
        title="Plan löschen?"
        message="Der aktuelle Trainingsplan wird entfernt. Deine bisherigen Trainings, XP und Statistiken bleiben erhalten."
        confirmLabel="Löschen"
        destructive
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
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

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  weekdays: { flexDirection: 'row', gap: 6 },
  wd: { flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  wdOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mapCard: { gap: spacing.md, alignItems: 'center' },
});
