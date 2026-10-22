import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText, Card, Chip, Screen } from '@/components';
import { loadStepFor, LOAD_TYPE_LABELS } from '@/domain/training';
import type { LoadType } from '@/domain/types';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

const REST_OPTIONS: (number | null)[] = [null, 60, 90, 120, 180];
const STEP_OPTIONS: Record<Exclude<LoadType, 'bodyweight'>, number[]> = {
  barbell: [1, 2.5, 5],
  dumbbell: [1, 2, 2.5],
  machine: [2.5, 5, 10],
  kettlebell: [2, 4, 8],
};

export default function Settings() {
  const app = useApp();
  const { settings } = app;
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Card padded={false}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText>Haptisches Feedback</AppText>
            <AppText variant="small" tone="secondary">Vibration bei Satzabschluss und Pausenende</AppText>
          </View>
          <Switch
            value={settings.hapticsEnabled}
            onValueChange={(v) => run(() => app.updateSettings({ hapticsEnabled: v }))}
            trackColor={{ true: colors.accent, false: colors.cardSecondary }}
            thumbColor={colors.text}
            accessibilityLabel="Haptisches Feedback"
          />
        </View>
        <View style={[styles.rowStack, styles.divider]}>
          <AppText>Pausenzeit</AppText>
          <AppText variant="small" tone="secondary">„Plan“ nutzt die empfohlene Pause jeder Übung.</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {REST_OPTIONS.map((r) => (
              <Chip
                key={String(r)}
                role="radio"
                label={r === null ? 'Plan' : `${r} s`}
                selected={settings.defaultRestSeconds === r}
                onPress={() => run(() => app.updateSettings({ defaultRestSeconds: r }))}
              />
            ))}
          </View>
        </View>
        <View style={[styles.rowStack, styles.divider]}>
          <AppText>Gewichtsstufen</AppText>
          <AppText variant="small" tone="secondary">Kleinster Schritt, um den du das Gewicht an deinen Geräten erhöhen kannst. Danach richten sich Empfehlungen und die Plus/Minus-Tasten.</AppText>
          {(Object.keys(STEP_OPTIONS) as (keyof typeof STEP_OPTIONS)[]).map((type) => (
            <View key={type} style={styles.stepRow}>
              <AppText variant="small" style={styles.stepLabel}>{LOAD_TYPE_LABELS[type]}</AppText>
              <View style={styles.chipsInline} accessibilityRole="radiogroup" accessibilityLabel={`Gewichtsstufe ${LOAD_TYPE_LABELS[type]}`}>
                {STEP_OPTIONS[type].map((v) => (
                  <Chip
                    key={v}
                    role="radio"
                    label={`${v.toLocaleString('de-DE')} kg`}
                    selected={loadStepFor(type, settings) === v}
                    onPress={() => run(() => app.updateSettings({ loadSteps: { ...settings.loadSteps, [type]: v } }))}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </Card>

      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 52 },
  rowStack: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  stepRow: { gap: spacing.xs, marginTop: spacing.xs },
  stepLabel: { fontWeight: '600' },
  chipsInline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
