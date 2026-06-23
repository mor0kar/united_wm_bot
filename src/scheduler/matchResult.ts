/**
 * Ergebnis-Post nach Spielende.
 *
 * Ansatz: alle paar Minuten die jüngsten Spiele (gestern + heute, um
 * Anpfiffe vor Mitternacht abzudecken) abrufen und für jedes neu beendete
 * Spiel den Endstand posten. Eine Altersgrenze verhindert, dass nach einem
 * Neustart längst beendete Spiele erneut gepostet werden.
 */

import cron, { type ScheduledTask } from "node-cron";
import {
  getMatchesBetween,
  type Match,
} from "../api/footballData";
import { getMatchGoals, getVenue } from "../api/worldcup26";
import { postEmbeds } from "../discord/webhook";
import { buildResultEmbed } from "../embeds/resultEmbed";
import {
  parseUtc,
  previousApiDate,
  TIMEZONE,
  todayApiDate,
} from "../utils/time";
import { recordEvent } from "../status";
import { logger } from "../utils/logger";

// Alle 3 Minuten prüfen (mit 60s-Cache der API also ~1 Request/3 Min).
const RESULT_CRON = "*/3 * * * *";
// Nur Spiele posten, deren Anpfiff höchstens so lange her ist (Restart-Schutz).
export const RESULT_MAX_AGE_MIN = 240;

const posted = new Set<number>();

/**
 * Beim Start: bereits beendete Spiele als "gepostet" markieren. So postet ein
 * Neustart/Redeploy KEINE alten Ergebnisse erneut (verhindert Doppel-Posts
 * durch frisch gestartete Instanzen).
 */
export function primePosted(matches: Match[]): number {
  let count = 0;
  for (const m of matches) {
    if (m.status === "FINISHED") {
      posted.add(m.id);
      count++;
    }
  }
  return count;
}

/** Minuten seit Anpfiff. */
function minutesSinceKickoff(match: Match, now: number): number {
  return (now - parseUtc(match.utcDate).getTime()) / 60_000;
}

/** True, wenn das Ergebnis dieses Spiels jetzt gepostet werden soll. */
export function isResultDue(match: Match, now: number = Date.now()): boolean {
  if (match.status !== "FINISHED") return false;
  const age = minutesSinceKickoff(match, now);
  return age > 0 && age <= RESULT_MAX_AGE_MIN;
}

/** Prüft gestrige + heutige Spiele und postet neue Endstände. */
export async function checkResults(): Promise<void> {
  try {
    // Gestern + heute (MESZ) abdecken — fängt auch Spiele, die nach Mitternacht
    // enden. Konsistent mit getMatchesByDate (UTC-Fenster).
    const today = todayApiDate();
    const matches = await getMatchesBetween(previousApiDate(today), today);

    const now = Date.now();
    for (const match of matches) {
      if (posted.has(match.id)) continue;
      if (!isResultDue(match, now)) continue;

      posted.add(match.id);
      const [venue, goals] = await Promise.all([
        getVenue(match.homeTeam.name, match.awayTeam.name),
        getMatchGoals(match.homeTeam.name, match.awayTeam.name),
      ]);
      await postEmbeds([buildResultEmbed(match, venue, goals)]);
      const line = `${match.homeTeam.name} ${match.score.fullTime.home}-${match.score.fullTime.away} ${match.awayTeam.name}`;
      recordEvent("result", line);
      logger.info(`Ergebnis gepostet: ${line}`);
    }
  } catch (error: unknown) {
    logger.error("Ergebnis-Check fehlgeschlagen", error);
  }
}

/** Registriert den Cron-Job (alle 3 Minuten). */
export function startMatchResult(): ScheduledTask {
  logger.info(`Match Result geplant: ${RESULT_CRON} (${TIMEZONE})`);
  return cron.schedule(RESULT_CRON, () => void checkResults(), {
    timezone: TIMEZONE,
  });
}
