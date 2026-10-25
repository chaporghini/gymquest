import { router } from 'expo-router';
import { Lightbulb, TriangleAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, SectionHeader } from '@/components';
import { EXERCISES } from '@/data/exercises';
import { computeSuggestions, type Suggestion } from '@/domain/adaptations';
import { useApp } from '@/state/AppProvider';
import { useToday } from '@/state/useToday';
import { colors, spacing } from '@/theme/tokens';

/** Datenbasierte Anpassungsvorschläge mit Begründung. Nichts wird ohne Zustimmung geändert. */
export function SuggestionsList() {
  const { plan, profile, sessions, settings, acceptSuggestion, dismissSuggestion } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useToday();
  const list = useMemo(
    () => computeSuggestions({ plan, profile, sessions, library: EXERCISES, now, dismissed: settings.dismissedSuggestions }).slice(0, 3),
    [plan, profile, sessions, settings.dismissedSuggestions, now],
  );
  if (list.length === 0) return null;

  const accept = async (s: Suggestion) => {
    setError(null);
    if (s.action.type === 'open_exercise') return router.push({ pathname: '/library/[id]', params: { id: s.action.exerciseId } });
    setBusy(s.id);
    try {
      await acceptSuggestion(s);
      if (s.action.type === 'catch_up') router.push('/workout/active');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vorschlag konnte nicht übernommen werden.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SectionHeader title="Vorschläge" />
      {list.map((s) => (
        <Card key={s.id} variant="secondary" style={styles.card}>
          <View style={styles.row}>
            {s.tone === 'warning' ? <TriangleAlert size={18} color={colors.warning} /> : <Lightbulb size={18} color={colors.accent} />}
            <AppText variant="bodyStrong" style={styles.flex}>{s.title}</AppText>
          </View>
          <AppText variant="small" tone="secondary">{s.reason}</AppText>
          <AppText variant="small">{s.effect}</AppText>
          <View style={styles.row}>
            <Button label={s.acceptLabel} size="sm" loading={busy === s.id} onPress={() => accept(s)} />
            <Button label="Ablehnen" size="sm" variant="ghost" onPress={() => dismissSuggestion(s.id)} />
          </View>
        </Card>
      ))}
      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
