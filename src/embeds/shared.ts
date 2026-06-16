/**
 * Geteilte Helfer für alle Embeds: WM-Farben und Formatierung.
 */

import type { Match } from "../api/footballData";
import type { Venue } from "../api/worldcup26";
import { flagFor } from "../utils/flags";

// WM-Farben (siehe CLAUDE.md)
export const COLOR_RED = 0xc0392b;
export const COLOR_GOLD = 0xffd700;

/** Match plus (optionale) angereicherte Stadion-Info. */
export interface MatchWithVenue {
  match: Match;
  venue: Venue | null;
}

/** "🇫🇷 France – Senegal 🇸🇳" */
export function matchup(match: Match): string {
  const home = `${flagFor(match.homeTeam.name)} ${match.homeTeam.name}`;
  const away = `${match.awayTeam.name} ${flagFor(match.awayTeam.name)}`;
  return `${home} – ${away}`;
}

/** "🇫🇷 France 2 – 0 Senegal 🇸🇳" (für beendete/laufende Spiele) */
export function matchupWithScore(match: Match): string {
  const home = `${flagFor(match.homeTeam.name)} ${match.homeTeam.name}`;
  const away = `${match.awayTeam.name} ${flagFor(match.awayTeam.name)}`;
  const h = match.score.fullTime.home;
  const a = match.score.fullTime.away;
  const score = h !== null && a !== null ? `${h} – ${a}` : "– : –";
  return `${home} **${score}** ${away}`;
}

/** "GROUP_G" / "G" -> "Gruppe G"; Nicht-Gruppenphase -> Stage lesbar. */
export function stageLabel(match: Match): string {
  if (match.group) {
    // football-data liefert "GROUP_G" -> Präfix entfernen, übrig bleibt "G".
    const letter = match.group.toUpperCase().replace(/^GROUP[_\s]?/, "").trim();
    if (letter) return `Gruppe ${letter}`;
  }
  const map: Record<string, string> = {
    GROUP_STAGE: "Gruppenphase",
    LAST_16: "Achtelfinale",
    QUARTER_FINALS: "Viertelfinale",
    SEMI_FINALS: "Halbfinale",
    THIRD_PLACE: "Spiel um Platz 3",
    FINAL: "Finale",
  };
  return map[match.stage] ?? match.stage;
}

/** "Mercedes-Benz Stadium, Atlanta" oder Fallback wenn keine Venue. */
export function venueLine(venue: Venue | null): string {
  if (!venue) return "Stadion: _unbekannt_";
  return `${venue.stadium}, ${venue.city}`;
}
