// Baut GYMQUEST als installierbare Web-App (PWA) nach dist/.
//
//   npm run build:web
//
// Umgebungsvariablen (optional):
//   GYMQUEST_BASE_URL          Unterpfad, z. B. "/gymquest" für https://name.github.io/gymquest/
//   EXPO_PUBLIC_SUPABASE_URL   Supabase Project URL (ohne = nur lokal + Backup-Datei)
//   EXPO_PUBLIC_SUPABASE_KEY   Supabase publishable/anon key
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const base = `${(process.env.GYMQUEST_BASE_URL || '').replace(/\/+$/, '')}/`;

rmSync(dist, { recursive: true, force: true });
const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist', '--clear'], {
  cwd: root,
  stdio: 'inherit',
  // Build-Zeitpunkt wird im Profil angezeigt, damit man sieht, ob die neue Version läuft.
  env: { ...process.env, EXPO_PUBLIC_BUILD_TIME: process.env.EXPO_PUBLIC_BUILD_TIME || new Date().toISOString() },
});
if (result.status !== 0) process.exit(result.status ?? 1);

// 1. index.html: Sprache, App-Meta-Tags, Manifest, Icons, Service Worker
const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');
html = html.replace('<html lang="en">', '<html lang="de">');
// viewport-fit=cover: Sonst meldet iOS in der Homescreen-App keine sicheren Bereiche (env(safe-area-inset-*)),
// und die Tab-Leiste liegt unter dem Home-Balken.
html = html.replace(/<meta name="viewport" content="[^"]*"\s*\/?>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
const head = `
    <meta name="description" content="Fitness-RPG: Trainingsplan, XP, Level, Quests und Ränge." />
    <meta name="theme-color" content="#090B0A" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="GymQuest" />
    <link rel="manifest" href="${base}manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${base}icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="${base}icons/favicon-48.png" />
    <link rel="preload" href="${base}fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin />
    <style>@font-face { font-family: 'Inter'; font-style: normal; font-display: swap; font-weight: 100 900; src: url('${base}fonts/inter-latin.woff2') format('woff2-variations'), url('${base}fonts/inter-latin.woff2') format('woff2'); }</style>
    <style>html, body { background-color: #090B0A; color-scheme: dark; }</style>
    <script>
      if ('serviceWorker' in navigator) {
        // Hatte die Seite schon einen Service Worker, wird beim Wechsel auf eine neue Version einmal neu geladen.
        var hadController = !!navigator.serviceWorker.controller;
        var reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (!hadController || reloaded) return;
          reloaded = true;
          window.location.reload();
        });
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('${base}sw.js', { scope: '${base}' }).then(function (reg) {
            // iOS hält Homescreen-Apps lange im Hintergrund: beim Zurückkehren nach Updates schauen.
            document.addEventListener('visibilitychange', function () {
              if (document.visibilityState === 'visible') reg.update().catch(function () {});
            });
          }).catch(function (e) { console.warn('Service Worker nicht registriert', e); });
        });
      }
    </script>
  `;
html = html.replace('</head>', `${head}</head>`);
writeFileSync(indexPath, html);

// Schrift selbst ausliefern (kein Google-Fonts-Abruf, funktioniert offline)
mkdirSync(join(dist, 'fonts'), { recursive: true });
copyFileSync(join(root, 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2'), join(dist, 'fonts', 'inter-latin.woff2'));

// 2. Für GitHub Pages: unbekannte Pfade (z. B. /gymquest/training) liefern ebenfalls die App
copyFileSync(indexPath, join(dist, '404.html'));
// Feste Seiten zusätzlich als eigene index.html, damit ein Direktaufruf (z. B. /gymquest/account) ohne 404-Status lädt.
const staticRoutes = [];
(function walkRoutes(dir, prefix) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.includes('[')) continue;
      walkRoutes(full, /^\(.*\)$/.test(name) ? prefix : [...prefix, name]);
    } else {
      const m = name.match(/^([^_+[][^.]*)\.tsx$/);
      if (!m) continue;
      const parts = m[1] === 'index' ? prefix : [...prefix, m[1]];
      if (parts.length) staticRoutes.push(parts.join('/'));
    }
  }
})(join(root, 'src', 'app'), []);
for (const route of staticRoutes) {
  mkdirSync(join(dist, route), { recursive: true });
  copyFileSync(indexPath, join(dist, route, 'index.html'));
}
writeFileSync(join(dist, '.nojekyll'), '');

// 3. Service Worker mit Liste aller Dateien
const skip = (p) => p === 'sw.js' || staticRoutes.some((r) => p === `${r}/index.html`) || p === '404.html' || p === '.nojekyll' || p.startsWith('assets/node_modules/expo-sqlite/') || p === 'icons/icon-1024.png';
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(relative(dist, full).split(sep).join('/'));
  }
})(dist);
const precache = files.filter((p) => !skip(p)).sort();
const hash = createHash('sha256');
for (const p of precache) hash.update(p).update(readFileSync(join(dist, p)));
const version = hash.digest('hex').slice(0, 12);
const sw = readFileSync(join(root, 'scripts', 'sw-template.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('= __FILES__;', () => `= ${JSON.stringify(precache)};`);
writeFileSync(join(dist, 'sw.js'), sw);

const cloud = process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_KEY ? 'mit Cloud-Sync' : 'ohne Cloud-Sync (nur lokal)';
console.log(`\nWeb-App gebaut: dist/ · Pfad ${base} · ${precache.length} Dateien offline verfügbar · Version ${version} · ${cloud}`);
