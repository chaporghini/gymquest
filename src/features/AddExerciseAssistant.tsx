import { Check, Plus, RefreshCw, Search, Sparkles, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Chip, prescriptionText } from '@/components';
import { EXERCISES } from '@/data/exercises';
import { dayMuscleLoad, MUSCLE_LABELS, musclesOf } from '@/domain/muscles';
import { minutesWith, suggestForDay } from '@/domain/planBuilder';
import { estimateDayMinutes, isExerciseAllowed, prescribe } from '@/domain/planGenerator';
import type { Exercise, MuscleGroup, PlanDay, Profile } from '@/domain/types';
import { muscleLabels } from '@/i18n/labels';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { BodyMap } from './BodyMap';

const GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'glutes', 'arms', 'core'];

interface Props {
  visible: boolean;
  day: PlanDay;
  allDays: PlanDay[];
  profile: Profile;
  onAdd: (exercise: Exercise) => void | Promise<void>;
  onClose: () => void;
}

/**
 * „Neue Übung“: Die App fragt, was ergänzt werden soll, schlägt passende Übungen mit Begründung vor
 * und zeigt nach jedem Hinzufügen die aktualisierte Einheit. So wird der Plan Schritt für Schritt fertig.
 */
export function AddExerciseAssistant({ visible, ...rest }: Props) {
  // Inhalt nur bei geöffnetem Dialog einhängen: so startet jede Runde frisch.
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={rest.onClose}>
      {visible ? <Assistant {...rest} /> : null}
    </Modal>
  );
}

function Assistant({ day, allDays, profile, onAdd, onClose }: Omit<Props, 'visible'>) {
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState<string[]>([]);

  const suggestions = useMemo(() => suggestForDay(day, allDays, profile, EXERCISES, group, offset), [day, allDays, profile, group, offset]);
  const load = useMemo(() => dayMuscleLoad(day), [day]);
  const minutes = estimateDayMinutes(day);
  const q = query.trim().toLowerCase();
  const results = search ? EXERCISES.filter((e) => isExerciseAllowed(e, profile) && !day.exercises.some((p) => p.exerciseId === e.id) && (!q || e.name.toLowerCase().includes(q))).slice(0, 20) : [];
  const lastName = added.length ? EXERCISES.find((e) => e.id === added[added.length - 1])?.name : null;

  const add = async (e: Exercise) => {
    await onAdd(e);
    setAdded((a) => [...a, e.id]);
    setOffset(0);
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <View style={styles.flex}>
            <AppText variant="heading">Neue Übung</AppText>
            <AppText variant="small" tone="secondary">
              {day.name} · {day.exercises.length} Übungen · ca. {minutes} min
            </AppText>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Schließen" style={styles.close}>
            <X size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {lastName ? (
            <Bubble>
              <AppText>
                <AppText style={styles.bold}>✓ {lastName}</AppText> ist jetzt in {day.name}.
              </AppText>
              {minutes > profile.sessionMinutes ? (
                <AppText variant="small" tone="warning">
                  Die Einheit dauert jetzt ca. {minutes} min, mehr als deine geplanten {profile.sessionMinutes} min. Vielleicht eine Übung weglassen oder Sätze kürzen.
                </AppText>
              ) : (
                <AppText variant="small" tone="secondary">
                  Noch eine? Sonst tippe auf „Fertig“.
                </AppText>
              )}
              <BodyMap load={load} size={110} showLegend={false} />
            </Bubble>
          ) : null}

          <Bubble>
            <AppText>{added.length ? 'Was soll noch dazu?' : 'Was möchtest du ergänzen?'}</AppText>
            <View style={styles.chips}>
              <Chip
                role="radio"
                label="Was fehlt noch?"
                selected={!group && !search}
                onPress={() => {
                  setGroup(null);
                  setSearch(false);
                  setOffset(0);
                }}
              />
              {GROUPS.map((g) => (
                <Chip
                  key={g}
                  role="radio"
                  label={muscleLabels[g]}
                  selected={group === g && !search}
                  onPress={() => {
                    setGroup(g);
                    setSearch(false);
                    setOffset(0);
                  }}
                />
              ))}
              <Chip role="radio" label="Selbst suchen" selected={search} onPress={() => setSearch(true)} />
            </View>
          </Bubble>

          {search ? (
            <>
              <View style={styles.searchBox}>
                <Search size={18} color={colors.textSecondary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  placeholder="Übung suchen"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Übung suchen"
                  style={styles.searchInput}
                />
              </View>
              {results.map((e) => (
                <Option
                  key={e.id}
                  exercise={e}
                  profile={profile}
                  reason={
                    musclesOf(e.id)
                      .primary.map((m) => MUSCLE_LABELS[m])
                      .join(', ') || 'Mobilität'
                  }
                  onAdd={() => add(e)}
                />
              ))}
              {results.length === 0 ? <AppText tone="secondary">Nichts gefunden, das zu deinem Equipment passt.</AppText> : null}
            </>
          ) : (
            <>
              <View style={styles.inline}>
                <Sparkles size={16} color={colors.accent} />
                <AppText variant="small" tone="secondary">
                  {group ? `Vorschläge für ${muscleLabels[group]}` : 'Meine Vorschläge für diese Einheit'}
                </AppText>
              </View>
              {suggestions.length === 0 ? (
                <AppText tone="secondary">Deine Einheit deckt schon alles ab, was zu deinem Equipment passt. Wähle oben eine Muskelgruppe, wenn du trotzdem etwas ergänzen willst.</AppText>
              ) : (
                suggestions.map((s) => (
                  <Option
                    key={s.exercise.id}
                    exercise={s.exercise}
                    profile={profile}
                    reason={s.reason}
                    extra={`danach ca. ${minutesWith(day, s.exercise, profile)} min`}
                    onAdd={() => add(s.exercise)}
                  />
                ))
              )}
              {suggestions.length > 0 ? <Button label="Andere Vorschläge" icon={RefreshCw} variant="ghost" size="sm" onPress={() => setOffset((o) => o + 1)} /> : null}
            </>
          )}
        </ScrollView>

        <Button label={added.length ? `Fertig (${added.length} hinzugefügt)` : 'Fertig'} icon={Check} size="lg" fullWidth onPress={onClose} />
      </View>
    </View>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return <View style={styles.bubble}>{children}</View>;
}

function Option({ exercise, profile, reason, extra, onAdd }: { exercise: Exercise; profile: Profile; reason: string; extra?: string; onAdd: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.option}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{exercise.name}</AppText>
        <AppText variant="small" tone="secondary">
          {reason}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {prescriptionText(prescribe(exercise, profile))}
          {extra ? ` · ${extra}` : ''}
        </AppText>
      </View>
      <Pressable
        onPress={async () => {
          setBusy(true);
          try {
            await onAdd();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`${exercise.name} hinzufügen`}
        style={({ pressed }) => [styles.addBtn, (pressed || busy) && { opacity: 0.7 }]}
      >
        <Plus size={22} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '90%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  close: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  body: { gap: spacing.md, paddingBottom: spacing.lg },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderTopLeftRadius: 4,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bold: { fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minHeight: 46,
  },
});
