/**
 * Entry-Point des WM Bots.
 *
 * Architektur: Webhook-basiert (Push-only). Der Prozess hält sich durch die
 * node-cron Scheduler am Leben und postet automatisch:
 *   - Morgen-Digest (08:30 MESZ)
 *   - 30-Min-Reminder vor Anpfiff (nur Abendspiele vor Mitternacht)
 *   - Ergebnis nach Spielende (für alle Spiele, auch nachts)
 *   - Sportschau-Zusammenfassung
 *
 * Kein Discord-Gateway, kein Bot-Token — nur DISCORD_WEBHOOK_URL (siehe .env).
 * Slash Commands gibt es bewusst nicht (Webhooks haben keinen Rückkanal).
 */

import "dotenv/config";
import { config } from "./config";
import { primeStartupState, startScheduler } from "./scheduler";
import { startStatusServer } from "./health";
import { warmVenueIndex } from "./api/worldcup26";
import { recordEvent } from "./status";
import { logger } from "./utils/logger";

// Graceful Shutdown: bei Redeploy/Stop sauber beenden, damit keine alte
// Instanz weiterläuft und parallel zur neuen postet (Doppel-Posts).
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.info(`${signal} empfangen — Bot fährt herunter.`);
    process.exit(0);
  });
}

async function main(): Promise<void> {
  logger.info(`WM Bot 2026 startet … (Modus: ${config.mode.toUpperCase()})`);

  // Status-Server zuerst, damit der Port (Railway) sofort offen ist.
  startStatusServer();
  recordEvent("start", "Bot gestartet");

  // Venue-Index (worldcup26.ir) vorwärmen, damit Stadien beim Digest bereitstehen.
  warmVenueIndex();

  // Bewusst KEINE "Ich bin bereit"-Nachricht in Discord — Start ist in den
  // Railway-Logs und auf der Status-Seite (Event "start") sichtbar.

  // Dedupe-Sets vorbelegen, BEVOR die Crons feuern können → ein (Neu-)Start
  // postet keine bereits laufenden/vergangenen Reminder/Ergebnisse erneut.
  await primeStartupState();

  // Cron-Jobs starten — sie halten den Prozess am Leben.
  startScheduler();

  logger.info("WM Bot 2026 läuft.");
}

main().catch((error: unknown) => {
  logger.error("Fataler Fehler beim Start", error);
  process.exit(1);
});
