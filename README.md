# WM Bot 2026 🏆

Discord-Bot, der über die FIFA Weltmeisterschaft 2026 informiert — automatische Posts
zu Spielplan, Anpfiff-Reminder und Ergebnissen in einen Discord-Channel.

Privater Bot für Freunde, kein Produktions-Traffic. Läuft 24/7 auf Railway.

## Funktionen

- **Morgen-Digest** (täglich 08:30 MESZ): alle Spiele des Tages mit Anstoßzeit,
  Teams (mit Flaggen), Stadion + Stadt; beendete Spiele mit Endstand.
- **30-Minuten-Reminder** vor Anpfiff — nur für Abendspiele vor Mitternacht.
- **Ergebnis-Post** nach Spielende (für alle Spiele, auch nachts).
- **Status-Seite** (kleine Web-Oberfläche): Uptime, nächstes Spiel, letzte Aktionen,
  optionale manuelle Trigger.

> Sportschau-Zusammenfassungen sind als nächstes Feature geplant (siehe `TODOS.md`).

## Architektur

Ausgabe erfolgt über einen **Discord-Webhook** (Push-only) — kein Bot-Token, kein
Gateway, keine Slash Commands. Ein `node-cron`-Scheduler hält den Prozess am Leben und
postet zu den richtigen Zeiten. Kein persistenter State: alle Daten kommen live aus den APIs.

| Was | Womit |
|---|---|
| Sprache / Runtime | TypeScript, Node.js 20 |
| Discord | discord.js v14 (`WebhookClient`) |
| Scheduler | node-cron |
| Daten primär | football-data.org v4 (API-Key nötig, gratis) |
| Daten Stadien | worldcup26.ir (kein Key) |
| Deployment | Railway.app |

## Setup (lokal)

```bash
npm install
cp .env.example .env   # Werte eintragen (siehe unten)
npm run dev            # Entwicklung (tsx watch)
npm run build && npm start   # Produktion
```

### Umgebungsvariablen

| Variable | Pflicht | Zweck |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | ✅ | Webhook-URL des Ziel-Channels |
| `FOOTBALL_DATA_API_KEY` | ✅ | API-Key von football-data.org |
| `LOG_LEVEL` | – | `debug` \| `info` \| `warn` \| `error` (Default `info`) |
| `DASHBOARD_TOKEN` | – | aktiviert die Trigger-Buttons der Status-Seite |
| `BOT_MODE` | – | `test` postet in `TEST_WEBHOOK_URL`/Dry-Run statt live |
| `TEST_WEBHOOK_URL` | – | Webhook eines Test-Channels (für `BOT_MODE=test`) |

Echte Werte gehören in `.env` (gitignored). `.env.example` enthält nur Platzhalter.

## Deployment

Schritt-für-Schritt-Anleitung für Railway: siehe [`DEPLOY.md`](./DEPLOY.md).

## Projektkontext

- `CLAUDE.md` — Projektübersicht & technische Details
- `AGENTS.md` — Arbeitsregeln für KI-gestützte Sessions
- `TODOS.md` — Aufgaben- und Evidenzboard
