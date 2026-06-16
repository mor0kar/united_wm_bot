/**
 * Gemeinsame "Nacht-Spiel"-Regel für Reminder und Ergebnis-Post.
 *
 * Spiele mit Anpfiff vor dieser MESZ-Stunde (also Nacht-/Frühmorgen-Spiele
 * ab Mitternacht, z.B. 00:00 / 03:00 MESZ) sollen NICHTS in Echtzeit posten —
 * weder einen 30-Min-Reminder noch einen Ergebnis-Post. Ihre Resultate
 * erscheinen stattdessen im Morgen-Digest (10:00 MESZ).
 *
 * Die Grenze liegt im spiellosen Tagfenster (~06:00–18:00 MESZ), damit sie
 * alle Nacht-Spiele erfasst und keine Abendspiele.
 */

import type { Match } from "../api/footballData";
import { berlinHour, parseUtc } from "../utils/time";

export const NIGHT_KICKOFF_BEFORE_HOUR = 12;

/** True, wenn der Anpfiff vor 12:00 MESZ liegt (= Nacht-/Frühmorgen-Spiel). */
export function isNightKickoff(match: Match): boolean {
  return berlinHour(parseUtc(match.utcDate)) < NIGHT_KICKOFF_BEFORE_HOUR;
}
