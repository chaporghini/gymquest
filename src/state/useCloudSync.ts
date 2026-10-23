import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { forgetSyncState, readMeta, syncOnce, type TrackingRepository } from '@/data/sync';
import { SUPABASE_KEY, SUPABASE_URL } from '@/data/sync/config';
import { getSupabase, SupabaseRemoteStore, translateAuthError } from '@/data/sync/supabase';

export interface CloudUser {
  id: string;
  email: string;
}

export type CloudPhase = 'idle' | 'syncing' | 'offline' | 'error';

export interface CloudSync {
  /** false, wenn die App ohne Supabase-Zugangsdaten gebaut wurde. */
  configured: boolean;
  /** true, sobald bekannt ist, ob jemand angemeldet ist. */
  ready: boolean;
  user: CloudUser | null;
  phase: CloudPhase;
  message: string | null;
  lastSyncedAt: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** 'confirm-email', wenn Supabase erst eine Bestätigung per E-Mail verlangt. */
  signUp: (email: string, password: string) => Promise<'signed-in' | 'confirm-email'>;
  /** true, wenn in Supabase die Anmeldung mit Google aktiviert ist (nur Web). */
  googleAvailable: boolean;
  /** Leitet zur Google-Anmeldung weiter; danach kommt man angemeldet in die App zurück. */
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Schickt eine E-Mail mit Link; der Link meldet im Browser an, danach kann ein neues Passwort gesetzt werden. */
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  syncNow: () => Promise<void>;
  deleteCloudData: () => Promise<void>;
}

const AUTO_SYNC_DELAY_MS = 2_000;
const PERIODIC_SYNC_MS = 5 * 60_000;

function looksOffline(e: unknown) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|network request failed|networkerror|load failed|fetch failed/i.test(msg);
}

function redirectUrl() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
  // Startseite der Web-App, z. B. https://name.github.io/gymquest/
  return new URL('.', document.baseURI).href;
}

/**
 * Konto und Synchronisierung mit Supabase. Die App funktioniert ohne Konto und offline vollständig;
 * mit Konto werden Änderungen im Hintergrund abgeglichen.
 */
export function useCloudSync(repo: TrackingRepository, onLocalChanged: () => Promise<void>): CloudSync {
  const supabase = useMemo(() => getSupabase(), []);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [phase, setPhase] = useState<CloudPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [googleAvailable, setGoogleAvailable] = useState(false);
  const userRef = useRef<CloudUser | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const onLocalChangedRef = useRef(onLocalChanged);
  useEffect(() => {
    onLocalChangedRef.current = onLocalChanged;
  }, [onLocalChanged]);

  // Anmeldestatus verfolgen
  useEffect(() => {
    if (!supabase) return;
    const apply = (u: { id: string; email?: string } | null | undefined) => {
      const next = u ? { id: u.id, email: u.email ?? '' } : null;
      userRef.current = next;
      setUser((prev) => (prev?.id === next?.id && prev?.email === next?.email ? prev : next));
    };
    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session?.user))
      .catch(() => apply(null))
      .finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  // Google-Button nur zeigen, wenn der Anbieter in Supabase eingeschaltet ist.
  useEffect(() => {
    if (!supabase || Platform.OS !== 'web' || !SUPABASE_URL || !SUPABASE_KEY) return;
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { external?: { google?: boolean } } | null) => setGoogleAvailable(!!s?.external?.google))
      .catch(() => {});
  }, [supabase]);

  useEffect(() => {
    readMeta(repo.inner)
      .then((m) => setLastSyncedAt(m.lastSyncedAt))
      .catch(() => {});
  }, [repo]);

  const syncNow = useCallback(async () => {
    if (!supabase || !userRef.current) return;
    if (running.current) {
      again.current = true;
      return running.current;
    }
    const run = (async () => {
      do {
        again.current = false;
        const current = userRef.current;
        if (!current) break;
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) {
          // Ohne Netz gar nicht erst versuchen; das "online"-Ereignis stößt den Abgleich später an.
          setPhase('offline');
          setMessage('Offline – Änderungen werden später übertragen.');
          break;
        }
        setPhase('syncing');
        try {
          const result = await syncOnce(repo.inner, new SupabaseRemoteStore(supabase, current.id), current.id);
          setLastSyncedAt(result.syncedAt);
          setPhase('idle');
          setMessage(null);
          if (result.localChanged) await onLocalChangedRef.current();
        } catch (e) {
          const offline = looksOffline(e);
          setPhase(offline ? 'offline' : 'error');
          setMessage(offline ? 'Offline – Änderungen werden später übertragen.' : e instanceof Error ? e.message : String(e));
          break;
        }
      } while (again.current);
    })();
    running.current = run;
    try {
      await run;
    } finally {
      running.current = null;
    }
  }, [supabase, repo]);

  // Nach dem Anmelden sofort abgleichen
  useEffect(() => {
    if (user) void syncNow();
  }, [user, syncNow]);

  // Nach lokalen Änderungen (Training beendet, Plan geändert …) kurz warten und dann abgleichen
  useEffect(() => {
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    repo.setChangeListener(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncNow(), AUTO_SYNC_DELAY_MS);
    });
    return () => {
      repo.setChangeListener(null);
      if (timer) clearTimeout(timer);
    };
  }, [repo, supabase, syncNow]);

  // Beim Zurückkehren in die App, bei wiederhergestellter Verbindung und regelmäßig abgleichen
  useEffect(() => {
    if (!supabase) return;
    const appState = AppState.addEventListener('change', (state) => {
      if (Platform.OS !== 'web') {
        if (state === 'active') supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      }
      if (state === 'active') void syncNow();
    });
    const onOnline = () => void syncNow();
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('online', onOnline);
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void syncNow();
    }, PERIODIC_SYNC_MS);
    return () => {
      appState.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, [supabase, syncNow]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error('Cloud-Sync ist in dieser Version nicht eingerichtet.');
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(translateAuthError(error.message));
    },
    [supabase],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error('Cloud-Sync ist in dieser Version nicht eingerichtet.');
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectUrl() } });
      if (error) throw new Error(translateAuthError(error.message));
      return data.session ? 'signed-in' : 'confirm-email';
    },
    [supabase],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Cloud-Sync ist in dieser Version nicht eingerichtet.');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
    if (error) throw new Error(translateAuthError(error.message));
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await running.current?.catch(() => {});
    await supabase.auth.signOut({ scope: 'local' });
    await forgetSyncState(repo.inner);
    userRef.current = null;
    setUser(null);
    setPhase('idle');
    setMessage(null);
    setLastSyncedAt(null);
  }, [supabase, repo]);

  const sendPasswordReset = useCallback(
    async (email: string) => {
      if (!supabase) throw new Error('Cloud-Sync ist in dieser Version nicht eingerichtet.');
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
      if (error) throw new Error(translateAuthError(error.message));
    },
    [supabase],
  );

  const changePassword = useCallback(
    async (password: string) => {
      if (!supabase) return;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(translateAuthError(error.message));
    },
    [supabase],
  );

  const deleteCloudData = useCallback(async () => {
    const current = userRef.current;
    if (!supabase || !current) return;
    await running.current?.catch(() => {});
    await new SupabaseRemoteStore(supabase, current.id).deleteAll();
    await signOut();
  }, [supabase, signOut]);

  return { configured: !!supabase, ready, user, phase, message, lastSyncedAt, signIn, signUp, googleAvailable, signInWithGoogle, signOut, sendPasswordReset, changePassword, syncNow, deleteCloudData };
}
