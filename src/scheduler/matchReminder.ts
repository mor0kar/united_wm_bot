/**
 * 30-Minuten-Reminder vor Anpfiff.
 *
 * Ansatz: jede Minute prüfen, welche Spiele in ~30 Min anstoßen, und einmalig
 * einen Reminder posten. Der Zustand (welche IDs schon erinnert wurden) liegt
 * im Speicher — bei Neustart wird er aus der API neu abgeleitet, deshalb ein
 * enges Zeitfenster, damit ein Restart keinen falschen "in 30 Min"-Post auslöst.
 *
 * Es werden heutige UND morgige Spiele geprüft, damit Anpfiffe kurz nach
 * Mitternacht (Reminder noch am Vortag) zuverlässig erfasst werden.
 */

import cron, { type ScheduledTask } from "node-cron";
import {
  getMatchesToday,
  getMatchesTomorrow,
  type Match,
} from "../api/footballData";
import { getVenue } from "../api/worldcup26";
import { postEmbeds } from "../discord/webhook";
import { buildReminderEmbed } from "../embeds/reminderEmbed";
import { berlinHour, parseUtc, TIMEZONE } from "../utils/time";
import { recordEvent } from "../status";
import { logger } from "../utils/logger";

export const REMINDER_LEAD_MIN = 30;
// Reminder feuert, wenn die Restzeit in (LEAD - WINDOW, LEAD + 0.5] liegt.
const REMINDER_WINDOW_MIN = 2;
// Reminder nur für Abendspiele VOR Mitternacht. Spiele mit Anpfiff vor dieser
// MESZ-Stunde (Nacht-/Vormittagsspiele, z.B. 00:00 / 03:00 / 06:00 MESZ) bekommen
// keinen Reminder. Die Grenze liegt im spiellosen Tagfenster (~06:00–18:00 MESZ).
// (Ergebnis-Post kommt weiterhin für ALLE Spiele.)
const REMINDER_MIN_KICKOFF_HOUR = 12;

// IDs bereits erinnerter Spiele (Dedupe innerhalb eines Prozess-Laufs).
const reminded = new Set<number>();

/** Restminuten bis Anpfiff (kann negativ sein). */
export function minutesUntilKickoff(match: Match, now: number = Date.now()): number {
  return (parseUtc(match.utcDate).getTime() - now) / 60_000;
}

/** True, wenn jetzt der Reminder für dieses Spiel fällig ist. */
export function isReminderDue(match: Match, now: number = Date.now()): boolean {
  if (match.status !== "SCHEDULED" && match.status !== "TIMED") return false;
  // Nur Abendspiele vor Mitternacht — Nacht-/Vormittagsspiele bekommen keinen Reminder.
  if (berlinHour(parseUtc(match.utcDate)) < REMINDER_MIN_KICKOFF_HOUR) return false;
  const remaining = minutesUntilKickoff(match, now);
  return (
    remaining > REMINDER_LEAD_MIN - REMINDER_WINDOW_MIN &&
    remaining <= REMINDER_LEAD_MIN + 0.5
  );
}

/** Prüft heutige + morgige Spiele und postet fällige Reminder. */
export async function checkReminders(): Promise<void> {
  try {
    const [today, tomorrow] = await Promise.all([
      getMatchesToday(),
      getMatchesTomorrow(),
    ]);
    const byId = new Map<number, Match>();
    for (const m of [...today, ...tomorrow]) byId.set(m.id, m);

    const now = Date.now();
    for (const match of byId.values()) {
      if (reminded.has(match.id)) continue;
      if (!isReminderDue(match, now)) continue;

      reminded.add(match.id);
      const venue = await getVenue(match.homeTeam.name, match.awayTeam.name);
      await postEmbeds([buildReminderEmbed(match, venue)]);
      recordEvent(
        "reminder",
        `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      );
      logger.info(
        `Reminder gepostet: ${match.homeTeam.name} vs ${match.awayTeam.name}`,
      );
    }
  } catch (error: unknown) {
    logger.error("Reminder-Check fehlgeschlagen", error);
  }
}

/** Registriert den Cron-Job (jede Minute). */
export function startMatchReminder(): ScheduledTask {
  logger.info(`Match Reminder geplant: jede Minute (${TIMEZONE})`);
  return cron.schedule("* * * * *", () => void checkReminders(), {
    timezone: TIMEZONE,
  });
}
