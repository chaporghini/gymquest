import { router, useLocalSearchParams } from 'expo-router';
import { Search, SearchX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Chip, EmptyState, ExerciseCard, Screen } from '@/components';
import { EXERCISES } from '@/data/exercises';
import { isExerciseAllowed, prescribe } from '@/domain/planGenerator';
import type { ExerciseCategory, MuscleGroup } from '@/domain/types';
import { categoryLabels, muscleLabels } from '@/i18n/labels';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function Library() {
  const { pickFor } = useLocalSearchParams<{ pickFor?: string }>();
  const { profile, plan, savePlan } = useApp();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [onlyMine, setOnlyMine] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((e) => {
      if (q && !`${e.name} ${e.description}`.toLowerCase().includes(q)) return false;
      if (muscle && e.muscleGroup !== muscle && !e.secondaryMuscles.includes(muscle)) return false;
      if (category && e.category !== category) return false;
      if (onlyMine && profile && !isExerciseAllowed(e, { ...profile, excludedExerciseIds: [] })) return false;
      return true;
    });
  }, [query, muscle, category, onlyMine, profile]);

  const pickDay = pickFor ? plan?.days.find((d) => d.id === pickFor) : undefined;

  const onSelect = async (id: string) => {
    if (!pickDay || !plan || !profile) {
      router.push({ pathname: '/library/[id]', params: { id } });
      return;
    }
    const exercise = EXERCISES.find((e) => e.id === id)!;
    try {
      await savePlan({
        ...plan,
        days: plan.days.map((d) => (d.id === pickDay.id ? { ...d, exercises: [...d.exercises, prescribe(exercise, profile)] } : d)),
      });
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: '/plan/day/[dayId]', params: { dayId: pickDay.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Übung konnte nicht hinzugefügt werden.');
    }
  };

  return (
    <Screen edges={['bottom']}>
      {pickDay ? <AppText tone="accent">Wähle eine Übung für „{pickDay.name}“.</AppText> : null}
      <View style={styles.search}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Übung suchen"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Übung suchen"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={styles.input}
        />
      </View>

      <FilterRow label="Muskelgruppe">
        <Chip label="Alle" selected={!muscle} onPress={() => setMuscle(null)} role="radio" />
        {(Object.keys(muscleLabels) as MuscleGroup[]).map((m) => (
          <Chip key={m} label={muscleLabels[m]} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} role="radio" />
        ))}
      </FilterRow>
      <FilterRow label="Art">
        <Chip label="Alle" selected={!category} onPress={() => setCategory(null)} role="radio" />
        {(Object.keys(categoryLabels) as ExerciseCategory[]).map((c) => (
          <Chip key={c} label={categoryLabels[c]} selected={category === c} onPress={() => setCategory(category === c ? null : c)} role="radio" />
        ))}
      </FilterRow>
      <View style={styles.chipsWrap}>
        <Chip label="Nur mit meinem Equipment" role="checkbox" selected={onlyMine} onPress={() => setOnlyMine((v) => !v)} />
      </View>

      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}
      <AppText variant="small" tone="secondary">{results.length} Übungen</AppText>
      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Keine Übungen gefunden"
          message="Passe die Suche oder die Filter an."
          actionLabel="Filter zurücksetzen"
          onAction={() => {
            setQuery('');
            setMuscle(null);
            setCategory(null);
            setOnlyMine(false);
          }}
        />
      ) : (
        <View style={styles.list}>
          {results.map((e) => <ExerciseCard key={e.id} exercise={e} onPress={() => onSelect(e.id)} />)}
        </View>
      )}
    </Screen>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filter}>
      <AppText variant="caption" tone="secondary">{label.toUpperCase()}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup">
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.md },
  input: { ...typography.body, flex: 1, color: colors.text, minHeight: 48 },
  filter: { gap: spacing.xs },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chipsWrap: { flexDirection: 'row' },
  list: { gap: spacing.sm },
});
