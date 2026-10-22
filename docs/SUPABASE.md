# Supabase-Abgleich: technische Details

Einrichtung für Endnutzer: siehe [ANLEITUNG.md](ANLEITUNG.md). Diese Seite beschreibt, wie der Abgleich funktioniert.

## Datenmodell

Eine Tabelle `public.gymquest_records` ([supabase/schema.sql](../supabase/schema.sql)) mit einer Zeile pro Datensatz:

| Spalte | Bedeutung |
| --- | --- |
| `user_id` | Konto (`auth.uid()`), Teil des Primärschlüssels |
| `kind` | `profile`, `settings`, `plan`, `session`, `xp` |
| `id` | `main` bei Profil/Einstellungen/Plan, Trainings-ID, bei XP `quelle:referenz` (z. B. `quest:weekly_workouts:2026-W43`) |
| `data` | Der Datensatz als JSON, genau wie in der App (`src/domain/types.ts`) |
| `modified_at` | Änderungszeitpunkt auf dem Gerät |
| `updated_at` | Serverzeit, wird per Trigger gesetzt; Grundlage für „was ist neu seit …“ |

Row Level Security: Jede angemeldete Person kann nur Zeilen mit ihrer eigenen `user_id` lesen, anlegen, ändern und löschen. Ein Trigger verwirft Updates mit älterem `modified_at`, damit ein Gerät mit veraltetem Stand nichts Neueres überschreibt.

## Ablauf (`src/data/sync/engine.ts`, `syncOnce`)

1. **Merken:** Die App schreibt nur über `TrackingRepository`. Jede Änderung wird in den Metadaten (`meta:sync`) als „noch hochzuladen“ markiert.
2. **Holen:** Alle Zeilen mit `updated_at` nach dem letzten Stand (mit einer Minute Überlappung) werden geladen und zusammengeführt:
   - Trainings: fehlende werden ergänzt (Trainings ändern sich nach dem Abschluss nicht).
   - XP: fehlende werden ergänzt; dieselbe Belohnung (gleiche Quelle + Referenz) gibt es nur einmal.
   - Profil, Einstellungen, Plan: der neuere `modified_at` gewinnt. Beim **ersten** Abgleich eines Geräts mit einem Konto gewinnt die Cloud, damit ein versehentliches Onboarding auf dem neuen Gerät den echten Plan nicht ersetzt.
3. **Hochladen:** Beim ersten Abgleich alles, danach nur markierte Datensätze (`upsert`).

Das laufende Training wird bewusst nicht übertragen; erst das beendete Training.

Ausgelöst wird ein Abgleich in `src/state/useCloudSync.ts`: nach der Anmeldung, 2 s nach jeder Änderung, beim Zurückkehren in die App, beim Wiederherstellen der Verbindung und alle 5 Minuten.

## Konfiguration

`EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_KEY` (Publishable/anon key) in `.env` oder als GitHub-Variablen `SUPABASE_URL`/`SUPABASE_KEY`. Fehlen sie, zeigt die App „Cloud-Sync ist nicht eingerichtet“ und arbeitet nur lokal.

## Tests

`src/data/__tests__/sync.test.ts` simuliert zwei Geräte und einen Server mit demselben Verhalten wie die Tabelle samt Trigger (Offline-Phasen, Konflikte, doppelte Belohnungen, erste Anmeldung, Backup).
