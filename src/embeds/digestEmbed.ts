/**
 * Tagesübersicht (Morgen-Digest, 08:30 MESZ).
 * Listet alle Spiele des Tages mit Anstoßzeit/Endstand, Teams und Stadion.
 *
 * Liefert ein Array von Embeds: Discord erlaubt max. 25 Felder pro Embed,
 * deshalb werden Spiele bei Bedarf auf mehrere Embeds aufgeteilt.
 */

import { EmbedBuilder, type APIEmbedField } from "discord.js";
import { formatDate, formatTime, parseUtc } from "../utils/time";
import {
  COLOR_GOLD,
  matchup,
  matchupWithScore,
  stageLabel,
  venueLine,
} from "./shared";
import type { MatchWithVenue } from "./shared";

// Discord-Limit: max. 25 Felder pro Embed.
const MAX_FIELDS_PER_EMBED = 25;

export function buildDigestEmbed(
  entries: MatchWithVenue[],
  date: Date = new Date(),
): EmbedBuilder[] {
  const title = `⚽ WM 2026 — Spiele am ${formatDate(date)}`;

  if (entries.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(COLOR_GOLD)
        .setTitle(title)
        .setDescription("Heute spielfrei. 😴 Morgen geht's weiter!")
        .setTimestamp(date),
    ];
  }

  // Spiele chronologisch sortieren und in Felder umwandeln.
  const sorted = [...entries].sort(
    (a, b) =>
      parseUtc(a.match.utcDate).getTime() - parseUtc(b.match.utcDate).getTime(),
  );

  const fields: APIEmbedField[] = sorted.map(({ match, venue }) => {
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

    return { name: header, value: `${body}\n📍 ${venueLine(venue)}` };
  });

  // Felder auf mehrere Embeds aufteilen (max. 25 pro Embed).
  const embeds: EmbedBuilder[] = [];
  for (let i = 0; i < fields.length; i += MAX_FIELDS_PER_EMBED) {
    const chunk = fields.slice(i, i + MAX_FIELDS_PER_EMBED);
    const embed = new EmbedBuilder()
      .setColor(COLOR_GOLD)
      .setTitle(i === 0 ? title : `${title} (Fortsetzung)`)
      .addFields(chunk);
    if (i === 0) {
      embed.setDescription(
        `**${entries.length}** ${entries.length === 1 ? "Spiel" : "Spiele"} heute:`,
      );
    }
    embed.setTimestamp(date);
    embeds.push(embed);
  }

  return embeds;
}
