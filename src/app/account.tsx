import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Cloud, CloudOff, Download, Eye, EyeOff, HardDrive, KeyRound, LogOut, Mail, RefreshCw, Trash, Upload, UserX, WifiOff } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { z } from 'zod';

import { AppText, Button, Card, ConfirmDialog, LevelBadge, Screen, SectionHeader } from '@/components';
import { backupFileName } from '@/data/backup';
import { formatDate } from '@/domain/dates';
import { canImportBackupFile, pickBackupFile, saveBackupFile } from '@/features/backupFile';
import { useApp } from '@/state/AppProvider';
import type { CloudSync } from '@/state/useCloudSync';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const emailSchema = z.string().trim().min(1, 'Bitte gib deine E-Mail-Adresse ein.').email('Das sieht nicht nach einer E-Mail-Adresse aus.');
const passwordSchema = z.string().min(8, 'Das Passwort braucht mindestens 8 Zeichen.').max(72, 'Das Passwort ist zu lang.');
const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema });
type Credentials = z.infer<typeof credentialsSchema>;

const BACKUP_REMIND_DAYS = 30;

type Feedback = { tone: 'accent' | 'error'; text: string } | null;

export default function Account() {
  const app = useApp();
  const { cloud, profile, level, rank, settings } = app;

  // Neues Gerät ohne Profil: Sobald die Daten aus der Cloud da sind, geht es direkt in die App.
  const [hadProfile] = useState(!!profile);
  useEffect(() => {
    if (!hadProfile && profile) router.replace('/');
  }, [hadProfile, profile]);

  const saved = !!cloud.user;
  return (
    <Screen edges={['bottom']}>
      {profile ? (
        <Card style={styles.hero}>
          <LevelBadge level={level.level} size="lg" />
          <View style={styles.flex}>
            <AppText variant="heading" numberOfLines={1}>{profile.displayName}</AppText>
            <AppText tone="accent">{rank.name} · Level {level.level}</AppText>
            <View style={styles.inline}>
              {saved ? <Cloud size={16} color={colors.accent} /> : <CloudOff size={16} color={colors.warning} />}
              <AppText variant="small" tone="secondary">{saved ? 'Dein Held ist gesichert' : 'Nur auf diesem Gerät gespeichert'}</AppText>
            </View>
          </View>
        </Card>
      ) : null}

      {cloud.recovery && cloud.user ? <NewPasswordCard cloud={cloud} /> : null}

      <SectionHeader title="Konto" />
      {!cloud.configured ? (
        <AppText variant="small" tone="secondary" style={styles.sub}>
          In dieser Version gibt es kein Konto. Deine Daten bleiben auf diesem Gerät. Sichere sie regelmäßig mit einem Backup.
        </AppText>
      ) : !cloud.ready ? (
        <AppText tone="secondary">Anmeldestatus wird geprüft …</AppText>
      ) : cloud.user ? (
        <SyncCard cloud={cloud} />
      ) : (
        <>
          <View style={styles.benefits}>
            <Benefit icon={RefreshCw} label="Sync auf allen Geräten" />
            <Benefit icon={WifiOff} label="Funktioniert offline" />
            <Benefit icon={HardDrive} label="Sicher in der Cloud" />
          </View>
          <SignInForm cloud={cloud} />
        </>
      )}

      <BackupSection lastBackupAt={settings.lastBackupAt} />

      {cloud.user ? (
        <>
          <SectionHeader title="Sicherheit" />
          <Card padded={false}>
            <ChangePassword cloud={cloud} />
            <ChangeEmail cloud={cloud} />
          </Card>
        </>
      ) : null}

      <DangerZone cloud={cloud} />
    </Screen>
  );
}

function Benefit({ icon: Icon, label }: { icon: typeof Cloud; label: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}><Icon size={20} color={colors.accent} /></View>
      <AppText variant="small" tone="secondary" align="center">{label}</AppText>
    </View>
  );
}

function formatSyncTime(iso: string | null) {
  if (!iso) return 'noch nie';
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
}

function SyncCard({ cloud }: { cloud: CloudSync }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const status =
    cloud.phase === 'syncing'
      ? 'Synchronisiere …'
      : cloud.phase === 'offline'
        ? `Offline. Zuletzt synchronisiert: ${formatSyncTime(cloud.lastSyncedAt)}`
        : cloud.phase === 'error'
          ? `Fehler: ${cloud.message ?? 'unbekannt'}`
          : `Zuletzt synchronisiert: ${formatSyncTime(cloud.lastSyncedAt)}`;

  return (
    <Card style={styles.gap}>
      <View style={styles.inline}>
        <Cloud size={20} color={cloud.phase === 'error' ? colors.error : colors.accent} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>{cloud.user?.email}</AppText>
          <AppText variant="small" tone={cloud.phase === 'error' ? 'error' : 'secondary'} accessibilityLiveRegion="polite">{status}</AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Jetzt synchronisieren" icon={RefreshCw} size="sm" loading={cloud.phase === 'syncing'} onPress={() => void cloud.syncNow()} style={styles.flex} />
        <Button label="Abmelden" icon={LogOut} size="sm" variant="secondary" onPress={() => setConfirm(true)} style={styles.flex} />
      </View>
      <ConfirmDialog
        visible={confirm}
        title="Abmelden?"
        message="Deine Daten bleiben auf diesem Gerät und in der Cloud. Änderungen werden erst nach erneuter Anmeldung wieder übertragen."
        confirmLabel="Abmelden"
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          await cloud.signOut().catch(() => {});
          setBusy(false);
          setConfirm(false);
        }}
        onCancel={() => setConfirm(false)}
      />
    </Card>
  );
}

function BackupSection({ lastBackupAt }: { lastBackupAt?: string }) {
  const app = useApp();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [now] = useState(() => Date.now());

  const run = async (kind: 'export' | 'import', action: () => Promise<string | null>) => {
    setBusy(kind);
    setFeedback(null);
    try {
      const text = await action();
      setFeedback(text ? { tone: 'accent', text } : null);
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : 'Aktion fehlgeschlagen.' });
    } finally {
      setBusy(null);
    }
  };

  const exportBackup = () =>
    run('export', async () => {
      const backup = await app.exportBackup();
      await saveBackupFile(backupFileName(), JSON.stringify(backup, null, 2));
      await app.updateSettings({ lastBackupAt: new Date().toISOString() });
      return `Sicherung mit ${backup.records.length} Einträgen erstellt.`;
    });

  const importBackup = () =>
    run('import', async () => {
      const text = await pickBackupFile();
      if (text === null) return null;
      const changed = await app.importBackup(text);
      return changed > 0 ? `${changed} Einträge aus der Sicherung übernommen.` : 'Alles aus der Sicherung war schon vorhanden.';
    });

  const days = lastBackupAt ? Math.floor((now - new Date(lastBackupAt).getTime()) / 86_400_000) : null;
  const stale = days === null || days >= BACKUP_REMIND_DAYS;

  return (
    <>
      <SectionHeader title="Datensicherung" />
      <Card style={styles.gap}>
        <AppText variant="small" tone={stale && app.sessions.length > 0 ? 'warning' : 'secondary'}>
          {lastBackupAt ? `Letztes Backup: ${formatDate(lastBackupAt)}${days != null && days >= BACKUP_REMIND_DAYS ? ` (vor ${days} Tagen)` : ''}` : 'Noch kein Backup erstellt.'}
        </AppText>
        <AppText variant="small" tone="secondary">Speichert alles als Datei. Beim Einspielen wird nichts gelöscht, Fehlendes wird ergänzt.</AppText>
        <View style={styles.actions}>
          <Button label="Exportieren" icon={Download} size="sm" variant="secondary" loading={busy === 'export'} onPress={exportBackup} style={styles.flex} />
          {canImportBackupFile ? (
            <Button label="Einspielen" icon={Upload} size="sm" variant="secondary" loading={busy === 'import'} onPress={importBackup} style={styles.flex} />
          ) : null}
        </View>
        {!canImportBackupFile ? <AppText variant="small" tone="secondary">Einspielen geht in der Web-App im Browser.</AppText> : null}
        {feedback ? <AppText variant="small" tone={feedback.tone} accessibilityLiveRegion="polite">{feedback.text}</AppText> : null}
      </Card>
    </>
  );
}

function DangerZone({ cloud }: { cloud: CloudSync }) {
  const app = useApp();
  const [dialog, setDialog] = useState<'cloud' | 'account' | 'local' | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const confirm = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      if (dialog === 'account') {
        await cloud.deleteAccount();
        setFeedback({ tone: 'accent', text: 'Dein Konto wurde gelöscht. Die Daten auf diesem Gerät sind noch da.' });
      } else if (dialog === 'cloud') {
        await cloud.deleteCloudData();
        setFeedback({ tone: 'accent', text: 'Cloud-Daten gelöscht. Du bist abgemeldet.' });
      } else if (dialog === 'local') {
        await app.resetAll();
      }
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : 'Aktion fehlgeschlagen.' });
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  return (
    <>
      <SectionHeader title="Gefahrenzone" />
      <Card padded={false} style={styles.danger}>
        {cloud.user ? (
          <>
            <DangerRow icon={UserX} title="Konto löschen" hint="Login und alle Cloud-Daten endgültig entfernen" onPress={() => setDialog('account')} />
            <DangerRow icon={Trash} title="Nur Cloud-Daten löschen" hint="Konto bleibt, Daten in der Cloud werden entfernt" onPress={() => setDialog('cloud')} divider />
          </>
        ) : null}
        <DangerRow icon={Trash} title="Alle Daten auf diesem Gerät löschen" hint="Profil, Plan, Trainings, XP und Erfolge" onPress={() => setDialog('local')} divider={!!cloud.user} />
      </Card>
      {feedback ? <AppText variant="small" tone={feedback.tone} accessibilityRole="alert">{feedback.text}</AppText> : null}

      <ConfirmDialog
        visible={dialog === 'account'}
        title="Konto endgültig löschen?"
        message="Dein Login und alle Daten in der Cloud werden unwiderruflich gelöscht. Die Daten auf diesem Gerät bleiben erhalten. Andere Geräte behalten ihre lokale Kopie."
        confirmLabel="Konto löschen"
        destructive
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'cloud'}
        title="Cloud-Daten löschen?"
        message="Alle Daten deines Kontos werden aus der Cloud gelöscht und du wirst abgemeldet. Die Daten auf diesem Gerät bleiben erhalten."
        confirmLabel="Endgültig löschen"
        destructive
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'local'}
        title="Alle Daten löschen?"
        message={`Profil, Plan, Trainingshistorie, XP und Erfolge werden unwiderruflich von diesem Gerät gelöscht.${cloud.user ? ' Du wirst abgemeldet, die Daten in der Cloud bleiben erhalten.' : ''}`}
        confirmLabel="Endgültig löschen"
        destructive
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}

function DangerRow({ icon: Icon, title, hint, onPress, divider }: { icon: typeof Trash; title: string; hint: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, divider && styles.divider, pressed && { opacity: 0.8 }]}>
      <Icon size={18} color={colors.error} />
      <View style={styles.flex}>
        <AppText tone="error">{title}</AppText>
        <AppText variant="small" tone="secondary">{hint}</AppText>
      </View>
    </Pressable>
  );
}

function PasswordInput(props: TextInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.inputWrap}>
      <TextInput {...props} secureTextEntry={!visible} autoCapitalize="none" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.inputWithIcon]} />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
        style={styles.eye}>
        {visible ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
      </Pressable>
    </View>
  );
}

/** Erscheint nach dem Klick auf den „Passwort vergessen“-Link. */
function NewPasswordCard({ cloud }: { cloud: CloudSync }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Ungültiges Passwort.');
    setBusy(true);
    setError(null);
    try {
      await cloud.changePassword(password);
      cloud.clearRecovery();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Passwort konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card variant="highlight" style={styles.gap}>
      <View style={styles.inline}>
        <KeyRound size={20} color={colors.accent} />
        <AppText variant="bodyStrong">Neues Passwort festlegen</AppText>
      </View>
      <PasswordInput value={password} onChangeText={setPassword} placeholder="Neues Passwort" autoComplete="new-password" textContentType="newPassword" accessibilityLabel="Neues Passwort" onSubmitEditing={() => void save()} />
      <AppText variant="small" tone="secondary">Mindestens 8 Zeichen.</AppText>
      <Button label="Passwort speichern" loading={busy} onPress={() => void save()} />
      {error ? <AppText variant="small" tone="error" accessibilityRole="alert">{error}</AppText> : null}
    </Card>
  );
}

function ExpandRow({ icon: Icon, title, open, onToggle, divider, children }: { icon: typeof Mail; title: string; open: boolean; onToggle: () => void; divider?: boolean; children: ReactNode }) {
  return (
    <View style={divider && styles.divider}>
      {open ? (
        <View style={styles.expanded}>
          <View style={styles.inline}>
            <Icon size={18} color={colors.textSecondary} />
            <AppText style={styles.flex}>{title}</AppText>
          </View>
          {children}
        </View>
      ) : (
        <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
          <Icon size={18} color={colors.textSecondary} />
          <AppText style={styles.flex}>{title}</AppText>
        </Pressable>
      )}
    </View>
  );
}

function ChangePassword({ cloud }: { cloud: CloudSync }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const close = () => {
    setOpen(false);
    setPassword('');
  };
  const save = async () => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setFeedback({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Ungültiges Passwort.' });
    setBusy(true);
    try {
      await cloud.changePassword(password);
      setFeedback({ tone: 'accent', text: 'Neues Passwort gespeichert.' });
      close();
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : 'Passwort konnte nicht geändert werden.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <ExpandRow icon={KeyRound} title="Passwort ändern" open={open} onToggle={() => { setFeedback(null); setOpen(true); }}>
      {open ? (
        <>
          <PasswordInput value={password} onChangeText={setPassword} placeholder="Neues Passwort (mind. 8 Zeichen)" autoComplete="new-password" textContentType="newPassword" accessibilityLabel="Neues Passwort" onSubmitEditing={() => void save()} />
          <View style={styles.actions}>
            <Button label="Speichern" size="sm" loading={busy} onPress={() => void save()} style={styles.flex} />
            <Button label="Abbrechen" size="sm" variant="secondary" onPress={close} style={styles.flex} />
          </View>
        </>
      ) : null}
      {feedback ? <AppText variant="small" tone={feedback.tone} accessibilityLiveRegion="polite" style={!open && styles.rowNote}>{feedback.text}</AppText> : null}
    </ExpandRow>
  );
}

function ChangeEmail({ cloud }: { cloud: CloudSync }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const close = () => {
    setOpen(false);
    setEmail('');
  };
  const save = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setFeedback({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Ungültige E-Mail.' });
    setBusy(true);
    try {
      await cloud.changeEmail(parsed.data);
      setFeedback({ tone: 'accent', text: 'Fast geschafft: Bestätige die Änderung über den Link, den wir dir geschickt haben.' });
      close();
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : 'E-Mail konnte nicht geändert werden.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <ExpandRow icon={Mail} title="E-Mail-Adresse ändern" open={open} onToggle={() => { setFeedback(null); setOpen(true); }} divider>
      {open ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Neue E-Mail-Adresse"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            accessibilityLabel="Neue E-Mail-Adresse"
            onSubmitEditing={() => void save()}
            style={styles.input}
          />
          <View style={styles.actions}>
            <Button label="Speichern" size="sm" loading={busy} onPress={() => void save()} style={styles.flex} />
            <Button label="Abbrechen" size="sm" variant="secondary" onPress={close} style={styles.flex} />
          </View>
        </>
      ) : null}
      {feedback ? <AppText variant="small" tone={feedback.tone} accessibilityLiveRegion="polite" style={!open && styles.rowNote}>{feedback.text}</AppText> : null}
    </ExpandRow>
  );
}

function Segmented({ value, onChange }: { value: 'signin' | 'signup'; onChange: (v: 'signin' | 'signup') => void }) {
  const items: ['signin' | 'signup', string][] = [
    ['signin', 'Anmelden'],
    ['signup', 'Konto erstellen'],
  ];
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {items.map(([id, label]) => (
        <Pressable
          key={id}
          onPress={() => onChange(id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === id }}
          style={[styles.segment, value === id && styles.segmentOn]}>
          <AppText variant="bodyStrong" tone={value === id ? 'primary' : 'secondary'}>{label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function SignInForm({ cloud }: { cloud: CloudSync }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { control, handleSubmit, formState, getValues } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const submit = handleSubmit(async ({ email, password }) => {
    setError(null);
    setNotice(null);
    if (mode === 'signup' && password !== confirmPassword) return setError('Die Passwörter stimmen nicht überein.');
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
      setNotice('Wir haben dir einen Link geschickt. Er öffnet GymQuest und fragt direkt nach deinem neuen Passwort.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'E-Mail konnte nicht gesendet werden.');
    }
  };

  const google = async () => {
    setError(null);
    try {
      await cloud.signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung mit Google fehlgeschlagen.');
    }
  };

  return (
    <Card style={styles.form}>
      <Segmented value={mode} onChange={switchMode} />
      {cloud.googleAvailable ? (
        <>
          <Button label="Mit Google fortfahren" variant="secondary" onPress={() => void google()} fullWidth />
          <AppText variant="small" tone="secondary" align="center">oder mit E-Mail</AppText>
        </>
      ) : null}
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
          <PasswordInput
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="Passwort"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            accessibilityLabel="Passwort"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      {formState.errors.password ? <AppText variant="small" tone="error">{formState.errors.password.message}</AppText> : null}
      {mode === 'signup' ? (
        <>
          <PasswordInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Passwort wiederholen"
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel="Passwort wiederholen"
            onSubmitEditing={() => void submit()}
          />
          <AppText variant="small" tone="secondary">Mindestens 8 Zeichen.</AppText>
        </>
      ) : null}
      <Button label={mode === 'signin' ? 'Anmelden' : 'Konto erstellen'} loading={formState.isSubmitting} onPress={() => void submit()} fullWidth />
      {notice ? <AppText variant="small" tone="accent" accessibilityLiveRegion="polite">{notice}</AppText> : null}
      {error ? <AppText variant="small" tone="error" accessibilityRole="alert">{error}</AppText> : null}
      {mode === 'signin' ? <Button label="Passwort vergessen?" variant="ghost" size="sm" onPress={() => void resetPassword()} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  gap: { gap: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  sub: { marginTop: -spacing.sm },
  benefits: { flexDirection: 'row', gap: spacing.sm },
  benefit: { flex: 1, alignItems: 'center', gap: spacing.xs },
  benefitIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  form: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 52 },
  rowNote: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  expanded: { gap: spacing.md, padding: spacing.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  danger: { borderColor: 'rgba(255,107,107,0.3)' },
  segmented: { flexDirection: 'row', backgroundColor: colors.cardSecondary, borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, minHeight: MIN_TOUCH - 4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.card },
  inputWrap: { justifyContent: 'center' },
  inputWithIcon: { paddingRight: 52 },
  eye: { position: 'absolute', right: 4, width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
  },
});
