/**
 * Ergebnis-Post nach Spielende.
 * Endstand mit Flaggen, Halbzeitstand falls vorhanden, Wettbewerb/Stadion.
 */

import { EmbedBuilder } from "discord.js";
import type { Match } from "../api/footballData";
import type { Goal, MatchGoals, Venue } from "../api/worldcup26";
import { flagFor } from "../utils/flags";
import { formatTime, parseUtc } from "../utils/time";
import {
  COLOR_RED,
  matchupWithScore,
  stageLabel,
  venueLine,
} from "./shared";

/**
 * Torschützen einer Mannschaft formatieren, gruppiert pro Spieler in
 * Reihenfolge des ersten Tors: "Kylian Mbappé 14', 54'". Leer -> "".
 */
function formatGoals(goals: Goal[]): string {
  if (goals.length === 0) return "";
  const order: string[] = [];
  const minutesByScorer = new Map<string, string[]>();
  for (const g of goals) {
    if (!minutesByScorer.has(g.scorer)) {
      minutesByScorer.set(g.scorer, []);
      order.push(g.scorer);
    }
    if (g.minute) minutesByScorer.get(g.scorer)?.push(g.minute);
  }
  return order
    .map((scorer) => {
      const mins = minutesByScorer.get(scorer) ?? [];
      return mins.length ? `${scorer} ${mins.join(", ")}` : scorer;
    })
    .join("\n");
}

export function buildResultEmbed(
  match: Match,
  venue: Venue | null,
  goals: MatchGoals | null = null,
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

  // Torschützen (sofern auffindbar) je Team — Karten liefert die Quelle nicht.
  if (goals) {
    const homeGoals = formatGoals(goals.home);
    const awayGoals = formatGoals(goals.away);
    if (homeGoals) {
      embed.addFields({
        name: `⚽ ${flagFor(match.homeTeam.name)} ${match.homeTeam.name}`,
        value: homeGoals,
        inline: true,
      });
    }
    if (awayGoals) {
      embed.addFields({
        name: `⚽ ${flagFor(match.awayTeam.name)} ${match.awayTeam.name}`,
        value: awayGoals,
        inline: true,
      });
    }
  }

  embed.addFields({ name: "Stadion", value: venueLine(venue), inline: false });
  return embed;
}
