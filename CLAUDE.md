# CLAUDE.md — WM Bot 2026

Dieses Dokument ist der Projektkontext für Claude Code.
Vor jeder Arbeit im Repo lesen und einhalten.

---

## Projektübersicht

**WM Bot 2026** ist ein Discord Bot für einen privaten Server, der Jan und seine Freunde über die FIFA Weltmeisterschaft 2026 informiert.

Funktionen:
- Täglicher Morgen-Post mit allen Spielen des Tages (Anstoß in MESZ)
- 30-Minuten-Vorwarnung vor jedem Spiel (Teams, Stadion, Stadt)
- Ergebnis-Post nach Spielende
- Sportschau-Zusammenfassung: Embed mit Thumbnail + Link, sobald online

> **Architektur (Stand 2026-06-16):** Ausgabe erfolgt über einen **Discord-Webhook** (Push-only).
> Kein Bot-Token, kein Gateway. Slash Commands (`/wm-heute` etc.) entfallen bewusst, da Webhooks
> keinen Rückkanal haben. Es werden nur automatische Posts gesendet.

**Live:** läuft auf Railway.app
**Repo:** github.com/mor0kar/united_wm_bot

---

## Tech Stack

| Was | Womit |
|---|---|
| Sprache | TypeScript |
| Runtime | Node.js 20 |
| Discord | discord.js v14 |
| Scheduler | node-cron |
| HTTP Client | axios |
| Daten primär | football-data.org v4 API (kostenlos, API Key nötig) |
| Daten fallback | worldcup26.ir (kein Key, WM-spezifisch) |
| Deployment | Railway.app |
| Env | dotenv |

---

## Projektstruktur

```
wm-bot/
├── src/
│   ├── index.ts                 # Entry-Point, startet Status-Server + Scheduler
│   ├── config.ts                # Validierte .env-Zugriffe
│   ├── health.ts                # Status-/Health-Server (/, /health, /api/status, Trigger)
│   ├── status.ts                # In-Memory Event-Log (letzte Aktionen)
│   ├── discord/
│   │   └── webhook.ts           # Webhook-Ausgabe (postMessage / postEmbeds)
│   ├── scheduler/
│   │   ├── index.ts             # Alle Cron Jobs registrieren
│   │   ├── dailyDigest.ts       # 08:30 MESZ — Tages-Spielplan
│   │   ├── matchReminder.ts     # 30min vor Anpfiff — Reminder
│   │   ├── matchResult.ts       # Nach Spielende — Ergebnis posten
│   │   └── sportschau.ts        # Polling für Sportschau-Zusammenfassungen
│   ├── api/
│   │   ├── footballData.ts      # football-data.org v4 wrapper
│   │   ├── worldcup26.ts        # worldcup26.ir wrapper (Fallback/Stadion-Details)
│   │   └── sportschauScraper.ts # Sportschau.de polling für WM-Highlights
│   ├── embeds/
│   │   ├── matchEmbed.ts        # Embed für anstehende Spiele
│   │   ├── resultEmbed.ts       # Embed für Ergebnisse
│   │   ├── reminderEmbed.ts     # Embed für 30min-Reminder
│   │   ├── digestEmbed.ts       # Embed für Tagesübersicht
│   │   └── sportschauEmbed.ts   # Embed für Sportschau-Zusammenfassung
│   └── utils/
│       ├── time.ts              # Zeitzonenkonvertierung (UTC → MESZ)
│       ├── flags.ts             # Länder-Emoji-Flaggen map
│       └── logger.ts            # Simples Logging
├── .env.example                 # Template für Umgebungsvariablen
├── .gitignore
├── CLAUDE.md
├── AGENTS.md
├── TODOS.md
├── package.json
└── tsconfig.json
```

---

## Umgebungsvariablen (.env)

```
DISCORD_WEBHOOK_URL=     # Webhook-URL aus Channel > Integrationen > Webhooks
FOOTBALL_DATA_API_KEY=   # football-data.org API Key (gratis)
LOG_LEVEL=               # optional: debug | info | warn | error (Default: info)
```

> Echte Werte gehören in `.env` (gitignored). `.env.example` enthält nur Platzhalter — niemals echte Secrets dort eintragen.

---

## Design-Entscheidungen

- Alle Zeiten werden in **MESZ (UTC+2)** ausgegeben — das ist die relevante Zeitzone
- WM 2026 Competition Code bei football-data.org: `WC`, Season: `2026`
- Stadion + Stadt kommen aus dem `venue`-Feld der Match-API
- Sportschau-Polling: alle 10 Minuten nach Spielende prüfen ob Clip online
- Ausgabe via Webhook (`src/discord/webhook.ts`), nicht via Bot-Gateway
- Kein persistenter State außer `.env` — alles wird live von der API abgerufen

## API-Nutzung

### football-data.org
- Base URL: `https://api.football-data.org/v4`
- Auth: `X-Auth-Token: ${FOOTBALL_DATA_API_KEY}` Header
- Free Tier: 10 Requests/Minute
- WM Matches: `GET /competitions/WC/matches`
- Mit Datumsfilter: `?season=2026&dateFrom=2026-06-14&dateTo=2026-06-14`
- Match-Objekt enthält: `utcDate`, `homeTeam.name`, `awayTeam.name`, `score`, `group` (Format `GROUP_X`)
- ⚠️ **Free Tier liefert KEIN `venue`** (verifiziert 2026-06-16) → Stadion/Stadt via worldcup26.ir

### worldcup26.ir
- Base URL: `https://worldcup26.ir`
- Kein Auth nötig
- Stadien: `GET /get/stadiums`
- Spiele: `GET /get/games`
- Gruppen: `GET /get/groups`

---

## Konventionen

- Sprache im Code: Englisch (Variablen, Kommentare)
- Kommentare auf Deutsch wenn nötig
- Alle Embeds nutzen die WM-Farben: `#C0392B` (Rot) und `#FFD700` (Gold)
- Kein `any` in TypeScript
- Fehler immer loggen, nie still schlucken
- Rate Limits der API respektieren — Requests cachen wo möglich

---

## Deployment auf Railway

- Start Command: `npm run start`
- Build Command: `npm run build`
- Node Version: 20 (gepinnt via `.nvmrc`)
- Config in `railway.json` (Builder, Healthcheck `/health`, Restart-Policy)
- Health-Server (`src/health.ts`) lauscht auf `PORT` — Railway setzt `PORT` automatisch
- Env Vars im Railway Dashboard: `DISCORD_WEBHOOK_URL`, `FOOTBALL_DATA_API_KEY`
- **Schritt-für-Schritt-Anleitung: siehe `DEPLOY.md`**

---

## Häufige Probleme & Fixes

### Bot postet nichts in Discord
→ `DISCORD_WEBHOOK_URL` in `.env` prüfen (vollständige URL inkl. Token-Teil)
→ Webhook im Channel evtl. gelöscht? Neu erstellen unter Integrationen > Webhooks

### API Rate Limit überschritten
→ football-data.org: Max 10 Requests/Minute im Free Tier
→ Requests bündeln, Responses cachen (mind. 60 Sekunden)

### Zeiten stimmen nicht
→ Alle API-Zeiten sind UTC — immer über `utils/time.ts` in MESZ umrechnen

---

## Roadmap

- [x] Projekt-Setup & Agent-Infra
- [x] Utils (Zeit/Flaggen/Logger) + Config
- [x] football-data.org wrapper bauen & testen (live verifiziert)
- [x] Discord-Webhook-Ausgabe (live verifiziert)
- [x] Embeds (Digest, Reminder, Ergebnis, Sportschau)
- [x] worldcup26.ir wrapper (Stadion/Stadt, da football-data kein venue liefert)
- [x] Cron-Scheduler für Digest (08:30) + Reminder (T-30) + Ergebnis
- [ ] Sportschau-Scraper
- [ ] Railway Deployment

---

*Letzte Aktualisierung: 2026-06-16*
