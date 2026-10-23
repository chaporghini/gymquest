import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { RemoteRecord, RemoteStore } from './engine';
import type { SyncKind } from './meta';
import type { SyncRecord } from './records';
import { getAuthStorage } from './authStorage';
import { RECORDS_TABLE, SUPABASE_KEY, SUPABASE_URL } from './config';

let client: SupabaseClient | null = null;

/** Der Supabase-Client, oder null, wenn keine Zugangsdaten konfiguriert sind. */
export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: getAuthStorage(),
      persistSession: true,
      autoRefreshToken: true,
      // Bestätigungslinks aus der E-Mail melden im Browser direkt an.
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return client;
}

interface Row {
  kind: SyncKind;
  id: string;
  data: unknown;
  modified_at: string;
  updated_at: string;
}

const PAGE_SIZE = 500;
const UPSERT_CHUNK = 200;

export class SupabaseRemoteStore implements RemoteStore {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string,
  ) {}

  async fetchChanges(since: string | null): Promise<RemoteRecord[]> {
    const out: RemoteRecord[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = this.supabase
        .from(RECORDS_TABLE)
        .select('kind,id,data,modified_at,updated_at')
        .order('updated_at', { ascending: true })
        .order('kind', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (since) query = query.gt('updated_at', since);
      const { data, error } = await query;
      if (error) throw toError(error);
      const rows = (data ?? []) as Row[];
      for (const r of rows) out.push({ kind: r.kind, id: r.id, data: r.data, modifiedAt: r.modified_at, updatedAt: r.updated_at });
      if (rows.length < PAGE_SIZE) return out;
    }
  }

  async upsert(records: SyncRecord[]) {
    for (let i = 0; i < records.length; i += UPSERT_CHUNK) {
      const rows = records.slice(i, i + UPSERT_CHUNK).map((r) => ({
        user_id: this.userId,
        kind: r.kind,
        id: r.id,
        data: r.data,
        modified_at: r.modifiedAt,
      }));
      const { error } = await this.supabase.from(RECORDS_TABLE).upsert(rows, { onConflict: 'user_id,kind,id' });
      if (error) throw toError(error);
    }
  }

  async deleteAll() {
    const { error } = await this.supabase.from(RECORDS_TABLE).delete().eq('user_id', this.userId);
    if (error) throw toError(error);
  }
}

function toError(error: { message: string; code?: string }): Error {
  if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message)) {
    return new Error('Die Tabelle in Supabase fehlt. Bitte supabase/schema.sql im SQL Editor ausführen (siehe Anleitung).');
  }
  return new Error(error.message);
}

/** Übersetzt typische Anmeldefehler von Supabase ins Deutsche. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid api key')) return 'Die App ist mit einem ungültigen Supabase-Schlüssel gebaut. Das liegt nicht an deinen Eingaben.';
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (m.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungsmail.';
  if (m.includes('user already registered')) return 'Für diese E-Mail gibt es schon ein Konto. Bitte melde dich an.';
  if (m.includes('password should be at least')) return 'Das Passwort ist zu kurz.';
  if (m.includes('should be different from the old password')) return 'Das neue Passwort muss sich vom alten unterscheiden.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Keine Verbindung zum Server. Bist du online?';
  return message;
}
