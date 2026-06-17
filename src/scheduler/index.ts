/**
 * Registriert alle Cron-Jobs des Bots und das Startup-Priming.
 * Aufgerufen einmalig beim Start aus src/index.ts.
 */

import { getMatchesByDate, type Match } from "../api/footballData";
import { previousApiDate, todayApiDate, tomorrowApiDate } from "../utils/time";
import { startDailyDigest } from "./dailyDigest";
import { primeReminded, startMatchReminder } from "./matchReminder";
import { primePosted, startMatchResult } from "./matchResult";
import { logger } from "../utils/logger";

/**
 * Belegt die Dedupe-Sets beim Start vor, damit ein (Neu-)Start oder Redeploy
 * KEINE bereits laufenden/vergangenen Events erneut postet. Nur Events, die
 * NACH dem Start neu eintreten, werden gepostet. Best-effort — schlägt der
 * Abruf fehl, starten die Crons ohne Vorbelegung.
 */
export async function primeStartupState(): Promise<void> {
  try {
    const today = todayApiDate();
    // Gestern (für beendete Ergebnisse) + heute + morgen (für Reminder).
    const [yesterday, todayMatches, tomorrow] = await Promise.all([
      getMatchesByDate(previousApiDate(today)),
      getMatchesByDate(today),
      getMatchesByDate(tomorrowApiDate()),
    ]);

    const byId = new Map<number, Match>();
    for (const m of [...yesterday, ...todayMatches, ...tomorrow]) {
      byId.set(m.id, m);
    }
    const matches = [...byId.values()];

    const remindedCount = primeReminded(matches);
    const postedCount = primePosted(matches);
    logger.info(
      `Startup-Priming: ${matches.length} Spiele geprüft — ${remindedCount} Reminder + ${postedCount} Ergebnisse als "bereits erledigt" markiert (kein Repost beim Start)`,
    );
  } catch (error: unknown) {
    logger.warn(
      "Startup-Priming fehlgeschlagen — Crons starten ohne Vorbelegung",
      error,
    );
  }
}

/** Startet alle Scheduler. Die Cron-Jobs halten den Prozess am Leben. */
export function startScheduler(): void {
  startDailyDigest();
  startMatchReminder();
  startMatchResult();
  logger.info("Alle Scheduler registriert ✅");
}
