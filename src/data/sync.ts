// Schnittstelle für eine spätere Synchronisierung mit Supabase.
//
// Aktuell ist KEIN Backend angebunden: Die App arbeitet vollständig lokal mit SQLite.
// `LocalOnlySyncAdapter` ist die klar gekennzeichnete Entwicklungsimplementierung und tut nichts.
// Wie eine Supabase-Implementierung aussehen soll, steht in docs/SUPABASE.md.

export type SyncStatus =
  | { state: 'local-only'; message: string }
  | { state: 'idle'; lastSyncedAt: string | null }
  | { state: 'syncing' }
  | { state: 'error'; message: string };

export interface SyncAdapter {
  readonly name: string;
  /** true, sobald echte Zugangsdaten konfiguriert sind. */
  isConfigured(): boolean;
  /** Lädt lokale, noch nicht synchronisierte Datensätze hoch (synced_at IS NULL). */
  push(): Promise<void>;
  /** Holt Änderungen anderer Geräte und schreibt sie in die lokale Datenbank. */
  pull(): Promise<void>;
  status(): SyncStatus;
}

export class LocalOnlySyncAdapter implements SyncAdapter {
  readonly name = 'Nur lokal (Entwicklung)';

  isConfigured() {
    return false;
  }

  async push() {
    // Absichtlich leer: kein Backend konfiguriert.
  }

  async pull() {
    // Absichtlich leer: kein Backend konfiguriert.
  }

  status(): SyncStatus {
    return { state: 'local-only', message: 'Deine Daten werden nur auf diesem Gerät gespeichert.' };
  }
}

export function createSyncAdapter(): SyncAdapter {
  // Später: Wenn EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY gesetzt sind,
  // hier einen SupabaseSyncAdapter zurückgeben.
  return new LocalOnlySyncAdapter();
}
