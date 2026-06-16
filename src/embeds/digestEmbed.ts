/**
 * Tagesübersicht (Morgen-Digest, 08:00 MESZ).
 * Listet alle Spiele des Tages mit Anstoßzeit, Teams und Stadion.
 */

import { EmbedBuilder } from "discord.js";
import { formatDate, formatTime, parseUtc } from "../utils/time";
import {
  COLOR_GOLD,
  matchup,
  matchupWithScore,
  stageLabel,
  venueLine,
} from "./shared";
import type { MatchWithVenue } from "./shared";

export function buildDigestEmbed(
  entries: MatchWithVenue[],
  date: Date = new Date(),
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOR_GOLD)
    .setTitle(`⚽ WM 2026 — Spiele am ${formatDate(date)}`)
    .setTimestamp(date);

  if (entries.length === 0) {
    embed.setDescription("Heute spielfrei. 😴 Morgen geht's weiter!");
    return embed;
  }

  // Spiele chronologisch sortieren
  const sorted = [...entries].sort(
    (a, b) =>
      parseUtc(a.match.utcDate).getTime() - parseUtc(b.match.utcDate).getTime(),
  );

  embed.setDescription(
    `**${entries.length}** ${entries.length === 1 ? "Spiel" : "Spiele"} heute:`,
  );

  for (const { match, venue } of sorted) {
    const time = formatTime(parseUtc(match.utcDate));
    let header: string;
    let body: string;

    if (match.status === "FINISHED") {
      // Beendete Spiele (auch die nächtlichen) mit Endstand statt Anstoßzeit.
      header = `🏁 Beendet — ${stageLabel(match)}`;
      body = matchupWithScore(match);
    } else if (match.status === "IN_PLAY" || match.status === "PAUSED") {
      header = `🔴 Läuft (${time} MESZ) — ${stageLabel(match)}`;
      body = matchupWithScore(match);
    } else {
      header = `🕐 ${time} MESZ — ${stageLabel(match)}`;
      body = matchup(match);
    }

    embed.addFields({ name: header, value: `${body}\n📍 ${venueLine(venue)}` });
  }

  return embed;
}
