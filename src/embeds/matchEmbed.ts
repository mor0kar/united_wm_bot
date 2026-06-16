/**
 * Generisches Embed für ein anstehendes Einzelspiel.
 * Wird z.B. genutzt wenn ein einzelnes Spiel angekündigt wird (nicht der
 * 30-Min-Reminder, der hat ein eigenes Embed mit Countdown-Ton).
 */

import { EmbedBuilder } from "discord.js";
import type { Match } from "../api/footballData";
import type { Venue } from "../api/worldcup26";
import { formatDateTime, parseUtc } from "../utils/time";
import { COLOR_GOLD, matchup, stageLabel, venueLine } from "./shared";

export function buildMatchEmbed(
  match: Match,
  venue: Venue | null,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_GOLD)
    .setTitle("⚽ Nächstes Spiel")
    .setDescription(matchup(match))
    .addFields(
      { name: "Anstoß", value: formatDateTime(parseUtc(match.utcDate)), inline: false },
      { name: "Wettbewerb", value: stageLabel(match), inline: true },
      { name: "Stadion", value: venueLine(venue), inline: true },
    );
}
