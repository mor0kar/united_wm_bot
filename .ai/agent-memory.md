# Agent Memory — WM Bot 2026

Langlebige, verifizierte Projekt-Fakten die über Sessions erhalten bleiben.
**Keine Live-Claims oder Scratch-Notizen hier.**

---

## Verifizierte Setup-Informationen

- Runtime: Node.js 20
- Paketmanager: npm
- Sprache: TypeScript (strict)
- Dev-Server: ts-node-dev oder tsx watch
- Build-Output: dist/
- Deployment: Railway.app

---

## API-Fakten (verifiziert)

### football-data.org v4
- Base URL: `https://api.football-data.org/v4`
- Auth: `X-Auth-Token` Header
- WM Competition Code: `WC`
- WM Season: `2026`
- Free Tier: 10 Requests/Minute
- Match endpoint: `GET /competitions/WC/matches?season=2026&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`
- ⚠️ **`dateFrom/dateTo` filtern nach UTC-Datum!** Ein Spiel um 00:00–01:59 MESZ hat den
  UTC-Tag des Vortags (MESZ=UTC+2). Einzeltagsabfrage für den MESZ-Tag verliert solche Spiele
  (verifiziert 2026-06-17: Iraq-Norway 00:00 MESZ 17. hat utcDate `2026-06-16T22:00Z`, fehlte
  im 17er-Digest). Fix in `getMatchesByDate`: UTC-Fenster [Vortag, Tag] abfragen, dann
  client-seitig auf MESZ-Kalendertag filtern (`toApiDate(parseUtc(utcDate)) === date`).
- ⚠️ **Free Tier liefert KEIN `venue`-Feld** (verifiziert 2026-06-16, Wert ist `undefined`).
  Stadion + Stadt müssen über worldcup26.ir-Fallback kommen (siehe TODOS [004]).
- Match-Objekt-Keys: `area, competition, season, id, utcDate, status, matchday, stage, group, lastUpdated, homeTeam, awayTeam, score, odds, referees`
- `group` kommt als `GROUP_G` (Präfix `GROUP_`), `stage` z.B. `GROUP_STAGE`
- Status-Werte: `SCHEDULED`, `TIMED`, `IN_PLAY`, `PAUSED`, `FINISHED`, `POSTPONED`, `SUSPENDED`, `CANCELLED`
  (`TIMED` = Anstoßzeit steht fest, verifiziert 2026-06-16)

### worldcup26.ir
- Base URL: `https://worldcup26.ir`
- Kein Auth-Key nötig
- Endpoints (verifiziert 2026-06-16, jeweils `{ <key>: [...] }`):
  - `/get/stadiums` → `{ stadiums: [...] }` (16): `id, name_en, fifa_name, city_en, country_en, capacity`
  - `/get/teams` → `{ teams: [...] }` (48): `id, name_en, flag (URL), iso2, fifa_code, groups`
  - `/get/games` → `{ games: [...] }` (104): `home_team_name_en, away_team_name_en, stadium_id, group, matchday, local_date "MM/DD/YYYY HH:MM", home_score, away_score, finished`
  - `/get/groups` → `{ groups: [...] }`: `name "A".."L"`, `teams: [{team_id, mp,w,l,d,pts,gf,ga,gd}]` (Werte als Strings!)
- **Venue-Join:** football-data ↔ worldcup26 über Team-Namen-Paar (englisch).
  K.o.-Spiele ohne feststehende Teams haben leere `*_name_en` → beim Index-Aufbau überspringen!
- **⚠️ SEHR langsam/unzuverlässig** (verifiziert 2026-06-17: ~12s/Request, zeitweise
  ECONNRESET/ECONNABORTED). Deshalb in `worldcup26.ts`: Timeout 20s, 3 Retries,
  Venue-Index mit **stale-while-revalidate** (einmal gebaut → wird bei Fehlern NIE geleert),
  Single-Flight-Build, **Warmup beim Start** (`warmVenueIndex()` in index.ts).
  Ursache für "Stadien fehlten im Digest" am 2026-06-17: erste Anfrage timeoutete.
- **Namensabweichungen** (football-data → worldcup26), als Alias in `TEAM_ALIASES`:
  "Congo DR" → "Democratic Republic of the Congo"; Turkey→Türkiye; South Korea→Korea Republic;
  Ivory Coast→Côte d'Ivoire; Cape Verde→Cabo Verde; Iran→IR Iran; United States→USA.
- Community-Projekt — nicht als primäre Quelle nutzen

---

## WM 2026 Eckdaten

- Turnier: 11. Juni – 19. Juli 2026
- 48 Teams, 104 Spiele, 16 Stadien
- Gastgeber: USA (11 Stadien), Mexiko (3), Kanada (2)
- Zeitzonen der Spielorte: UTC-7 bis UTC-4 (MESZ = UTC+2, also +6 bis +9h Differenz)
- Gruppen: A bis L (12 Gruppen)
- Deutschland: Gruppe E (Curaçao, Elfenbeinküste, Ecuador)

## Stadien (alle 16)

| Stadt | Stadion |
|---|---|
| Atlanta | Mercedes-Benz Stadium |
| Boston | Gillette Stadium |
| Dallas | AT&T Stadium |
| Houston | NRG Stadium |
| Kansas City | Arrowhead Stadium |
| Los Angeles | SoFi Stadium |
| Miami | Hard Rock Stadium |
| New York/New Jersey | MetLife Stadium (Finale) |
| Philadelphia | Lincoln Financial Field |
| San Francisco | Levi's Stadium |
| Seattle | Lumen Field |
| Toronto | BMO Field |
| Vancouver | BC Place |
| Guadalajara | Estadio Akron |
| Mexiko-Stadt | Estadio Azteca (Eröffnung) |
| Monterrey | Estadio BBVA |

---

## Architektur-Snapshot

- Kein persistenter State / keine Datenbank — alles live von API
- Scheduler = **Polling-Crons** (nicht setTimeout): Digest `30 8 * * *`, Reminder `* * * * *`,
  Result `*/3 * * * *`, alle mit `timezone: 'Europe/Berlin'`. Zustand wird pro Tick aus der API
  abgeleitet → übersteht Restarts (löst das node-cron-Restart-Risiko). Reine Prädikate
  `isReminderDue` / `isResultDue` in den jeweiligen Modulen.
- **Reminder nur für Abendspiele vor Mitternacht** (Stand 2026-06-17): Anpfiff vor 12:00 MESZ
  (Nacht-/Vormittagsspiele, z.B. 00:00/03:00/06:00) bekommt KEINEN 30-Min-Reminder.
  Konstante `REMINDER_MIN_KICKOFF_HOUR=12` + `berlinHour()` in matchReminder.ts.
- **Ergebnis-Post für ALLE Spiele**, auch nachts (keine Sperre). Digest sowieso alle.
  (Historie: Nacht-Sperre galt mal für beide, wurde für Ergebnis dauerhaft entfernt,
  für Reminder wieder eingeführt.)
- **Digest zeigt Resultate:** beendete Spiele erscheinen im Digest mit Endstand
  (🏁 Beendet), laufende mit 🔴 Läuft, anstehende mit Anstoßzeit.
- **TESTEN NIE im echten Channel:** Test-Skripte/Posts immer mit `BOT_MODE=test` ausführen.
  Dann postet der Webhook in `TEST_WEBHOOK_URL` oder macht — falls leer — einen Dry-Run
  (nur Log). Default `BOT_MODE=live` → echter Channel. Railway läuft live (kein BOT_MODE gesetzt).
  Hintergrund: am 2026-06-16 landeten manuelle Test-Reminder im echten WM-Channel und sahen
  aus wie Doppel-Posts.
- football-data `group` = "GROUP_G": Gruppenbuchstabe via Präfix-Strip extrahieren
  (`replace(/^GROUP[_\s]?/, "")`), NICHT alle Nicht-A-L-Zeichen entfernen (sonst "GG").
- **Digest splittet bei >25 Spielen** in mehrere Embeds (Discord-Limit: 25 Felder/Embed).
  `buildDigestEmbed` liefert daher `EmbedBuilder[]`.
- **Startup-Priming gegen Repost-Spam** (2026-06-17): Dedup ist nur In-Memory → ein
  (Neu-)Start/Redeploy postete laufende/vergangene Events erneut (3x gesehen, davon 2 ohne
  Stadion = frische Instanzen mit kaltem Venue-Index). Fix: `primeStartupState()` in
  scheduler/index.ts belegt VOR Cron-Start die Sets vor (`primeReminded`/`primePosted`) —
  Reminder für Anpfiff ≤31 Min markiert, beendete Spiele als gepostet. Nur NEU eintretende
  Events werden gepostet. Plus Graceful Shutdown (SIGTERM/SIGINT → process.exit) in index.ts,
  damit alte Instanzen beim Redeploy sterben.
- **WICHTIG (Railway):** Echte Repost-Vermeidung erfordert GENAU EINE Instanz. Bei mehreren
  Replicas/Services/Zombie-Deployments postet jede Instanz unabhängig (In-Memory-Dedup hilft
  nur prozessintern). Railway: `replicas = 1`, nur ein Service, alte Deployments „Removed".
- **Multi-Agent-Cleanup 2026-06-17:** toter Code entfernt (getStandings/getMatchById/Standings-Typen,
  Match.venue, matchEmbed.ts, postMessage, cheerio-Dependency). Status-Seite gehärtet
  (XSS-Escaping, timing-safe Token, Query-String-Pfad). README.md angelegt.
- Zeitzonen: intern UTC, Ausgabe immer MESZ (UTC+2)
- Discord Embeds: Primärfarbe `#C0392B`, Akzent `#FFD700`
- **Ausgabe via Discord-Webhook** (entschieden 2026-06-16): Push-only, kein Bot-Token,
  kein Gateway. Nur `DISCORD_WEBHOOK_URL` nötig. Umgesetzt mit discord.js `WebhookClient`.
- **Keine Slash Commands** — Webhooks haben keinen Rückkanal. Tasks /wm-heute etc. entfallen.

---

## Kritische Dateien

| Datei | Zweck |
|---|---|
| `src/index.ts` | Entry-Point, startet Scheduler |
| `src/discord/webhook.ts` | Webhook-Ausgabe (postEmbeds; live/test/dry-run) |
| `src/config.ts` | Validierte .env-Zugriffe |
| `src/api/footballData.ts` | Primäre Datenquelle (Cache + Rate-Limit-Handling) |
| `src/api/worldcup26.ts` | Venue-Fallback (`getVenue(home, away)` → Stadion + Stadt) |
| `src/embeds/shared.ts` | Farben + Matchup/Stage/Venue-Formatierung |
| `src/scheduler/index.ts` | Alle Cron Jobs registrieren |
| `src/utils/time.ts` | UTC → MESZ Konvertierung |
| `.env` | Alle Secrets (nie committen) — nur Platzhalter in `.env.example` |

---

## Bekannte Fallstricke

- Rate Limit football-data.org: 10 Req/min im Free Tier — Requests cachen!
- Anstoßzeiten der WM bis 6 Uhr morgens MESZ möglich — Crons entsprechend planen
- node-cron verliert alle geplanten Jobs bei Prozess-Neustart — nach Railway Redeploy neu einplanen
- `channel_binding=require` verursacht bei Neon (falls je genutzt) stille Verbindungsfehler

---

## Agent Operating Agreement

- Jeder Agent liest `TODOS.md` vor der Arbeit
- Dauerhafte Erkenntnisse kommen hierher — nur nach Verifikation
- Live-Claims und Blocker gehören in `TODOS.md`, nicht hierher
- Diese Datei wird nicht als Scratch-Space verwendet
