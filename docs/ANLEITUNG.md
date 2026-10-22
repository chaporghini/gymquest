# GYMQUEST als App auf iPhone und MacBook – Einrichtung

Am Ende hast du:

- GYMQUEST als **App-Symbol auf dem iPhone-Homescreen** und **im Dock deines MacBooks**,
- die App startet **auch ohne Internet** (z. B. im Gym ohne Empfang),
- ein **Konto**, über das iPhone und MacBook dieselben Trainings, XP und denselben Plan haben, egal wo du bist.

Alles ist kostenlos (Supabase Free Plan, GitHub Pages). Du brauchst zwei Konten: **Supabase** (Datenbank + Anmeldung) und **GitHub** (Hosting der App). Rechne mit 20–30 Minuten.

> **Wichtig zu Zugangsdaten:** In die App gehören nur die **Project URL** und der **Publishable key** (beginnt mit `sb_publishable_…`, bei älteren Projekten heißt er „anon key“). Diese beiden sind für Apps gedacht und dürfen öffentlich sein; deine Daten schützt die Datenbank-Regel „Row Level Security“. **Niemals** weitergeben oder irgendwo eintragen: den **Secret key** / `service_role` key und das **Datenbank-Passwort**.

---

## Teil 1: Supabase (Datenbank und Anmeldung)

1. Öffne <https://supabase.com> und klicke auf **Start your project**. Registriere dich (am einfachsten mit „Continue with GitHub“, sobald du Teil 2 Schritt 1 erledigt hast, oder mit E-Mail).
2. Klicke auf **New project**:
   - **Name:** `gymquest`
   - **Database Password:** auf **Generate a password** klicken und im Passwort-Manager speichern (die App braucht es nicht).
   - **Region:** `Central EU (Frankfurt)`
   - **Plan:** Free → **Create new project**. Das Einrichten dauert 1–2 Minuten.
3. **Tabelle anlegen:** Links **SQL Editor** → **New query**. Den kompletten Inhalt der Datei [`supabase/schema.sql`](../supabase/schema.sql) hineinkopieren → **Run**. Erwartet: „Success. No rows returned“.
4. **Adresse der App eintragen:** Links **Authentication** → **URL Configuration**:
   - **Site URL:** `https://DEIN-GITHUB-NAME.github.io/gymquest/`
     (den GitHub-Namen legst du in Teil 2 fest; du kannst das auch danach eintragen)
   - Unter **Redirect URLs** dieselbe Adresse hinzufügen.
   - Dorthin führt der Bestätigungslink in der E-Mail nach der Registrierung.
5. **Werte für die App kopieren:**
   - **Project URL:** Oben auf **Connect** klicken (oder **Project Settings → Data API**), z. B. `https://abcdefgh.supabase.co`.
   - **Publishable key:** **Project Settings → API Keys** → Zeile „Publishable key“ kopieren.

   Beide brauchst du in Teil 2, Schritt 5.

E-Mail-Anmeldung ist bei Supabase schon eingeschaltet. Lass „Confirm email“ an: Nach dem Registrieren bekommst du eine Mail mit Bestätigungslink.

---

## Teil 2: GitHub (Hosting der App)

1. Konto anlegen auf <https://github.com/signup>. Dein Benutzername wird Teil der App-Adresse: `https://BENUTZERNAME.github.io/gymquest/`.
2. **Repository anlegen:** Oben rechts **+** → **New repository**
   - **Repository name:** `gymquest`
   - **Public** auswählen (GitHub Pages ist im kostenlosen Plan nur für öffentliche Repositories verfügbar. Im Code stehen keine geheimen Zugangsdaten.)
   - Kein README, keine .gitignore, keine Lizenz hinzufügen → **Create repository**.
3. **Code hochladen.** Zwei Wege:
   - **Am einfachsten:** GitHub mit Claude verbinden (<https://claude.ai/connect-github>) und die Claude GitHub App für das Repository `gymquest` installieren. Dann sag Bescheid, und Claude lädt den Code hoch.
   - **Selbst vom Mac:** ZIP entpacken, im Terminal:
     ```bash
     cd gymquest
     git init -b main
     git add -A
     git commit -m "GYMQUEST"
     git remote add origin https://github.com/BENUTZERNAME/gymquest.git
     git push -u origin main
     ```
     (GitHub fragt nach Anmeldung. Alternativ mit der App „GitHub Desktop“: *Add Existing Repository* → *Publish*.)
4. **Pages einschalten:** Im Repository **Settings → Pages** → bei **Build and deployment → Source** „**GitHub Actions**“ wählen.
5. **Supabase-Werte hinterlegen:** **Settings → Secrets and variables → Actions** → Reiter **Variables** → **New repository variable**:
   - Name `SUPABASE_URL`, Wert: deine Project URL
   - Name `SUPABASE_KEY`, Wert: dein Publishable key
6. **Veröffentlichen:** Reiter **Actions** → „Web-App veröffentlichen“ → **Run workflow**. (Läuft danach bei jedem neuen Code automatisch.) Nach 3–5 Minuten ist der Lauf grün und die App ist erreichbar unter
   **`https://BENUTZERNAME.github.io/gymquest/`**

---

## Teil 3: Installieren

### iPhone (16, iOS 18 oder neuer)

1. Die Adresse in **Safari** öffnen.
2. Unten auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm**. Falls angezeigt, „Als Web-App öffnen“ eingeschaltet lassen → **Hinzufügen**.
3. GYMQUEST über das neue Symbol starten. Die App läuft im Vollbild ohne Safari-Leisten.

### MacBook

- **Safari** (macOS Sonoma oder neuer): Adresse öffnen → Menü **Ablage → Zum Dock hinzufügen**.
- **Chrome:** Adresse öffnen → rechts in der Adressleiste auf das Installieren-Symbol klicken (oder Menü ⋮ → *Streamen, speichern und teilen → Seite als App installieren*).

### Konto einrichten (einmal pro Gerät)

1. Auf dem ersten Gerät: **Profil → Konto & Daten → Konto erstellen**, E-Mail und Passwort (mind. 8 Zeichen) eingeben.
2. Den Link in der Bestätigungsmail antippen. Danach in der App **Anmelden**.
3. Auf dem zweiten Gerät: Im Onboarding unten auf **„Schon auf einem anderen Gerät gespielt? Anmelden“** tippen (oder später über Profil → Konto & Daten). Profil, Plan, Trainings und XP werden übernommen.

**Wichtig:** Die Homescreen-App auf dem iPhone hat ihren eigenen Speicher, getrennt von Safari. Melde dich also **in der installierten App** an, nicht im Safari-Tab.

---

## So funktioniert der Abgleich

- Alles wird **zuerst auf dem Gerät** gespeichert. Ohne Internet läuft die App normal weiter.
- Mit Internet gleicht die App automatisch ab: beim Start, nach jedem beendeten Training oder jeder Planänderung (nach 2 Sekunden), beim Zurückkehren in die App, wenn die Verbindung zurückkommt, und alle 5 Minuten.
- Trainings und XP beider Geräte werden **zusammengeführt**. Quest-Belohnungen gibt es auch dann nur einmal, wenn beide Geräte sie offline vergeben haben.
- Bei Profil, Einstellungen und Trainingsplan gilt der **zuletzt geänderte Stand**.
- Ein laufendes Training bleibt auf dem Gerät, auf dem es läuft. Erst das beendete Training wird übertragen.
- Den Status siehst du unter **Profil → Konto & Daten**. Dort gibt es auch „Jetzt synchronisieren“.

## Backup

**Profil → Konto & Daten → Backup exportieren** speichert alle Daten als `.json`-Datei. Auf dem iPhone öffnet sich das Teilen-Menü, z. B. „In Dateien sichern“ oder per AirDrop an den Mac. **Backup einspielen** ergänzt fehlende Trainings und XP, ohne etwas zu löschen.

## Updates

Wenn neuer Code veröffentlicht wird, lädt die App die neue Version beim nächsten Start im Hintergrund. Spätestens beim übernächsten Start läuft sie.

## Gut zu wissen

- **Supabase Free:** Projekte ohne Aktivität werden nach etwa einer Woche pausiert. Die App funktioniert dann weiter (offline), nur der Abgleich pausiert. Im Supabase-Dashboard auf **Restore project** klicken. Bei regelmäßigem Training passiert das normalerweise nicht.
- **„Alle Daten löschen“** (Profil) löscht nur dieses Gerät und meldet ab; die Cloud bleibt. **„Cloud-Daten löschen“** (Konto & Daten) löscht die Cloud-Kopie und meldet ab; die Geräte behalten ihre Daten.
- **Passwort vergessen:** Beim Anmelden auf „Passwort vergessen?“ tippen. Der Link in der E-Mail öffnet GYMQUEST im Browser und meldet dich dort an; unter Profil → Konto & Daten → „Passwort ändern“ ein neues setzen und dich damit in der installierten App anmelden.

## Weiterhin lokal entwickeln

```bash
cp .env.example .env     # Project URL und Publishable key eintragen
npm install
npm run web              # im Browser, http://localhost:8081
npm start                # iPhone mit Expo Go (gleiches WLAN)
npm run build:web        # Web-App nach dist/ bauen (wie auf GitHub)
```

Für `npm run web` in Supabase unter *Redirect URLs* zusätzlich `http://localhost:8081` eintragen.
