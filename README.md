# GYMQUEST

Fitness-App mit RPG-Elementen: Durch regelmäßiges, sicheres Training sammelst du XP, steigst im Level auf, schaltest Ränge frei und erfüllst Wochenquests und Achievements.

Die App läuft **vollständig lokal** (SQLite). Es gibt keinen Server und keine erfundenen Zugangsdaten. Eine spätere Synchronisierung mit Supabase ist als Schnittstelle vorbereitet (siehe [docs/SUPABASE.md](docs/SUPABASE.md)).

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
| **Auf dem iPhone mit Expo Go** | `npm start` | QR-Code mit der iPhone-Kamera scannen. iPhone und Mac müssen im selben WLAN sein. |
| **Im iOS-Simulator** | `npm run ios` | Benötigt Xcode. Alternativ `npm start` und dann `i` drücken. |

Beenden mit `Ctrl + C` im Terminal.

> Falls Expo Go meldet, dass die SDK-Version nicht passt: Expo Go im App Store aktualisieren.
> Falls der QR-Code im WLAN nicht funktioniert (z. B. Firmennetz): `npx expo start --tunnel`.

### 4. Tests und Prüfungen

```bash
npm test          # 35 Tests für XP, Level, Planerstellung, Quests, Trainingsablauf
npm run typecheck # TypeScript
npm run lint      # ESLint
```

---

## Funktionen

- **Onboarding** (überspringbar): Spielername, Erfahrung, Ziel, Tage/Woche, Trainingsdauer, Equipment, optionale Einschränkungen und Übungen, die vermieden werden sollen. Körpergewicht ist freiwillig.
- **Automatischer Trainingsplan** über `generateTrainingPlan(profile, exerciseLibrary)` – regelbasiert, ohne KI-API. Berücksichtigt Erholungstage, Erfahrung (Anfänger bekommen max. 3 Krafttage, weitere Tage werden zu aktiver Erholung), Ziel (Wiederholungen/Pausen), Zeitbudget, Equipment und Einschränkungen.
- **Home-Dashboard**: Begrüßung, Rang und Level, XP-Balken mit fehlenden XP, nächste Einheit mit geschätzter Dauer, Wochenfortschritt, aktive Quests, letzte Achievements, Schnellzugriffe.
- **Trainingsplan**: Wochenübersicht mit Ruhetagen, Tage verschieben/hinzufügen/entfernen, Übungen tauschen, sortieren, Sätze/Wiederholungen/Pausen ändern.
- **Geführter Trainingsmodus**: Satzprotokoll mit Wiederholungen und Gewicht (Vorschläge vom letzten Training), Pausentimer mit ±15 s und Überspringen, Display bleibt an, Vibration (iPhone). Das laufende Training wird bei jeder Eingabe gespeichert – es übersteht Tab-Wechsel, App-Wechsel und sogar einen Neustart. Ein Banner über der Tab-Leiste führt zurück.
- **Übungsbibliothek**: 41 Übungen mit Anleitung, Tipps und Hinweisen zu Belastungen; Suche und Filter (Muskelgruppe, Art, eigenes Equipment).
- **Quests, Achievements, Ränge**: 4 Wochenquests, 13 Achievements, 7 Ränge (Rekrut bis Legende), Level-up-Animation.
- **Statistiken**: Kennzahlen, Diagramm der letzten 8 Wochen (Trainings, Sätze, Minuten), Bestleistungen, Trainingshistorie mit Details.
- **Profil & Einstellungen**: Profil bearbeiten und Plan neu erstellen, haptisches Feedback, feste Pausenzeit, alle Daten löschen.

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
│   └── profileSchema.ts Zod-Validierung für Onboarding/Profil
├── data/
│   ├── exercises.ts     Übungsbibliothek
│   ├── db/              SQLite-Schema, Migrationen, Repository
│   └── sync.ts          Sync-Schnittstelle (aktuell: nur lokal)
├── state/AppProvider.tsx  Verbindet Domäne, Repository und UI
├── components/          Designsystem (Button, Card, ProgressBar, XPBar, LevelBadge, …)
├── theme/tokens.ts      Farben, Abstände, Typografie
└── i18n/labels.ts       Deutsche Bezeichnungen
```

- **Expo SDK 58**, React Native, TypeScript, Expo Router
- **expo-sqlite** für die dauerhafte lokale Speicherung (Tabellen `workout_sessions`, `set_logs`, `xp_events`, `plans`, `kv`)
- **React Hook Form + Zod** für Formulare, **lucide-react-native** für Icons, **react-native-gifted-charts** für Diagramme
- **Jest (jest-expo)** für Tests

Die UI greift nur über das Interface `GymRepository` auf Daten zu; die Domänenfunktionen sind reine Funktionen und unabhängig testbar.

## Hinweise

- App-Icon und Splash-Bild sind noch die Expo-Platzhalter.
- GYMQUEST ersetzt keine medizinische Beratung.
