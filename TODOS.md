# TODOS.md — WM Bot 2026

Kanonisches Aufgaben- und Evidenzboard.

---

## Status-Legende

| Symbol | Bedeutung |
|---|---|
| 🔴 | Blockiert |
| 🟡 | In Arbeit |
| 🟢 | Erledigt |
| ⚪ | Offen |
| ⏸ | Pausiert |
| ⛔ | Verworfen |

---

## Aktive Tasks

### [001] Projekt-Setup & Abhängigkeiten
- **Status:** 🟢 Erledigt
- **Priorität:** Hoch
- **Agent:** implementer
- **Beschreibung:** package.json, tsconfig.json, .env.example, .gitignore anlegen. Alle Dependencies installieren.
- **Akzeptanzkriterium:** `npm install` läuft durch, `npm run build` erzeugt dist/
- **Prüfmethode:** `npm run build` ausführen
- **Evidenz:** 2026-06-16 — Konfig vorhanden, kaputtes `{src`-Verzeichnis entfernt, echte `src/`-Struktur angelegt. `npm install` exit 0, `npm run build` exit 0, dist/ erzeugt.

### [002] Discord Ausgabe-Grundgerüst (Webhook)
- **Status:** 🟢 Erledigt
- **Priorität:** Hoch
- **Agent:** discord-specialist
- **Beschreibung:** **Architektur geändert 2026-06-16: Webhook statt Bot/Gateway** (Push-only, keine Slash Commands nötig). `src/discord/webhook.ts` (WebhookClient, postMessage/postEmbeds), `src/config.ts` (nur DISCORD_WEBHOOK_URL), `src/index.ts` postet "Ich bin bereit 🏆" beim Start.
- **Akzeptanzkriterium:** Startnachricht erscheint im Channel
- **Prüfmethode:** `node dist/index.js`, Channel prüfen
- **Evidenz:** 2026-06-16 — LIVE getestet: "Ich bin bereit 🏆" via Webhook erfolgreich gepostet. Build grün.

### [003] football-data.org API Wrapper
- **Status:** 🟢 Erledigt
- **Priorität:** Hoch
- **Agent:** api-specialist
- **Beschreibung:** `src/api/footballData.ts` — Wrapper für alle benötigten Endpoints. Interfaces für Match, Team, Score. Methoden: `getMatchesToday()`, `getMatchesByDate(date)`, `getMatchById(id)`, `getStandings(group?)`.
- **Akzeptanzkriterium:** Gibt typisierte Match-Objekte zurück, handled Rate Limits
- **Prüfmethode:** Kleines Test-Script, API Response loggen
- **Evidenz:** 2026-06-16 — LIVE getestet mit echtem Key: 3 Spiele für heute korrekt geliefert (Iran-NZ FINISHED, France-Senegal TIMED, Iraq-Norway TIMED), Teams/Flaggen/MESZ-Zeiten korrekt. Cache 60s-TTL, 429-Handling. ⚠️ **Erkenntnis:** Free Tier liefert KEIN `venue` → Stadion/Stadt über [004].

### [004] worldcup26.ir Wrapper (Fallback)
- **Status:** 🟢 Erledigt
- **Priorität:** Mittel
- **Agent:** api-specialist
- **Beschreibung:** `src/api/worldcup26.ts` — Wrapper für Stadion-Details. Da football-data kein `venue` liefert, mappen wir Team-Paar → game.stadium_id → Stadion (name + city). 6h-Cache, robuster Team-Name-Match (Diakritika/Aliase), `null` bei Fehlschlag (blockiert nie einen Post).
- **Akzeptanzkriterium:** Stadion-Name und Stadt für alle 16 Venues abrufbar
- **Prüfmethode:** `getVenue(home, away)` gegen echte Spiele
- **Evidenz:** 2026-06-16 — LIVE: alle 3 heutigen Spiele aufgelöst (Iran-NZ→SoFi Stadium LA, France-Senegal→MetLife NY/NJ, Iraq-Norway→Gillette Boston). Bug gefixt: K.o.-Spiele ohne Team-Namen crashten den Index-Aufbau → jetzt übersprungen.

### [005] Embeds definieren
- **Status:** 🟢 Erledigt
- **Priorität:** Mittel
- **Agent:** discord-specialist
- **Beschreibung:** Embed-Templates in `src/embeds/` (shared.ts + digest/reminder/result/match/sportschau). Farben: `#C0392B` (Rot) + `#FFD700` (Gold). Teams mit Flaggen, Anstoßzeit MESZ, Stadion + Stadt, Gruppe/Stage. WebhookClient batcht max. 10 Embeds/Nachricht.
- **Akzeptanzkriterium:** Embeds sehen gut aus und zeigen alle nötigen Infos
- **Prüfmethode:** Test-Post in Discord-Channel
- **Evidenz:** 2026-06-16 — LIVE getestet: Digest (alle Tagesspiele + Stadien), Reminder (France-Senegal) und Result (Iran-NZ) erfolgreich in den Channel gepostet.

### [006] Cron Scheduler — Daily Digest
- **Status:** 🟢 Erledigt
- **Priorität:** Hoch
- **Agent:** scheduler-specialist
- **Beschreibung:** `src/scheduler/dailyDigest.ts` — Täglich um **08:30 MESZ** alle Spiele des Tages als Embed posten. Wenn kein Spiel: "Heute spielfrei".
- **Akzeptanzkriterium:** Post erscheint täglich um 08:30 MESZ im konfigurierten Channel
- **Prüfmethode:** `postDailyDigest()` direkt + Cron-Registrierung prüfen
- **Evidenz:** 2026-06-16 — Digest-Post live verifiziert (siehe [005]). Cron `30 8 * * *` mit timezone Europe/Berlin registriert sich sauber beim Start. (Zeit: zunächst 08:00 → 10:00 → final 08:30 auf Wunsch.)

### [007] Cron Scheduler — Match Reminder (30min)
- **Status:** 🟢 Erledigt
- **Priorität:** Hoch
- **Agent:** scheduler-specialist
- **Beschreibung:** `src/scheduler/matchReminder.ts` — jede Minute prüfen, Reminder ~30 Min vor Anpfiff. Polling statt setTimeout → übersteht Restarts. Enges Zeitfenster (T-30 bis T-28). Heutige + morgige Spiele. Reminder für ALLE Spiele (Nacht-Sperre am 2026-06-17 wieder entfernt).
- **Akzeptanzkriterium:** Reminder kommt ~30min vor Anpfiff
- **Prüfmethode:** Reines Prädikat `isReminderDue` mit gefakter `now`
- **Evidenz:** 2026-06-16 — `isReminderDue` verifiziert: feuert bei T-30/T-29, nicht bei T-31/T-10; FINISHED nie. Cron registriert. (2026-06-17: Nacht-Sperre entfernt, postet jetzt auch nachts.)

### [008] Cron Scheduler — Ergebnis-Post
- **Status:** 🟢 Erledigt
- **Priorität:** Hoch
- **Agent:** scheduler-specialist
- **Beschreibung:** `src/scheduler/matchResult.ts` — alle 3 Min gestrige+heutige Spiele abrufen, neue FINISHED-Spiele posten. Altersgrenze 240min (Restart-Schutz). Ergebnis für ALLE Spiele (Nacht-Sperre am 2026-06-17 wieder entfernt).
- **Akzeptanzkriterium:** Ergebnis-Embed kurz nach Spielende
- **Prüfmethode:** Reines Prädikat `isResultDue` + Live-Betrieb
- **Evidenz:** 2026-06-16 — `isResultDue`: FINISHED bei KO+120min ja, KO+300min nein (Altersgrenze); TIMED nie. France 3-1 Senegal live gepostet. Gruppen-Label-Bug "GG"→"G" gefixt. (2026-06-17: Nacht-Sperre entfernt, postet jetzt auch nachts.)

### [009] Sportschau Scraper + Embed
- **Status:** ⚪ Offen
- **Priorität:** Mittel
- **Agent:** api-specialist + discord-specialist
- **Beschreibung:** `src/api/sportschauScraper.ts` — Pollt sportschau.de/fussball/fifa-wm-2026/ alle 10min nach Spielende auf neue Highlight-Videos. Postet `src/embeds/sportschauEmbed.ts` mit Thumbnail + Link wenn gefunden.
- **Akzeptanzkriterium:** Sportschau-Embed erscheint innerhalb 15min nachdem Zusammenfassung online ist
- **Prüfmethode:** Manuell URL prüfen und Embed testen
- **Evidenz:** —

### [010] Slash Commands — ⛔ VERWORFEN
- **Status:** ⛔ Verworfen (2026-06-16)
- **Grund:** Architektur auf **Webhook** umgestellt. Webhooks haben keinen Rückkanal,
  können also keine interaktiven Commands beantworten. Nur automatische Posts.
- **Hinweis:** Falls die Infos von `/wm-heute` / `/wm-gruppe` / `/wm-tabelle` doch on-demand
  gewünscht sind, ginge das später als separater Bot (Gateway) oder Interactions-Endpoint.

### [011] Railway Deployment
- **Status:** 🟢 Erledigt
- **Priorität:** Hoch
- **Agent:** implementer
- **Beschreibung:** Railway Projekt einrichten, Env Vars setzen, Deploy testen. Bot soll dauerhaft laufen.
- **Akzeptanzkriterium:** Bot läuft 24/7 auf Railway, erscheint online im Discord
- **Prüfmethode:** Railway Logs prüfen, Bot-Status in Discord checken
- **Evidenz:** 2026-06-16 — LIVE auf Railway. Deploy aus GitHub `mor0kar/united_wm_bot`. Railway-Logs: Health-Server auf Port 8080, Bereitschaftsnachricht gepostet, alle 3 Scheduler registriert, „WM Bot 2026 läuft.". Setup: `src/health.ts`, `railway.json`, `.nvmrc`, `DEPLOY.md`.

---

## Backlog

- [ ] `/wm-scorer` — Torschützenliste
- [ ] Gruppen-Standings täglich automatisch updaten (pinned message editieren statt neu posten)
- [ ] `@here` Mentions für Deutschland-Spiele
- [ ] WM-Finale: Extra-Embed mit Countdown
- [ ] Halbzeit-Score posten (falls API das hergibt)

---

## Erledigt

### [012] Status-Seite (Mini-Dashboard)
- **Status:** 🟢 Erledigt
- **Beschreibung:** Health-Server zu Status-Server ausgebaut (`src/health.ts` + `src/status.ts`): HTML-Seite unter `/` (Uptime, nächstes Spiel, letzte Aktionen), `GET /api/status` (JSON), token-geschützte Trigger `POST /api/trigger/{digest,reminder-check,result-check}` (Header `x-dashboard-token`, aktiv nur bei gesetztem `DASHBOARD_TOKEN`). Gleicher Prozess, kein extra Service.
- **Evidenz:** 2026-06-16 — lokal verifiziert: /health 200, /api/status zeigt nächstes Spiel + Events, HTML lädt, Trigger ohne/falschem Token → 403, mit Token → 202. Build grün.

---

## Bekannte Risiken

- football-data.org Free Tier: 10 Req/min — bei vielen gleichzeitigen Spielen könnte das knapp werden (Lösung: Caching)
- worldcup26.ir ist ein Community-Projekt — Reliability unklar, daher nur als Fallback
- Sportschau hat kein offizielles API — Scraper könnte brechen wenn sich HTML ändert
- Node-cron verliert Jobs bei Neustart — nach Railway Redeploy alle Jobs neu planen

---

## Offene Fragen

- ~~Welcher Discord Channel?~~ → erledigt: Webhook-URL bestimmt den Channel (`DISCORD_WEBHOOK_URL`)
- Soll bei Deutschland-Spielen extra gepingt werden? (Webhook kann `@here`/Rollen-Mention im content posten)
- Soll der Sportschau-Scraper auch ARD Mediathek checken?
