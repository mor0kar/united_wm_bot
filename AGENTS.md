# AGENTS.md — WM Bot 2026

Root-Vertrag für alle Agents und AI-gestützten Sessions in diesem Repository.

---

## Projektbeschreibung

**WM Bot 2026** ist ein TypeScript Discord Bot der Jan und seine Freunde über die FIFA WM 2026 informiert. Private Nutzung, kein Produktions-Traffic. Ziel ist Einfachheit und Zuverlässigkeit über den WM-Zeitraum (11. Juni – 19. Juli 2026).

---

## Quellen der Wahrheit

Jeder Agent liest vor produktiver Arbeit in dieser Reihenfolge:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `TODOS.md`
4. `.ai/agent-memory.md`
5. Relevante Dateien im aktuellen Scope

---

## Nicht verhandelbare Projektregeln

- Keine externen Libraries ohne explizite Freigabe
- Secrets (`DISCORD_WEBHOOK_URL`, `FOOTBALL_DATA_API_KEY`) nur in `.env` — nie hardcoded, nie in `.env.example`
- Rate Limits der football-data.org API (10/min) immer respektieren
- Alle Zeiten in MESZ ausgeben, intern immer UTC verarbeiten
- TypeScript strict mode — kein `any`
- Ausgabe via Discord-Webhook (Push-only) — kein Bot-Token/Gateway, keine Slash Commands

---

## Arbeitsprinzipien

- Kleine, sichere Änderungen vor großen Umbauten
- Bestehende Patterns bevorzugen
- Keine unnötige Komplexität — privater Bot für Freunde, nicht Enterprise-Software
- Erst testen, dann deployen

---

## Iterationsschema

Jede größere Arbeitsiteration folgt diesem Ablauf:

1. **Verstehen** — was soll geändert werden und warum?
2. **Planen** — welche Dateien sind betroffen?
3. **Minimal umsetzen** — kleinster sinnvoller Schritt
4. **Prüfen** — `npm run build` muss durchlaufen
5. **Dokumentieren** — TODOS.md aktualisieren
6. **Erst dann erweitern**

---

## Definition of Done

Ein Task gilt als done, wenn:

- [ ] `npm run build` läuft fehlerfrei durch
- [ ] Die Änderung funktioniert wie beschrieben
- [ ] Keine neuen Dependencies ohne Rückfrage
- [ ] `TODOS.md` aktualisiert
- [ ] Kein Scope-Creep stattfand

---

## Agenten und Verantwortungen

### orchestrator
Koordiniert Tasks aus TODOS.md, delegiert an Spezial-Agenten, Qualitätssicherung.

### planner
Zerlegt komplexe Aufgaben in Teilaufgaben. Schreibt keinen Code.

### implementer
Fokussierte Umsetzung eines Tasks. Minimal und sauber.

### discord-specialist
Verantwortlich für:
- discord.js v14 `WebhookClient` Setup (`src/discord/webhook.ts`)
- Embed-Design (Farben, Felder, Thumbnails) via `EmbedBuilder`
- Korrektes Posten (Batching: max. 10 Embeds/Nachricht)
- (Keine Slash Commands / kein Gateway — Architektur ist Webhook-basiert)

### scheduler-specialist
Verantwortlich für:
- node-cron Job Setup
- Match Reminder Logik (30min vor Anpfiff)
- Daily Digest (10:00 MESZ)
- Result Posting nach Spielende
- Sportschau Polling

### api-specialist
Verantwortlich für:
- football-data.org v4 wrapper
- worldcup26.ir wrapper
- Sportschau.de scraper
- Rate Limit Handling und Caching
- Datentypen und Interfaces

### session-handoff
Erstellt saubere Session-Übergaben.

### prompt-optimizer
Prüft Konsistenz zwischen AGENTS.md, CLAUDE.md und allen Agents.

---

## Technischer Rahmen

- Stack: TypeScript, Node.js 20, discord.js v14, node-cron, axios
- Build: `npm run build` (tsc)
- Dev: `npm run dev` (ts-node-dev oder tsx)
- Start: `npm run start` (node dist/index.js)
- Deployment: Railway.app

---

## Hooks

Nach jeder Änderung:
- `npm run build` — TypeScript kompilieren, Fehler prüfen
