/**
 * Ergebnis-Post nach Spielende.
 * Endstand mit Flaggen, Halbzeitstand falls vorhanden, Wettbewerb/Stadion.
 */

import { EmbedBuilder } from "discord.js";
import type { Match } from "../api/footballData";
import type { Venue } from "../api/worldcup26";
import { formatTime, parseUtc } from "../utils/time";
import {
  COLOR_RED,
  matchupWithScore,
  stageLabel,
  venueLine,
} from "./shared";

export function buildResultEmbed(
  match: Match,
  venue: Venue | null,
): EmbedBuilder {
  const kickoff = formatTime(parseUtc(match.utcDate));
  const embed = new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle("🏁 Abpfiff — Endstand")
    .setDescription(matchupWithScore(match))
    .addFields(
      { name: "Wettbewerb", value: stageLabel(match), inline: true },
      { name: "Anstoß", value: `${kickoff} MESZ`, inline: true },
    )
    .setTimestamp(new Date());

  const ht = match.score.halfTime;
  if (ht.home !== null && ht.away !== null) {
    embed.addFields({
      name: "Halbzeit",
      value: `${ht.home} – ${ht.away}`,
      inline: true,
    });
  }

  embed.addFields({ name: "Stadion", value: venueLine(venue), inline: false });
  return embed;
}
