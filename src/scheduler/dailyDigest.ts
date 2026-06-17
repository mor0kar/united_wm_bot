/**
 * Morgen-Digest: täglich um 08:30 MESZ alle Spiele des Tages posten.
 * Wenn kein Spiel ansteht, postet das Digest-Embed "Heute spielfrei".
 */

import cron, { type ScheduledTask } from "node-cron";
import { getMatchesToday } from "../api/footballData";
import { getVenue } from "../api/worldcup26";
import { postEmbeds } from "../discord/webhook";
import { buildDigestEmbed } from "../embeds/digestEmbed";
import type { MatchWithVenue } from "../embeds/shared";
import { TIMEZONE } from "../utils/time";
import { recordEvent } from "../status";
import { logger } from "../utils/logger";

// 08:30 MESZ (früh genug für den Morgen, spät genug um nicht zu nerven).
const DIGEST_CRON = "30 8 * * *";

/** Holt die heutigen Spiele, reichert Stadien an und postet die Tagesübersicht. */
export async function postDailyDigest(): Promise<void> {
  try {
    const matches = await getMatchesToday();
    const entries: MatchWithVenue[] = [];
    for (const match of matches) {
      const venue = await getVenue(match.homeTeam.name, match.awayTeam.name);
      entries.push({ match, venue });
    }
    await postEmbeds(buildDigestEmbed(entries));
    recordEvent("digest", `${matches.length} Spiele heute`);
    logger.info(`Daily Digest gepostet (${matches.length} Spiele)`);
  } catch (error: unknown) {
    logger.error("Daily Digest fehlgeschlagen", error);
  }
}

/** Registriert den Cron-Job für den Morgen-Digest. */
export function startDailyDigest(): ScheduledTask {
  logger.info(`Daily Digest geplant: ${DIGEST_CRON} (${TIMEZONE})`);
  return cron.schedule(DIGEST_CRON, () => void postDailyDigest(), {
    timezone: TIMEZONE,
  });
}
