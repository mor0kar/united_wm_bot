/**
 * Registriert alle Cron-Jobs des Bots.
 * Aufgerufen einmalig beim Start aus src/index.ts.
 */

import { startDailyDigest } from "./dailyDigest";
import { startMatchReminder } from "./matchReminder";
import { startMatchResult } from "./matchResult";
import { logger } from "../utils/logger";

/** Startet alle Scheduler. Die Cron-Jobs halten den Prozess am Leben. */
export function startScheduler(): void {
  startDailyDigest();
  startMatchReminder();
  startMatchResult();
  logger.info("Alle Scheduler registriert ✅");
}
