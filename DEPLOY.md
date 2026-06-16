# DEPLOY.md — WM Bot 2026 auf Railway

Anleitung, um den Bot dauerhaft (24/7) auf [Railway.app](https://railway.app) laufen zu lassen.

---

## Überblick

- Der Bot ist Webhook-basiert und läuft als Dauerprozess (die node-cron Jobs
  halten ihn am Leben).
- Ein kleiner Health-Server (`src/health.ts`) lauscht auf `PORT` und antwortet
  unter `/health` — damit Railway den Service als „gesund" erkennt.
- Build: `npm run build` (tsc → `dist/`), Start: `npm run start` (`node dist/index.js`).
- Konfiguration steckt in `railway.json` (Build/Start/Healthcheck/Restart-Policy).

---

## Benötigte Umgebungsvariablen (im Railway-Dashboard setzen)

| Variable | Wert | Pflicht |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | Webhook-URL aus dem Discord-Channel | ✅ |
| `FOOTBALL_DATA_API_KEY` | API-Key von football-data.org | ✅ |
| `LOG_LEVEL` | `info` (oder `debug`/`warn`/`error`) | optional |
| `DASHBOARD_TOKEN` | frei wählbar; aktiviert die Trigger-Buttons der Status-Seite | optional |

> **Status-Seite:** Railway vergibt eine öffentliche URL (Settings → Networking →
> Generate Domain). Unter `/` liegt eine kleine Status-Seite (Uptime, nächstes Spiel,
> letzte Aktionen). Mit gesetztem `DASHBOARD_TOKEN` kannst du dort Posts manuell auslösen.

> `PORT` setzt Railway automatisch — **nicht** selbst setzen.
> Die echten Werte stehen lokal in `.env` (wird nicht deployt, da gitignored).

---

## Variante A — Deploy über GitHub (empfohlen)

Vorteil: Railway baut bei jedem `git push` automatisch neu.

1. **Repo initialisieren & pushen** (falls noch nicht geschehen):
   ```bash
   git init
   git add .
   git commit -m "WM Bot 2026 — initial"
   git branch -M main
   git remote add origin https://github.com/<user>/wm-bot.git
   git push -u origin main
   ```
2. Auf [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → `wm-bot` wählen.
3. Railway erkennt `railway.json` automatisch (Nixpacks, Node 20 via `.nvmrc`).
4. **Variables** öffnen → `DISCORD_WEBHOOK_URL` und `FOOTBALL_DATA_API_KEY` eintragen.
5. Deploy abwarten → Logs prüfen: es sollte „Alle Scheduler registriert ✅" erscheinen
   und im Discord-Channel „Ich bin bereit 🏆".

## Variante B — Deploy über Railway CLI (ohne GitHub)

1. CLI installieren: `npm i -g @railway/cli`
2. `railway login` (öffnet den Browser).
3. Im Projektordner: `railway init` (neues Projekt anlegen).
4. Env-Vars setzen:
   ```bash
   railway variables set DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
   railway variables set FOOTBALL_DATA_API_KEY="..."
   ```
5. `railway up` — lädt den lokalen Stand hoch und deployt.

---

## Nach dem Deploy prüfen

- **Railway Logs:** „Health-Server lauscht auf Port …", „Alle Scheduler registriert ✅"
- **Discord:** Startnachricht „Ich bin bereit 🏆" im Channel
- **Healthcheck:** Railway zeigt den Service als „Active/Healthy"
- Der nächste **Daily Digest** kommt um **10:00 MESZ**.

---

## Stolperfallen

- **Kein „Ich bin bereit"-Post?** → `DISCORD_WEBHOOK_URL` falsch/leer. Variables prüfen.
- **Build schlägt fehl?** → lokal `npm run build` testen; Node-Version muss ≥ 20 sein.
- **Service „crashed" trotz laufender Logs?** → Healthcheck-Pfad muss `/health` sein
  (steht in `railway.json`), `PORT` darf nicht manuell überschrieben werden.
- **Nach Redeploy doppelte Posts?** → unkritisch: Dedupe ist In-Memory; ein Redeploy
  startet frisch. Reminder-Zeitfenster und Ergebnis-Altersgrenze verhindern Fehlposts.
