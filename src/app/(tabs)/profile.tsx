import { router } from 'expo-router';
import { CalendarPlus, ChevronRight, Cloud, CloudOff, Settings } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, LevelBadge, Screen, SectionHeader } from '@/components';
import { formatDate } from '@/domain/dates';
import { currentAge } from '@/domain/training';
import { MUSCLE_LABELS, type Muscle } from '@/domain/muscles';
import { equipmentLabels, experienceLabels, goalLabels, limitationLabels, locationLabels } from '@/i18n/labels';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

const BUILD_TIME = (() => {
  const raw = process.env.EXPO_PUBLIC_BUILD_TIME;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? `${formatDate(d.toISOString())}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} Uhr` : null;
})();

export default function Profile() {
  const app = useApp();
  const { profile, level, rank, cloud } = app;

  if (!profile) return null;

  const rows: [string, string][] = [
    ['Erfahrung', experienceLabels[profile.experience]],
    ['Ziel', goalLabels[profile.goal]],
    ['Rhythmus', `${profile.daysPerWeek} Tage · ${profile.sessionMinutes} min`],
    ['Ort', profile.location ? locationLabels[profile.location] : 'Unbekannt'],
    ['Ausstattung', profile.equipment.map((e) => equipmentLabels[e]).join(', ')],
    ['Einschränkungen', profile.limitations.length ? profile.limitations.map((l) => limitationLabels[l]).join(', ') : 'Keine'],
  ];
  if (profile.focusMuscles?.length) rows.push(['Schwerpunkte', profile.focusMuscles.map((m) => MUSCLE_LABELS[m as Muscle] ?? m).join(', ')]);
  if (profile.history) rows.push(['Vorerfahrung', profile.history]);
  const age = currentAge(profile, new Date());
  if (age != null) rows.push(['Alter', `${age} Jahre`]);
  if (profile.heightCm) rows.push(['Größe', `${profile.heightCm.toLocaleString('de-DE')} cm`]);
  if (profile.bodyWeightKg) rows.push(['Körpergewicht', `${profile.bodyWeightKg.toLocaleString('de-DE')} kg`]);

  return (
    <Screen wide>
      <AppText variant="title" accessibilityRole="header">Profil</AppText>

      <Card style={styles.hero}>
        <LevelBadge level={level.level} size="lg" />
        <View style={styles.flex}>
          <AppText variant="title" numberOfLines={1}>{profile.displayName}</AppText>
          <AppText tone="accent">{rank.name} · Level {level.level}</AppText>
          <AppText variant="small" tone="secondary">{level.totalXp} XP gesamt · {app.sessions.length} Trainings</AppText>
          <AppText variant="small" tone="secondary">Dabei seit {formatDate(profile.createdAt)}</AppText>
        </View>
      </Card>

      <SectionHeader title="Trainingsprofil" actionLabel="Bearbeiten" onAction={() => router.push('/profile/edit')} />
      <Card padded={false}>
        {rows.map(([label, value], i) => (
          <View key={label} style={[styles.row, i > 0 && styles.divider]}>
            <AppText variant="small" tone="secondary" style={styles.rowLabel}>{label}</AppText>
            <AppText style={styles.flex}>{value}</AppText>
          </View>
        ))}
      </Card>

      <Card padded={false}>
        <LinkRow icon={Settings} title="Einstellungen" hint="Farbe, Pausenzeit, Gewichtsstufen, Vibration" onPress={() => router.push('/settings')} />
        <LinkRow icon={cloud.user ? Cloud : CloudOff} iconColor={cloud.user ? colors.accent : colors.warning} title="Konto & Daten" hint={cloud.user ? `Gesichert · ${cloud.user.email}` : 'Nicht gesichert · Konto oder Backup'} onPress={() => router.push('/account')} divider />
        <LinkRow icon={CalendarPlus} title="Neuen Trainingsplan erstellen" hint="Schritt für Schritt aus deinen Angaben" onPress={() => router.push('/plan/create')} divider />
      </Card>

      <AppText variant="small" tone="secondary" align="center" style={styles.disclaimer}>
        GymQuest ersetzt keine medizinische Beratung. Bei Schmerzen Training abbrechen und ärztlich abklären lassen.
      </AppText>
      {BUILD_TIME ? <AppText variant="caption" tone="secondary" align="center">Version vom {BUILD_TIME}</AppText> : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 52 },
  rowStack: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowLabel: { width: 120 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  stepRow: { gap: spacing.xs, marginTop: spacing.xs },
  stepLabel: { fontWeight: '600' },
  chipsInline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  syncCard: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  disclaimer: { marginTop: spacing.lg },
});

function LinkRow({ icon: Icon, iconColor = colors.textSecondary, title, hint, onPress, divider }: { icon: typeof Settings; iconColor?: string; title: string; hint: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, divider && styles.divider, pressed && { opacity: 0.8 }]}>
      <Icon size={20} color={iconColor} />
      <View style={styles.flex}>
        <AppText>{title}</AppText>
        <AppText variant="small" tone="secondary" numberOfLines={1}>{hint}</AppText>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}
