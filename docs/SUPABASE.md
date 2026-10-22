# Spätere Supabase-Anbindung

**Status: nicht eingerichtet.** Die App nutzt `LocalOnlySyncAdapter` (`src/data/sync.ts`), der absichtlich nichts tut. Es sind keine Zugangsdaten im Projekt.

## Vorgehen

1. Supabase-Projekt anlegen, E-Mail- oder Apple-Login aktivieren.
2. `.env` anlegen (nicht committen):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   ```
3. `npx expo install @supabase/supabase-js` und einen `SupabaseSyncAdapter` implementieren, der `SyncAdapter` erfüllt. In `createSyncAdapter()` zurückgeben, wenn beide Variablen gesetzt sind.
4. Login-Screen ergänzen; lokale Daten beim ersten Login hochladen.

## Vorgeschlagenes Schema (PostgreSQL)

```sql
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table plans (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  data jsonb not null,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

create table workout_sessions (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  plan_day_id text,
  name text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_sec int not null,
  xp_earned int not null
);

create table set_logs (
  id bigserial primary key,
  session_id text not null references workout_sessions on delete cascade,
  exercise_id text not null,
  set_index int not null,
  reps int,
  weight_kg numeric,
  duration_sec int,
  completed boolean not null
);

create table xp_events (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  source text not null,
  ref_id text not null,
  amount int not null,
  label text not null,
  created_at timestamptz not null,
  unique (user_id, source, ref_id)
);

-- Row Level Security: jede Person sieht nur ihre eigenen Daten
alter table profiles enable row level security;
alter table plans enable row level security;
alter table workout_sessions enable row level security;
alter table set_logs enable row level security;
alter table xp_events enable row level security;

create policy "own" on profiles for all using (auth.uid() = user_id);
create policy "own" on plans for all using (auth.uid() = user_id);
create policy "own" on workout_sessions for all using (auth.uid() = user_id);
create policy "own" on xp_events for all using (auth.uid() = user_id);
create policy "own" on set_logs for all using (
  exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid())
);
```

## Sync-Strategie

- Lokale Tabellen haben eine Spalte `synced_at`. `push()` lädt alle Zeilen mit `synced_at IS NULL` hoch und setzt danach den Zeitstempel.
- Trainings und XP-Ereignisse werden nur angehängt, nie geändert → konfliktfrei.
- Profil und Plan: „last write wins“ über `updated_at`.
- XP werden serverseitig nicht neu berechnet; die Eindeutigkeit `(user_id, source, ref_id)` verhindert doppelte Belohnungen.
