import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, CircleAlert, Footprints, Sparkles, TrendingUp, Trophy } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Chip, Screen, SectionHeader } from '@/components';
import { addDays, formatDuration } from '@/domain/dates';
import {
  addMonths,
  analyzeMonthlyProgress,
  analyzeWeeklyProgress,
  fmt,
  type ExerciseChange,
  type Highlight,
  type MonthlySummary,
  type PersonalRecord,
  type WeeklySummary,
  type XpSummary,
} from '@/domain/training';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

type Mode = 'week' | 'month';

const dayMonth = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;

function weekLabel(w: WeeklySummary) {
  const start = new Date(w.periodStart);
  const last = addDays(new Date(w.periodEnd), -1);
  return `${dayMonth(start)} – ${dayMonth(last)}${last.getFullYear()}`;
}

const RESULT_TONE: Record<ExerciseChange['result'], 'accent' | 'secondary' | 'warning' | 'primary'> = {
  improved: 'accent',
  same: 'secondary',
  lower: 'warning',
  new: 'primary',
};

const RECORD_UNIT: Record<PersonalRecord['kind'], string> = { weight: 'kg', reps: 'Wdh.', duration: 's' };

/** „Dein Fortschritt“: Wochen- und Monatsbericht aus dem Analyse-Service. */
export default function ReportScreen() {
  const { trainingData } = useApp();
  const [mode, setMode] = useState<Mode>('week');
  const [offset, setOffset] = useState(0);
  const now = useMemo(() => new Date(), []);

  const week = useMemo(() => (mode === 'week' ? analyzeWeeklyProgress(trainingData, addDays(now, offset * 7), now) : null), [mode, offset, trainingData, now]);
  const month = useMemo(() => (mode === 'month' ? analyzeMonthlyProgress(trainingData, addMonths(now, offset), now) : null), [mode, offset, trainingData, now]);
  const switchMode = (m: Mode) => {
    setMode(m);
    setOffset(0);
  };

  const title = week ? (offset === 0 ? 'Diese Woche' : offset === -1 ? 'Letzte Woche' : weekLabel(week)) : month?.label ?? '';
  const subtitle = week ? weekLabel(week) : month?.comparison ? `Vergleich: ${month.comparison.label}${month.comparison.partial ? ' (gleicher Zeitraum)' : ''}` : 'Kein Vergleichsmonat mit Daten';
  const provisional = week?.provisional ?? month?.provisional ?? false;

  return (
    <Screen edges={['bottom']}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        <Chip role="radio" label="Woche" selected={mode === 'week'} onPress={() => switchMode('week')} />
        <Chip role="radio" label="Monat" selected={mode === 'month'} onPress={() => switchMode('month')} />
      </View>

      <View style={styles.periodRow}>
        <NavButton label={mode === 'week' ? 'Vorherige Woche' : 'Vorheriger Monat'} onPress={() => setOffset((o) => o - 1)} icon={ChevronLeft} />
        <View style={styles.periodText}>
          <AppText variant="title" accessibilityRole="header" align="center">{title}</AppText>
          <AppText variant="small" tone="secondary" align="center">{subtitle}</AppText>
        </View>
        <NavButton label={mode === 'week' ? 'Nächste Woche' : 'Nächster Monat'} onPress={() => setOffset((o) => Math.min(0, o + 1))} icon={ChevronRight} disabled={offset >= 0} />
      </View>
      {provisional ? (
        <View style={styles.provisional}>
          <AppText variant="small" tone="warning">
            Vorläufig: {mode === 'week' ? 'Die Woche' : 'Der Monat'} läuft noch. Die Werte zählen nur bis heute.
          </AppText>
        </View>
      ) : null}

      {week ? <WeekReport w={week} /> : null}
      {month ? <MonthReport m={month} /> : null}
    </Screen>
  );
}

function WeekReport({ w }: { w: WeeklySummary }) {
  const r = w.recovery;
  const efforts = [
    ['Leicht', r.effortCounts.easy],
    ['Passend', r.effortCounts.good],
    ['Schwer', r.effortCounts.hard],
    ['Am Limit', r.effortCounts.max],
  ].filter(([, n]) => (n as number) > 0);
  return (
    <>
      <Highlights items={w.highlights} />

      <SectionHeader title="Aktivität" />
      <Card style={styles.grid}>
        <Stat label="Trainings" value={`${w.completedWorkouts} / ${w.plannedWorkouts}`} hint={w.goalMet ? 'Wochenziel erreicht' : 'geplant laut Plan'} />
        <Stat label="Trainingszeit" value={formatDuration(w.totalDurationSeconds)} />
        <Stat label="Arbeitssätze" value={`${w.completedWorkingSets}`} />
        <Stat label="Muskelgruppen" value={w.muscleGroups.length ? w.muscleGroups.join(', ') : '–'} wide />
      </Card>

      <SectionHeader title="Leistung" />
      <Changes changes={w.exerciseChanges} empty="Diese Woche wurden noch keine Übungen protokolliert." compareHint="im Vergleich zur vorherigen Einheit derselben Übung" />
      <Records records={w.personalRecords} />
      <Plateaus items={w.plateaus} />

      <SectionHeader title="Erholung & Qualität" />
      <Card style={styles.list}>
        <Row label="Ruhetage" value={`${r.restDaysTaken} von ${r.daysConsidered} Tagen`} />
        <Row label="Geplante Ruhetage" value={`${r.plannedRestDays}`} />
        <Row label="Anstrengung" value={efforts.length ? efforts.map(([l, n]) => `${l} ${n}×`).join(' · ') : 'Nicht angegeben'} />
        <Row label="Tagesform (Ø)" value={r.averageReadiness != null ? `${fmt(r.averageReadiness)} von 5` : 'Nicht angegeben'} />
        {r.painReports.length ? <Warn text={`Beschwerden gemeldet bei: ${r.painReports.join(', ')}. Diese Übungen steigern wir vorerst nicht. Halten Beschwerden an, lass dich ärztlich oder physiotherapeutisch beraten.`} /> : null}
        {r.highLoadWarnings.map((t, i) => <Warn key={i} text={t} />)}
      </Card>

      <SectionHeader title="XP & Level" />
      <XpCard xp={w.xp} />

      <NextSteps steps={w.nextSteps} />
    </>
  );
}

function MonthReport({ m }: { m: MonthlySummary }) {
  const c = m.comparison;
  const delta = (cur: number, prev: number) => {
    const d = cur - prev;
    return d === 0 ? 'gleich' : `${d > 0 ? '+' : ''}${d}`;
  };
  return (
    <>
      <Highlights items={m.highlights} />

      <SectionHeader title="Aktivität" />
      <Card style={styles.grid}>
        <Stat label="Trainings" value={`${m.completedWorkouts}`} hint={c ? `Vorher: ${c.previousWorkouts} (${delta(m.completedWorkouts, c.previousWorkouts)})` : undefined} />
        <Stat label="Trainingstage" value={`${m.trainingDays}`} />
        <Stat label="Trainingszeit" value={formatDuration(m.totalDurationSeconds)} hint={c ? `Vorher: ${formatDuration(c.previousDurationSeconds)}` : undefined} />
        <Stat label="Ø pro Woche" value={fmt(m.averageWorkoutsPerWeek)} />
        <Stat label="Arbeitssätze" value={`${m.completedWorkingSets}`} hint={c ? `Vorher: ${c.previousSets}` : undefined} />
        <Stat label="Wochenziel erreicht" value={m.goalWeeks.total ? `${m.goalWeeks.met} von ${m.goalWeeks.total}` : '–'} hint={m.goalWeeks.total ? 'vollständige Wochen' : 'noch keine vollständige Woche'} />
      </Card>
      {c?.partial ? (
        <AppText variant="small" tone="secondary">Verglichen wird mit demselben Zeitraum im Vormonat ({c.label}), damit der Vergleich fair bleibt.</AppText>
      ) : null}

      <SectionHeader title="Leistung" />
      <Changes changes={m.exerciseDevelopments} empty="In diesem Monat wurden keine Übungen protokolliert." compareHint="erste gegenüber letzter Einheit im Monat" />
      <Records records={m.personalRecords} />
      <Plateaus items={m.plateaus} />

      <SectionHeader title="Persönliche Entwicklung" />
      <XpCard xp={m.xp} />
      <Card style={styles.list}>
        <Row label="Körpergewicht" value={m.body.weightStart != null && m.body.weightEnd != null ? (m.body.weightStart === m.body.weightEnd ? `${fmt(m.body.weightEnd)} kg` : `${fmt(m.body.weightStart)} → ${fmt(m.body.weightEnd)} kg`) : 'Keine Einträge'} />
        {m.body.heightChange ? <Row label="Größe" value={`${fmt(m.body.heightChange.from)} → ${fmt(m.body.heightChange.to)} cm`} /> : null}
        <AppText variant="caption" tone="secondary">Nur deine eigenen Einträge, ohne Bewertung.</AppText>
      </Card>

      <SectionHeader title="Analyse" />
      <Card style={styles.list}>
        {m.analysis.map((t, i) => <AppText key={i}>{t}</AppText>)}
      </Card>
    </>
  );
}

function Highlights({ items }: { items: Highlight[] }) {
  if (!items.length) return null;
  return (
    <Card variant="highlight" style={styles.list}>
      {items.map((h, i) => {
        const Icon = h.tone === 'positive' ? Sparkles : h.tone === 'warning' ? CircleAlert : Footprints;
        const color = h.tone === 'positive' ? colors.accent : h.tone === 'warning' ? colors.warning : colors.textSecondary;
        return (
          <View key={i} style={styles.inline}>
            <Icon size={18} color={color} />
            <AppText style={styles.flex}>{h.text}</AppText>
          </View>
        );
      })}
    </Card>
  );
}

function Changes({ changes, empty, compareHint }: { changes: ExerciseChange[]; empty: string; compareHint: string }) {
  if (!changes.length) return <Card variant="secondary"><AppText tone="secondary">{empty}</AppText></Card>;
  return (
    <Card style={styles.list}>
      <AppText variant="caption" tone="secondary">{compareHint.toUpperCase()}</AppText>
      {changes.map((c) => (
        <View key={c.exerciseId} style={styles.row}>
          <AppText style={styles.flex}>{c.name}</AppText>
          <AppText variant="small" tone={RESULT_TONE[c.result]} style={styles.right}>{c.text}</AppText>
        </View>
      ))}
    </Card>
  );
}

function Records({ records }: { records: (PersonalRecord & { name: string })[] }) {
  if (!records.length) return null;
  return (
    <Card style={styles.list}>
      <View style={styles.inline}>
        <Trophy size={18} color={colors.accent} />
        <AppText variant="bodyStrong">Neue Bestleistungen</AppText>
      </View>
      {records.map((r) => (
        <View key={`${r.exerciseId}-${r.kind}-${r.sessionId}`} style={styles.row}>
          <AppText style={styles.flex}>{r.name}</AppText>
          <AppText variant="small" tone="accent" style={styles.right}>{fmt(r.previous)} → {fmt(r.value)} {RECORD_UNIT[r.kind]}</AppText>
        </View>
      ))}
    </Card>
  );
}

function Plateaus({ items }: { items: { exerciseId: string; name: string; message: string }[] }) {
  if (!items.length) return null;
  return (
    <Card variant="secondary" style={styles.list}>
      {items.map((p) => (
        <View key={p.exerciseId} style={styles.list}>
          <AppText variant="bodyStrong">{p.name}</AppText>
          <AppText variant="small" tone="secondary">{p.message}</AppText>
        </View>
      ))}
    </Card>
  );
}

function XpCard({ xp }: { xp: XpSummary }) {
  return (
    <Card style={styles.list}>
      <Row label="Verdiente XP" value={`+${xp.earnedXp.toLocaleString('de-DE')}`} />
      <Row label="Level" value={xp.levelStart === xp.levelEnd ? `${xp.levelEnd}` : `${xp.levelStart} → ${xp.levelEnd}`} />
      {xp.ranksReached.length ? <Row label="Neuer Rang" value={xp.ranksReached.join(', ')} /> : null}
      {xp.questsCompleted.length ? <Row label="Quests" value={xp.questsCompleted.join(', ')} /> : null}
      {xp.achievementsUnlocked.length ? <Row label="Achievements" value={xp.achievementsUnlocked.join(', ')} /> : null}
    </Card>
  );
}

function NextSteps({ steps }: { steps: string[] }) {
  return (
    <>
      <SectionHeader title="Dein nächster Schritt" />
      <Card variant="highlight" style={styles.list}>
        {steps.map((t, i) => (
          <View key={i} style={styles.inline}>
            <TrendingUp size={18} color={colors.accent} />
            <AppText style={styles.flex}>{t}</AppText>
          </View>
        ))}
        <Pressable onPress={() => router.push('/training')} accessibilityRole="link" style={styles.link}>
          <AppText variant="small" tone="accent" style={styles.bold}>Zum Trainingsplan</AppText>
        </Pressable>
      </Card>
    </>
  );
}

function Stat({ label, value, hint, wide }: { label: string; value: string; hint?: string; wide?: boolean }) {
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <AppText variant="caption" tone="secondary">{label.toUpperCase()}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
      {hint ? <AppText variant="caption" tone="secondary">{hint}</AppText> : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="small" tone="secondary" style={styles.rowLabel}>{label}</AppText>
      <AppText style={[styles.flex, styles.rightText]}>{value}</AppText>
    </View>
  );
}

function Warn({ text }: { text: string }) {
  return (
    <View style={styles.inline}>
      <CircleAlert size={18} color={colors.warning} />
      <AppText variant="small" style={styles.flex}>{text}</AppText>
    </View>
  );
}

function NavButton({ label, onPress, icon: Icon, disabled }: { label: string; onPress: () => void; icon: typeof ChevronLeft; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} style={[styles.nav, disabled && styles.disabled]}>
      <Icon size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.sm },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  periodText: { flex: 1, gap: 2 },
  nav: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  provisional: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  stat: { width: '45%', gap: 2 },
  statWide: { width: '100%' },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowLabel: { width: 130 },
  right: { textAlign: 'right', maxWidth: '55%' },
  rightText: { textAlign: 'right' },
  inline: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center' },
});
