import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Cloud, CloudOff, Download, KeyRound, LogOut, RefreshCw, Trash, Upload } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppText, Button, Card, Chip, ConfirmDialog, Screen, SectionHeader } from '@/components';
import { backupFileName } from '@/data/backup';
import { canImportBackupFile, pickBackupFile, saveBackupFile } from '@/features/backupFile';
import { useApp } from '@/state/AppProvider';
import type { CloudSync } from '@/state/useCloudSync';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const emailSchema = z.string().trim().min(1, 'Bitte gib deine E-Mail-Adresse ein.').email('Das sieht nicht nach einer E-Mail-Adresse aus.');
const passwordSchema = z.string().min(8, 'Das Passwort braucht mindestens 8 Zeichen.').max(72, 'Das Passwort ist zu lang.');
const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema });
type Credentials = z.infer<typeof credentialsSchema>;

export default function Account() {
  const app = useApp();
  const { cloud, profile } = app;
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  // Neues Gerät ohne Profil: Sobald die Daten aus der Cloud da sind, geht es direkt in die App.
  const [hadProfile] = useState(!!profile);
  useEffect(() => {
    if (!hadProfile && profile) router.replace('/');
  }, [hadProfile, profile]);

  const run = async (kind: 'export' | 'import', action: () => Promise<string | null>) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  };

  const exportBackup = () =>
    run('export', async () => {
      const backup = await app.exportBackup();
      await saveBackupFile(backupFileName(), JSON.stringify(backup, null, 2));
      return `Sicherung mit ${backup.records.length} Einträgen erstellt.`;
    });

  const importBackup = () =>
    run('import', async () => {
      const text = await pickBackupFile();
      if (text === null) return null;
      const changed = await app.importBackup(text);
      return changed > 0 ? `${changed} Einträge aus der Sicherung übernommen.` : 'Alles aus der Sicherung war schon vorhanden.';
    });

  return (
    <Screen>
      <AppText tone="secondary">
        Mit einem Konto sind deine Trainings, XP und dein Plan auf iPhone und MacBook gleich. Die App funktioniert auch ohne Internet und überträgt
        Änderungen, sobald du wieder online bist.
      </AppText>

      {!cloud.configured ? (
        <Card style={styles.row}>
          <CloudOff size={20} color={colors.warning} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Cloud-Sync ist nicht eingerichtet</AppText>
            <AppText variant="small" tone="secondary">
              Diese Version wurde ohne Supabase-Zugang gebaut. Deine Daten bleiben auf diesem Gerät. Die Einrichtung steht in der Anleitung (README, Abschnitt „Supabase“).
            </AppText>
          </View>
        </Card>
      ) : !cloud.ready ? (
        <AppText tone="secondary">Anmeldestatus wird geprüft …</AppText>
      ) : cloud.user ? (
        <SignedIn cloud={cloud} />
      ) : (
        <SignInForm cloud={cloud} />
      )}

      <SectionHeader title="Datensicherung" />
      <AppText variant="small" tone="secondary" style={styles.sub}>
        Speichert alle Daten dieses Geräts als Datei. Beim Einspielen wird nichts gelöscht: Fehlende Trainings und XP werden ergänzt.
      </AppText>
      <View style={styles.actions}>
        <Button label="Backup exportieren" icon={Download} variant="secondary" loading={busy === 'export'} onPress={exportBackup} style={styles.flex} />
        {canImportBackupFile ? (
          <Button label="Backup einspielen" icon={Upload} variant="secondary" loading={busy === 'import'} onPress={importBackup} style={styles.flex} />
        ) : null}
      </View>
      {notice ? <AppText tone="accent" accessibilityLiveRegion="polite">{notice}</AppText> : null}
      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}
    </Screen>
  );
}

function formatSyncTime(iso: string | null) {
  if (!iso) return 'noch nie';
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
}

function SignedIn({ cloud }: { cloud: CloudSync }) {
  const [dialog, setDialog] = useState<'signout' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status =
    cloud.phase === 'syncing'
      ? 'Synchronisiere …'
      : cloud.phase === 'offline'
        ? `Offline. Zuletzt synchronisiert: ${formatSyncTime(cloud.lastSyncedAt)}`
        : cloud.phase === 'error'
          ? `Fehler: ${cloud.message ?? 'unbekannt'}`
          : `Zuletzt synchronisiert: ${formatSyncTime(cloud.lastSyncedAt)}`;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (dialog === 'delete') await cloud.deleteCloudData();
      else await cloud.signOut();
      setDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen.');
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card style={styles.row}>
        <Cloud size={20} color={cloud.phase === 'error' ? colors.error : colors.accent} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>{cloud.user?.email}</AppText>
          <AppText variant="small" tone={cloud.phase === 'error' ? 'error' : 'secondary'} accessibilityLiveRegion="polite">{status}</AppText>
        </View>
      </Card>
      <View style={styles.actions}>
        <Button label="Jetzt synchronisieren" icon={RefreshCw} loading={cloud.phase === 'syncing'} onPress={() => void cloud.syncNow()} style={styles.flex} />
        <Button label="Abmelden" icon={LogOut} variant="secondary" onPress={() => setDialog('signout')} style={styles.flex} />
      </View>
      <ChangePassword cloud={cloud} />
      <Button label="Cloud-Daten löschen" icon={Trash} variant="danger" onPress={() => setDialog('delete')} />
      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}

      <ConfirmDialog
        visible={dialog === 'signout'}
        title="Abmelden?"
        message="Deine Daten bleiben auf diesem Gerät und in der Cloud. Änderungen werden erst nach erneuter Anmeldung wieder übertragen."
        confirmLabel="Abmelden"
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'delete'}
        title="Cloud-Daten löschen?"
        message="Alle Daten deines Kontos werden aus der Cloud gelöscht und du wirst abgemeldet. Die Daten auf diesem Gerät bleiben erhalten. Andere Geräte behalten ihre lokale Kopie."
        confirmLabel="Endgültig löschen"
        destructive
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}

function ChangePassword({ cloud }: { cloud: CloudSync }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'accent' | 'error'; text: string } | null>(null);

  if (!open) {
    return (
      <>
        <Button label="Passwort ändern" icon={KeyRound} variant="ghost" onPress={() => setOpen(true)} />
        {feedback ? <AppText tone={feedback.tone} accessibilityLiveRegion="polite">{feedback.text}</AppText> : null}
      </>
    );
  }
  const save = async () => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setFeedback({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Ungültiges Passwort.' });
    setBusy(true);
    try {
      await cloud.changePassword(password);
      setFeedback({ tone: 'accent', text: 'Neues Passwort gespeichert.' });
      setPassword('');
      setOpen(false);
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : 'Passwort konnte nicht geändert werden.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.form}>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Neues Passwort"
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        accessibilityLabel="Neues Passwort"
        onSubmitEditing={() => void save()}
        style={styles.input}
      />
      <Button label="Neues Passwort speichern" loading={busy} onPress={() => void save()} />
      {feedback ? <AppText tone={feedback.tone}>{feedback.text}</AppText> : null}
    </View>
  );
}

function SignInForm({ cloud }: { cloud: CloudSync }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { control, handleSubmit, formState, getValues } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') await cloud.signIn(email, password);
      else if ((await cloud.signUp(email, password)) === 'confirm-email') {
        setNotice('Fast geschafft: Wir haben dir eine E-Mail geschickt. Tippe auf den Link darin und melde dich danach hier an.');
        setMode('signin');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.');
    }
  });

  const resetPassword = async () => {
    setError(null);
    setNotice(null);
    const email = emailSchema.safeParse(getValues('email'));
    if (!email.success) return setError('Bitte trage oben zuerst deine E-Mail-Adresse ein.');
    try {
      await cloud.sendPasswordReset(email.data);
      setNotice('Wir haben dir einen Link geschickt. Er öffnet GYMQUEST im Browser und meldet dich an. Dort unter Profil → Konto & Daten ein neues Passwort setzen und dann hier damit anmelden.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'E-Mail konnte nicht gesendet werden.');
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        <Chip role="radio" label="Anmelden" selected={mode === 'signin'} onPress={() => setMode('signin')} />
        <Chip role="radio" label="Konto erstellen" selected={mode === 'signup'} onPress={() => setMode('signup')} />
      </View>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextInput
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="E-Mail"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            accessibilityLabel="E-Mail"
            style={styles.input}
          />
        )}
      />
      {formState.errors.email ? <AppText variant="small" tone="error">{formState.errors.email.message}</AppText> : null}
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextInput
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="Passwort"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            accessibilityLabel="Passwort"
            onSubmitEditing={() => void submit()}
            style={styles.input}
          />
        )}
      />
      {formState.errors.password ? <AppText variant="small" tone="error">{formState.errors.password.message}</AppText> : null}
      <Button label={mode === 'signin' ? 'Anmelden' : 'Konto erstellen'} loading={formState.isSubmitting} onPress={() => void submit()} fullWidth />
      {mode === 'signin' ? <Button label="Passwort vergessen?" variant="ghost" size="sm" onPress={() => void resetPassword()} /> : null}
      {notice ? <AppText tone="accent" accessibilityLiveRegion="polite">{notice}</AppText> : null}
      {error ? <AppText tone="error" accessibilityRole="alert">{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  sub: { marginTop: -spacing.sm },
  form: { gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
  },
});
