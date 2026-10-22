# GYMQUEST

Fitness-App mit RPG-Elementen: Durch regelmäßiges, sicheres Training sammelst du XP, steigst im Level auf, schaltest Ränge frei und erfüllst Wochenquests und Achievements.

Die App funktioniert **offline und ohne Konto** vollständig. Optional gleicht sie über ein Supabase-Konto zwischen iPhone und MacBook ab, und sie lässt sich als **installierbare Web-App** (Homescreen/Dock) über GitHub Pages veröffentlichen.

**➜ Einrichtung als App auf iPhone und Mac, Schritt für Schritt: [docs/ANLEITUNG.md](docs/ANLEITUNG.md)**

Zugangsdaten stehen nie im Code; sie kommen aus `.env` (lokal) bzw. GitHub-Variablen (siehe `.env.example`).

---

## Auf dem MacBook starten

### 1. Voraussetzungen (einmalig)

- **Node.js 22.13 oder neuer** (z. B. aktuelle LTS). Prüfen mit `node -v`.
  Installation z. B. über <https://nodejs.org> oder `brew install node`.
- Für das iPhone: die App **Expo Go** aus dem App Store (aktuelle Version, unterstützt Expo SDK 58).
- Optional für den iOS-Simulator: **Xcode** aus dem Mac App Store (einmal öffnen und die iOS-Simulator-Komponente installieren).

### 2. Projekt installieren

```bash
cd gymquest
npm install
```

### 3. Starten – drei Möglichkeiten

| Wie | Befehl | Hinweis |
| --- | --- | --- |
| **Im Browser auf dem Mac** (am schnellsten) | `npm run web` | Öffnet <http://localhost:8081>. Daten bleiben im Browser gespeichert. |
| **Als installierbare Web-App bauen** | `npm run build:web` | Ergebnis in `dist/`. Veröffentlichen automatisch per GitHub Actions, siehe Anleitung. |
| **Auf dem iPhone mit Expo Go** | `npm start` | QR-Code mit der iPhone-Kamera scannen. iPhone und Mac müssen im selben WLAN sein. |
| **Im iOS-Simulator** | `npm run ios` | Benötigt Xcode. Alternativ `npm start` und dann `i` drücken. |

Beenden mit `Ctrl + C` im Terminal.

> Falls Expo Go meldet, dass die SDK-Version nicht passt: Expo Go im App Store aktualisieren.
> Falls der QR-Code im WLAN nicht funktioniert (z. B. Firmennetz): `npx expo start --tunnel`.

### 4. Tests und Prüfungen

```bash
npm test          # 54 Tests: XP, Level, Planerstellung, Quests, Trainingsablauf, Sync, Backup
npm run typecheck # TypeScript
npm run lint      # ESLint
```

---

## Funktionen

- **Onboarding** (überspringbar): Spielername, Erfahrung, Ziel, Tage/Woche, Trainingsdauer, Equipment, optionale Einschränkungen und Übungen, die vermieden werden sollen. Alter, Größe und Körpergewicht sind freiwillig (mit Erklärung, wofür sie genutzt werden; jederzeit änder- und löschbar).
- **Automatischer Trainingsplan** über `generateTrainingPlan(profile, exerciseLibrary)` – regelbasiert, ohne KI-API. Berücksichtigt Erholungstage, Erfahrung (Anfänger bekommen max. 3 Krafttage, weitere Tage werden zu aktiver Erholung), Ziel (Wiederholungen/Pausen), Zeitbudget, Equipment und Einschränkungen.
- **Home-Dashboard**: Begrüßung, Rang und Level, XP-Balken mit fehlenden XP, nächste Einheit mit geschätzter Dauer, Wochenfortschritt, aktive Quests, letzte Achievements, Schnellzugriffe.
- **Trainingsplan**: Wochenübersicht mit Ruhetagen, Tage verschieben/hinzufügen/entfernen, Übungen tauschen, sortieren, Sätze/Wiederholungen/Pausen ändern.
- **Geführter Trainingsmodus**: Satzprotokoll mit Wiederholungen und Gewicht (Vorschläge vom letzten Training), Pausentimer mit ±15 s und Überspringen, Display bleibt an, Vibration (iPhone). Das laufende Training wird bei jeder Eingabe gespeichert – es übersteht Tab-Wechsel, App-Wechsel und sogar einen Neustart. Ein Banner über der Tab-Leiste führt zurück.
- **Übungsbibliothek**: 41 Übungen mit Anleitung, Tipps und Hinweisen zu Belastungen; Suche und Filter (Muskelgruppe, Art, eigenes Equipment).
- **Quests, Achievements, Ränge**: 4 Wochenquests, 13 Achievements, 7 Ränge (Rekrut bis Legende), Level-up-Animation.
- **Intelligentes Trainingssystem** (`src/domain/training/`, regelbasiert, ohne KI-API):
  - `recommendPrescription`: Sätze, Wiederholungsbereich, Pause und Reserve (RIR) je Übung nach Ziel, Übungsart, Erfahrung, Trainingstagen und Alter.
  - `recommendExerciseLoad`: Gewichtsempfehlung je Übung mit Status *ermitteln / beibehalten / kleine Steigerung / reduzieren / pausieren*, Begründung und Hinweisen. Grundlage ist nur die eigene Leistung bei genau dieser Übung (Körpergewicht/Größe werden nie umgerechnet). Steigerung erst am oberen Ende des Bereichs und bei passender Anstrengung, in den Gewichtsstufen des Geräts (einstellbar). Keine Steigerung bei Beschwerden, unsicherer Technik, schlechter Tagesform oder ungewöhnlich vielen Trainings; nach Pausen vorsichtiger Wiedereinstieg. Minderjährige und ab 65: zwei bestätigende Einheiten, mehr Reserve, keine Maximalversuche.
  - Im Training: Empfehlung je Übung, vorbelegte Gewichte, Tagesform (1–5) und je Übung Anstrengung, „Technik unsicher“ und „Beschwerden“.
  - `analyzeWeeklyProgress`, `analyzeMonthlyProgress`, `getExerciseProgress`, `detectPossiblePlateau`, `recommendNextWorkout`: Grundlage für **„Dein Fortschritt“** (Wochen- und Monatsbericht mit Vergleich zum gleichen Zeitraum des Vormonats, vorläufig gekennzeichnet, und „Dein nächster Schritt“).
- **Statistiken**: Kennzahlen; Diagramme für Trainings/Sätze/Dauer pro Woche, Trainings/Dauer pro Monat, Verlauf je Übung (Gewicht oder Wiederholungen), XP und Level, Körpergewicht; Bestleistungen, Trainingshistorie mit Details.
- **Profil & Einstellungen**: Profil bearbeiten und Plan neu erstellen, Körperdaten löschen, Gewichtsstufen je Gerät, haptisches Feedback, feste Pausenzeit, alle Daten löschen.
- **Konto & Sync** (optional, Supabase): Registrieren/Anmelden mit E-Mail, automatischer Abgleich im Hintergrund, offline zuerst. Trainings und XP werden zusammengeführt, bei Profil/Einstellungen/Plan gewinnt der neuere Stand.
- **Backup**: Export aller Daten als JSON-Datei, Einspielen ohne Datenverlust.
- **Installierbar (PWA)**: App-Symbol, Vollbild, Start ohne Internet per Service Worker.

### XP-Regeln (bewusst „sicher“)

- Training: 40 XP Basis + 4 XP pro abgeschlossenem Satz + 20 XP, wenn alle geplanten Sätze erledigt sind.
- Mehr als 30 Sätze bringen keine zusätzlichen XP; ab dem zweiten Training am selben Tag gibt es nur noch 25 %. So wird Regelmäßigkeit belohnt, nicht Übertraining.
- Level *n → n+1* kostet `100 + (n − 1) × 50` XP.
- Quests und Achievements geben Bonus-XP. Eine Datenbank-Regel (`UNIQUE(source, ref_id)`) verhindert doppelte Belohnungen.

---

## Architektur

```
src/
├── app/                 Screens (Expo Router, dateibasiert)
│   ├── (tabs)/          Home, Training, Quests, Stats, Profil
│   ├── onboarding.tsx
│   ├── workout/         Aktives Training (Vollbild) und Auswertung
│   ├── plan/            Plan- und Einheiten-Editor
│   ├── library/         Übungsbibliothek und Übungsdetails
│   ├── history/         Trainingsdetails
│   └── profile/         Profil bearbeiten
├── domain/              Reine Geschäftslogik, ohne UI und ohne Datenbank (getestet)
│   ├── xp.ts            Levelkurve, Training-XP
│   ├── ranks.ts
│   ├── planGenerator.ts generateTrainingPlan()
│   ├── progression.ts   Wochenstatistik, Quests, Achievements, Belohnungen
│   ├── workout.ts       Nächste Einheit, Trainingsablauf
│   ├── training/        Empfehlungen, Berichte, Diagrammdaten, Körperdaten (Analyse-Service)
│   └── profileSchema.ts Zod-Validierung für Onboarding/Profil
├── data/
│   ├── exercises.ts     Übungsbibliothek
│   ├── db/              SQLite-Schema, Migrationen, Repository
│   ├── browserRepository.ts  Speicherung im Browser (Web-App)
│   ├── backup.ts        Export/Import als JSON
│   └── sync/            Abgleich: Änderungs-Tracking, Zusammenführen, Supabase-Anbindung
├── state/               AppProvider (Domäne + Repository + UI), useCloudSync (Konto & Abgleich)
├── components/          Designsystem (Button, Card, ProgressBar, XPBar, LevelBadge, …)
├── theme/tokens.ts      Farben, Abstände, Typografie
└── i18n/labels.ts       Deutsche Bezeichnungen
```

- **Expo SDK 58**, React Native, TypeScript, Expo Router
- **expo-sqlite** für die dauerhafte lokale Speicherung auf iPhone/Android (Tabellen `workout_sessions`, `set_logs`, `xp_events`, `plans`, `kv`); in der Web-App **localStorage**
- **Supabase** (`@supabase/supabase-js`) für Konto und Abgleich, Schema in `supabase/schema.sql`, Details in [docs/SUPABASE.md](docs/SUPABASE.md)
- **PWA**: `scripts/build-web.mjs` ergänzt Manifest, Icons und Service Worker; `.github/workflows/deploy-web.yml` veröffentlicht auf GitHub Pages
- **React Hook Form + Zod** für Formulare, **lucide-react-native** für Icons, **react-native-gifted-charts** für Diagramme
- **Jest (jest-expo)** für Tests

Die UI greift nur über das Interface `GymRepository` auf Daten zu; die Domänenfunktionen sind reine Funktionen und unabhängig testbar.

## Hinweise

- Das App-Symbol der Web-App liegt in `public/icons/`. Für eine native iOS-App (Expo) sind Icon und Splash noch die Expo-Platzhalter.
- GYMQUEST ersetzt keine medizinische Beratung.
