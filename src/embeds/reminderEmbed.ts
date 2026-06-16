/**
 * 30-Minuten-Reminder vor Anpfiff.
 * Teams + Flaggen, Anstoßzeit MESZ, Stadion + Stadt.
 */

import { EmbedBuilder } from "discord.js";
import type { Match } from "../api/footballData";
import type { Venue } from "../api/worldcup26";
import { formatTime, parseUtc } from "../utils/time";
import { COLOR_RED, matchup, stageLabel, venueLine } from "./shared";

export function buildReminderEmbed(
  match: Match,
  venue: Venue | null,
): EmbedBuilder {
  const time = formatTime(parseUtc(match.utcDate));

  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle("⏰ Gleich geht's los — Anpfiff in 30 Minuten!")
    .setDescription(matchup(match))
    .addFields(
      { name: "Anstoß", value: `${time} MESZ`, inline: true },
      { name: "Wettbewerb", value: stageLabel(match), inline: true },
      { name: "Stadion", value: venueLine(venue), inline: false },
    )
    .setTimestamp(parseUtc(match.utcDate));
}
