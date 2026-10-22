import { ChevronRight, Clock, Dumbbell, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { WEEKDAYS_LONG } from '@/domain/dates';
import { estimateDayMinutes } from '@/domain/planGenerator';
import type { PlanDay } from '@/domain/types';
import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

export interface WorkoutCardProps {
  day: PlanDay;
  subtitle?: string;
  done?: boolean;
  highlight?: boolean;
  onPress?: () => void;
  onStart?: () => void;
  startLabel?: string;
}

export function WorkoutCard({ day, subtitle, done, highlight, onPress, onStart, startLabel = 'Training starten' }: WorkoutCardProps) {
  const minutes = estimateDayMinutes(day);
  return (
    <Card variant={highlight ? 'highlight' : 'default'} style={styles.card}>
      {/* Nur der Kopfbereich ist antippbar, damit keine Buttons ineinander verschachtelt sind. */}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${day.name}, ${subtitle ?? WEEKDAYS_LONG[day.weekday]}, etwa ${minutes} Minuten, ${day.exercises.length} Übungen${done ? ', erledigt' : ''}`}
        accessibilityHint={onPress ? 'Zeigt die Übungen dieser Einheit' : undefined}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.8 }]}>
        <View style={styles.flex}>
          <AppText variant="caption" tone={highlight ? 'accent' : 'secondary'}>{(subtitle ?? WEEKDAYS_LONG[day.weekday]).toUpperCase()}</AppText>
          <AppText variant="heading">{day.name}</AppText>
          <AppText variant="small" tone="secondary">{day.focus}</AppText>
        </View>
        {done ? (
          <View style={styles.done}><AppText variant="caption" tone="accent">ERLEDIGT</AppText></View>
        ) : null}
        {onPress ? <ChevronRight size={20} color={colors.textSecondary} /> : null}
      </Pressable>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Clock size={16} color={colors.textSecondary} />
          <AppText variant="small" tone="secondary">ca. {minutes} min</AppText>
        </View>
        <View style={styles.metaItem}>
          <Dumbbell size={16} color={colors.textSecondary} />
          <AppText variant="small" tone="secondary">{day.exercises.length} Übungen</AppText>
        </View>
      </View>
      {onStart ? <Button label={startLabel} icon={Play} onPress={onStart} fullWidth /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  done: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.accentMuted },
  meta: { flexDirection: 'row', gap: spacing.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
