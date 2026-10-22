import { router } from 'expo-router';
import { ChevronRight, Cloud, CloudOff, Pencil, RotateCcw, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Card, Chip, ConfirmDialog, LevelBadge, Screen, SectionHeader } from '@/components';
import { formatDate } from '@/domain/dates';
import { equipmentLabels, experienceLabels, goalLabels, limitationLabels } from '@/i18n/labels';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

const REST_OPTIONS: (number | null)[] = [null, 60, 90, 120, 180];

export default function Profile() {
  const app = useApp();
  const { profile, settings, level, rank, cloud } = app;
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
      <View style={styles.actions}>
        <Button label="Profil bearbeiten" icon={Pencil} variant="secondary" onPress={() => router.push('/profile/edit')} style={styles.flex} />
        <Button label="Plan neu erstellen" icon={RotateCcw} variant="secondary" onPress={() => setDialog('regenerate')} style={styles.flex} />
      </View>

      <SectionHeader title="Einstellungen" />
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
      </Card>

      <SectionHeader title="Daten & Synchronisierung" />
      <Pressable onPress={() => router.push('/account')} accessibilityRole="button" accessibilityLabel="Konto und Datensicherung öffnen">
        <Card style={styles.syncCard}>
          {cloud.user ? <Cloud size={20} color={colors.accent} /> : <CloudOff size={20} color={colors.warning} />}
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{cloud.user ? 'Cloud-Sync aktiv' : 'Nur auf diesem Gerät'}</AppText>
            <AppText variant="small" tone="secondary" numberOfLines={2}>
              {cloud.user
                ? `${cloud.user.email}${cloud.phase === 'offline' ? ' · offline' : cloud.phase === 'error' ? ' · Fehler beim Abgleich' : ''}`
                : cloud.configured
                  ? 'Melde dich an, um iPhone und MacBook abzugleichen. Backup als Datei möglich.'
                  : 'Backup als Datei möglich. Cloud-Sync ist in dieser Version nicht eingerichtet.'}
            </AppText>
          </View>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Card>
      </Pressable>
      <Button label="Alle Daten löschen" icon={Trash} variant="danger" onPress={() => setDialog('reset')} />

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
  syncCard: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  disclaimer: { marginTop: spacing.lg },
});
