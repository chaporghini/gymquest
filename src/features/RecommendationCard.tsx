import { ChevronRight, CircleAlert, Minus, Search, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components';
import { fmt, formatRir, LOAD_STATUS_LABELS, LOAD_TYPE_LABELS, type ExerciseRecommendation, type LoadStatus } from '@/domain/training';
import { colors, radius, spacing } from '@/theme/tokens';

const STATUS_STYLE: Record<LoadStatus, { icon: typeof Minus; color: string; bg: string }> = {
  find: { icon: Search, color: colors.text, bg: colors.cardSecondary },
  hold: { icon: Minus, color: colors.text, bg: colors.cardSecondary },
  increase: { icon: TrendingUp, color: colors.accent, bg: colors.accentMuted },
  decrease: { icon: TrendingDown, color: colors.warning, bg: colors.warningMuted },
  pause: { icon: CircleAlert, color: colors.error, bg: colors.errorMuted },
};

function targetText(r: ExerciseRecommendation): string {
  const reps = r.targetDurationSec ? `${r.targetDurationSec} s` : r.targetRepMin === r.targetRepMax ? `${r.targetRepMax} Wdh.` : `${r.targetRepMin}–${r.targetRepMax} Wdh.`;
  return `${r.targetSets} × ${reps}`;
}

/** Empfehlung für eine Übung: Status, Ziel, Pause, Reserve, Gewicht und Begründung. */
export function RecommendationCard({ recommendation: r, compact = false }: { recommendation: ExerciseRecommendation; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const s = STATUS_STYLE[r.status];
  const Icon = s.icon;
  const load = r.suggestedLoadKg != null ? `${fmt(r.suggestedLoadKg)} kg` : r.loadType === 'bodyweight' ? 'Körpergewicht' : r.status === 'pause' ? '–' : 'ermitteln';

  return (
    <View style={[styles.wrap, { backgroundColor: s.bg }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Empfehlung: ${LOAD_STATUS_LABELS[r.status]}. ${r.headline}`}
        style={styles.head}>
        <Icon size={18} color={s.color} />
        <View style={styles.flex}>
          <AppText variant="caption" style={{ color: s.color }}>{LOAD_STATUS_LABELS[r.status].toUpperCase()}</AppText>
          <AppText variant="small">{r.headline}</AppText>
        </View>
        <ChevronRight size={18} color={colors.textSecondary} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
      </Pressable>
      <View style={styles.facts}>
        <Fact label="Ziel" value={targetText(r)} />
        <Fact label="Gewicht" value={load} />
        <Fact label="Pause" value={`${r.restSeconds[0]}–${r.restSeconds[1]} s`} />
        <Fact label="Reserve" value={`${formatRir(r.targetRepsInReserve)} Wdh.`} />
      </View>
      {open ? (
        <View style={styles.details}>
          {r.reasoning.map((t, i) => <AppText key={`r${i}`} variant="small">{t}</AppText>)}
          {r.hints.map((t, i) => <AppText key={`h${i}`} variant="small" tone="secondary">• {t}</AppText>)}
          {r.loadType !== 'bodyweight' ? (
            <AppText variant="caption" tone="secondary">
              {LOAD_TYPE_LABELS[r.loadType]}: Steigerung in {fmt(r.loadStepKg)}-kg-Schritten (im Profil unter Gewichtsstufen änderbar). Du kannst das Gewicht jederzeit selbst anpassen.
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption" tone="secondary">{label.toUpperCase()}</AppText>
      <AppText variant="small" style={styles.bold}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  flex: { flex: 1, gap: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fact: { minWidth: 70, gap: 2 },
  details: { gap: spacing.xs },
  bold: { fontWeight: '700' },
});
