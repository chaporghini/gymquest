import { router } from 'expo-router';
import { ChevronRight, Cloud, CloudOff, RotateCcw, Settings, Trash, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, ConfirmDialog, LevelBadge, Screen, SectionHeader } from '@/components';
import { formatDate } from '@/domain/dates';
import { currentAge } from '@/domain/training';
import { equipmentLabels, experienceLabels, goalLabels, limitationLabels } from '@/i18n/labels';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

export default function Profile() {
  const app = useApp();
  const { profile, level, rank, cloud } = app;
  const [dialog, setDialog] = useState<'regenerate' | 'reset' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!profile) return null;

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setNotice(success ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  const rows: [string, string][] = [
    ['Erfahrung', experienceLabels[profile.experience]],
    ['Ziel', goalLabels[profile.goal]],
    ['Rhythmus', `${profile.daysPerWeek} Tage · ${profile.sessionMinutes} min`],
    ['Equipment', profile.equipment.map((e) => equipmentLabels[e]).join(', ')],
    ['Einschränkungen', profile.limitations.length ? profile.limitations.map((l) => limitationLabels[l]).join(', ') : 'Keine'],
  ];
  const age = currentAge(profile, new Date());
  if (age != null) rows.push(['Alter', `${age} Jahre`]);
  if (profile.heightCm) rows.push(['Größe', `${profile.heightCm.toLocaleString('de-DE')} cm`]);
  if (profile.bodyWeightKg) rows.push(['Körpergewicht', `${profile.bodyWeightKg.toLocaleString('de-DE')} kg`]);

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">Profil</AppText>

      <Card style={styles.hero}>
        <LevelBadge level={level.level} size="lg" />
        <View style={styles.flex}>
          <AppText variant="title" numberOfLines={1}>{profile.displayName}</AppText>
          <AppText tone="accent">{rank.name}</AppText>
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
        <LinkRow icon={Settings} title="Einstellungen" hint="Pausenzeit, Gewichtsstufen, Vibration" onPress={() => router.push('/settings')} />
        <LinkRow icon={cloud.user ? Cloud : CloudOff} iconColor={cloud.user ? colors.accent : colors.warning} title="Konto & Daten" hint={cloud.user ? `Sync aktiv · ${cloud.user.email}` : 'Nur auf diesem Gerät · Backup'} onPress={() => router.push('/account')} divider />
        <LinkRow icon={Trophy} title="Quests & Achievements" hint={`Level ${level.level} · ${rank.name}`} onPress={() => router.push('/quests')} divider />
        <LinkRow icon={RotateCcw} title="Plan automatisch erstellen" hint="Neuer Plan aus deinem Profil" onPress={() => setDialog('regenerate')} divider />
      </Card>
      <Button label="Alle Daten löschen" icon={Trash} variant="ghost" size="sm" onPress={() => setDialog('reset')} />

      {notice ? <AppText tone="accent" accessibilityLiveRegion="polite">{notice}</AppText> : null}
      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}

      <AppText variant="small" tone="secondary" align="center" style={styles.disclaimer}>
        GYMQUEST ersetzt keine medizinische Beratung. Bei Schmerzen Training abbrechen und ärztlich abklären lassen.
      </AppText>

      <ConfirmDialog
        visible={dialog === 'regenerate'}
        title="Plan neu erstellen?"
        message="Dein aktueller Plan inklusive eigener Änderungen wird durch einen neuen Plan aus deinem Profil ersetzt. Trainingshistorie und XP bleiben erhalten."
        confirmLabel="Neu erstellen"
        loading={busy}
        onConfirm={() => run(app.regeneratePlan, 'Neuer Trainingsplan erstellt.')}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'reset'}
        title="Alle Daten löschen?"
        message={`Profil, Plan, Trainingshistorie, XP und Achievements werden unwiderruflich von diesem Gerät gelöscht.${cloud.user ? ' Du wirst abgemeldet, die Daten in der Cloud bleiben erhalten.' : ''}`}
        confirmLabel="Endgültig löschen"
        destructive
        loading={busy}
        onConfirm={() => run(app.resetAll)}
        onCancel={() => setDialog(null)}
      />
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
