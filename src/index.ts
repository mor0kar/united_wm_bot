/**
 * Entry-Point des WM Bots.
 *
 * Architektur: Webhook-basiert (Push-only). Der Prozess hält sich durch die
 * node-cron Scheduler am Leben und postet automatisch:
 *   - Morgen-Digest (08:30 MESZ)
 *   - 30-Min-Reminder vor Anpfiff (nicht für Nacht-Spiele)
 *   - Ergebnis nach Spielende (Nacht-Ergebnisse landen im Morgen-Digest)
 *   - Sportschau-Zusammenfassung
 *
 * Kein Discord-Gateway, kein Bot-Token — nur DISCORD_WEBHOOK_URL (siehe .env).
 * Slash Commands gibt es bewusst nicht (Webhooks haben keinen Rückkanal).
 */

import "dotenv/config";
import { config } from "./config";
import { postMessage } from "./discord/webhook";
import { startScheduler } from "./scheduler";
import { startStatusServer } from "./health";
import { warmVenueIndex } from "./api/worldcup26";
import { recordEvent } from "./status";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  logger.info(`WM Bot 2026 startet … (Modus: ${config.mode.toUpperCase()})`);

  // Status-Server zuerst, damit der Port (Railway) sofort offen ist.
  startStatusServer();
  recordEvent("start", "Bot gestartet");

  // Venue-Index (worldcup26.ir) vorwärmen, damit Stadien beim Digest bereitstehen.
  warmVenueIndex();

  try {
    await postMessage("Ich bin bereit 🏆");
    logger.info("Bereitschaftsnachricht via Webhook gepostet");
  } catch {
    // Fehler wurde bereits in webhook.ts geloggt; Start nicht abbrechen.
    logger.warn("Bereitschaftsnachricht konnte nicht gesendet werden");
  }

  // Cron-Jobs starten — sie halten den Prozess am Leben.
  startScheduler();

  logger.info("WM Bot 2026 läuft.");
}

void main();
