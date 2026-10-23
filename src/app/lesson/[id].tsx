import { Stack, useLocalSearchParams } from 'expo-router';
import { BookOpen, CircleCheck, SearchX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, Screen, SectionHeader } from '@/components';
import { getExercise } from '@/data/exercises';
import { formatDate } from '@/domain/dates';
import { XP_REWARDS } from '@/domain/xp';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

/**
 * Techniklektion zu einer Übung: Ausführung, Hinweise, häufige Fehler und eine kurze Verständnisfrage.
 * XP gibt es einmal je Übung, nachdem die Frage richtig beantwortet wurde.
 */
export default function Lesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { xpEvents, completeLesson } = useApp();
  const exercise = getExercise(id);
  const [answer, setAnswer] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = xpEvents.find((e) => e.source === 'lesson' && e.refId === id);

  // Eine falsche Aussage (häufiger Fehler) und zwei richtige Hinweise, in fester Reihenfolge je Übung.
  const quiz = useMemo(() => {
    if (!exercise || exercise.mistakes.length === 0) return null;
    const correct = [...exercise.tips, ...exercise.steps.slice(1)].slice(0, 2);
    const options = [...correct.map((text) => ({ text, isMistake: false })), { text: exercise.mistakes[0], isMistake: true }];
    const shift = exercise.id.length % options.length;
    return [...options.slice(shift), ...options.slice(0, shift)];
  }, [exercise]);

  if (!exercise) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} title="Lektion nicht gefunden" message="Zu dieser Übung gibt es keine Lektion." />
      </Screen>
    );
  }

  const choose = async (i: number) => {
    if (!quiz || done || saving) return;
    setAnswer(i);
    setError(null);
    if (!quiz[i].isMistake) return;
    setSaving(true);
    try {
      await completeLesson(exercise.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Techniklektion' }} />
      <View style={styles.header}>
        <View style={styles.icon}><BookOpen size={24} color={colors.accent} /></View>
        <AppText variant="title" accessibilityRole="header">{exercise.name}</AppText>
        <AppText tone="secondary">{exercise.description}</AppText>
      </View>

      <SectionHeader title="So geht's" />
      <Card style={styles.gap}>
        {exercise.steps.map((s, i) => (
          <View key={i} style={styles.row}>
            <AppText variant="bodyStrong" tone="accent" style={styles.num}>{i + 1}</AppText>
            <AppText style={styles.flex}>{s}</AppText>
          </View>
        ))}
      </Card>

      <SectionHeader title="Darauf achten" />
      <Card style={styles.gap}>
        {exercise.tips.map((t) => <AppText key={t}>• {t}</AppText>)}
      </Card>

      {exercise.mistakes.length ? (
        <>
          <SectionHeader title="Häufige Fehler" />
          <Card variant="secondary" style={styles.gap}>
            {exercise.mistakes.map((m) => <AppText key={m}>• {m}</AppText>)}
          </Card>
        </>
      ) : null}

      {quiz ? (
        <>
          <SectionHeader title="Kurze Frage" />
          <Card style={styles.gap}>
            <AppText variant="bodyStrong">Welche Aussage beschreibt einen Fehler?</AppText>
            {quiz.map((o, i) => {
              const picked = answer === i;
              const reveal = !!done || (picked && o.isMistake);
              return (
                <Pressable
                  key={o.text}
                  onPress={() => choose(i)}
                  disabled={!!done || saving}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: picked }}
                  style={[styles.option, reveal && o.isMistake && styles.optionRight, picked && !o.isMistake && styles.optionWrong]}>
                  <AppText style={styles.flex}>{o.text}</AppText>
                </Pressable>
              );
            })}
            {answer !== null && !quiz[answer].isMistake && !done ? (
              <AppText tone="warning" accessibilityRole="alert">Das ist ein richtiger Hinweis zur Ausführung. Lies die häufigen Fehler oben noch einmal und versuch es erneut.</AppText>
            ) : null}
            {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}
            {done ? (
              <View style={styles.row}>
                <CircleCheck size={20} color={colors.accent} />
                <AppText tone="accent" style={styles.flex}>Abgeschlossen am {formatDate(done.createdAt)} · +{done.amount} XP</AppText>
              </View>
            ) : (
              <AppText variant="small" tone="secondary">Richtig beantwortet: +{XP_REWARDS.lesson} XP, einmal pro Übung.</AppText>
            )}
          </Card>
        </>
      ) : null}
      <AppText variant="small" tone="secondary">Allgemeine Technikhinweise. Sie ersetzen keine persönliche Anleitung durch Trainer oder Fachpersonal.</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  icon: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  num: { width: 18 },
  flex: { flex: 1 },
  option: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSecondary, minHeight: MIN_TOUCH, justifyContent: 'center' },
  optionRight: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  optionWrong: { borderColor: colors.warning, backgroundColor: colors.warningMuted },
});
