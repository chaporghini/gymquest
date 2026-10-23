import { router, useLocalSearchParams } from 'expo-router';
import { Search, SearchX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Chip, EmptyState, ExerciseCard, Screen } from '@/components';
import { EXERCISES } from '@/data/exercises';
import { exerciseGoals, exerciseLocations } from '@/domain/exerciseInfo';
import { MUSCLE_LABELS, MUSCLES, musclesOf, type Muscle } from '@/domain/muscles';
import { isExerciseAllowed, prescribe } from '@/domain/planGenerator';
import { equipmentValues } from '@/domain/profileSchema';
import type { Equipment, Goal, TrainingLocation } from '@/domain/types';
import { difficultyLabels, equipmentLabels, goalLabels, locationLabels } from '@/i18n/labels';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function Library() {
  const { pickFor } = useLocalSearchParams<{ pickFor?: string }>();
  const { profile, plan, savePlan } = useApp();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [location, setLocation] = useState<TrainingLocation | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [onlyMine, setOnlyMine] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((e) => {
      if (q && !`${e.name} ${e.description}`.toLowerCase().includes(q)) return false;
      if (muscle) {
        const m = musclesOf(e.id);
        if (!m.primary.includes(muscle) && !m.secondary.includes(muscle)) return false;
      }
      if (equipment && !e.equipment.includes(equipment)) return false;
      if (difficulty && e.difficulty !== difficulty) return false;
      if (goal && !exerciseGoals(e).includes(goal)) return false;
      if (location && !exerciseLocations(e).includes(location)) return false;
      if (onlyMine && profile && !isExerciseAllowed(e, { ...profile, excludedExerciseIds: [] })) return false;
      return true;
    });
  }, [query, muscle, equipment, difficulty, goal, location, onlyMine, profile]);
  const active = [muscle, equipment, difficulty, goal, location].filter((x) => x !== null).length;
  const reset = () => {
    setMuscle(null);
    setEquipment(null);
    setDifficulty(null);
    setGoal(null);
    setLocation(null);
  };

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

      <View style={styles.chipsWrap}>
        <Chip label={active ? `Filter (${active})` : 'Filter'} selected={showFilters || active > 0} onPress={() => setShowFilters((v) => !v)} />
        <Chip label="Nur mit meiner Ausstattung" role="checkbox" selected={onlyMine} onPress={() => setOnlyMine((v) => !v)} />
        {active ? <Chip label="Zurücksetzen" onPress={reset} /> : null}
      </View>
      {showFilters ? (
        <>
          <FilterRow label="Muskelgruppe">
            {MUSCLES.map((m) => <Chip key={m} label={MUSCLE_LABELS[m]} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} role="radio" />)}
          </FilterRow>
          <FilterRow label="Gerät">
            {equipmentValues.map((x) => <Chip key={x} label={equipmentLabels[x]} selected={equipment === x} onPress={() => setEquipment(equipment === x ? null : x)} role="radio" />)}
          </FilterRow>
          <FilterRow label="Schwierigkeit">
            {([1, 2, 3] as const).map((d) => <Chip key={d} label={difficultyLabels[d]} selected={difficulty === d} onPress={() => setDifficulty(difficulty === d ? null : d)} role="radio" />)}
          </FilterRow>
          <FilterRow label="Trainingsziel">
            {(Object.keys(goalLabels) as Goal[]).map((g) => <Chip key={g} label={goalLabels[g]} selected={goal === g} onPress={() => setGoal(goal === g ? null : g)} role="radio" />)}
          </FilterRow>
          <FilterRow label="Trainingsort">
            {(Object.keys(locationLabels) as TrainingLocation[]).map((l) => <Chip key={l} label={locationLabels[l]} selected={location === l} onPress={() => setLocation(location === l ? null : l)} role="radio" />)}
          </FilterRow>
        </>
      ) : null}

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
            reset();
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
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm },
});
