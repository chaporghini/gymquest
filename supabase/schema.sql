-- GYMQUEST: Tabelle für die Synchronisierung zwischen iPhone und MacBook.
-- Einmal komplett im Supabase SQL Editor ausführen (Dashboard → SQL Editor → New query → Run).
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.

create table if not exists public.gymquest_records (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text        not null check (kind in ('profile', 'settings', 'plan', 'session', 'xp')),
  id          text        not null,
  data        jsonb       not null,
  modified_at timestamptz not null,            -- Änderungszeitpunkt auf dem Gerät
  updated_at  timestamptz not null default now(), -- Serverzeit, für "was ist neu seit …"
  primary key (user_id, kind, id)
);

create index if not exists gymquest_records_user_updated_idx
  on public.gymquest_records (user_id, updated_at);

-- Jede Person sieht und ändert ausschließlich ihre eigenen Daten.
alter table public.gymquest_records enable row level security;

drop policy if exists "gymquest_select_own" on public.gymquest_records;
drop policy if exists "gymquest_insert_own" on public.gymquest_records;
drop policy if exists "gymquest_update_own" on public.gymquest_records;
drop policy if exists "gymquest_delete_own" on public.gymquest_records;

create policy "gymquest_select_own" on public.gymquest_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "gymquest_insert_own" on public.gymquest_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "gymquest_update_own" on public.gymquest_records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "gymquest_delete_own" on public.gymquest_records
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Serverzeit setzen und bei Profil/Einstellungen/Plan einen älteren Stand nicht über einen neueren schreiben.
create or replace function public.gymquest_records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.modified_at < old.modified_at then
    return null; -- älterer Stand: Änderung verwerfen
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gymquest_records_before_write on public.gymquest_records;
create trigger gymquest_records_before_write
  before insert or update on public.gymquest_records
  for each row execute function public.gymquest_records_before_write();

-- Konto vollständig löschen (DSGVO): löscht den Login der angemeldeten Person.
-- Ihre Datensätze in gymquest_records verschwinden dabei automatisch (on delete cascade).
create or replace function public.gymquest_delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.gymquest_delete_account() from public, anon;
grant execute on function public.gymquest_delete_account() to authenticated;
