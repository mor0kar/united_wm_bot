/**
 * Sportschau-Zusammenfassung.
 * Embed mit Titel, Link und Thumbnail, sobald ein Highlight-Clip online ist.
 */

import { EmbedBuilder } from "discord.js";
import { COLOR_GOLD } from "./shared";

export interface SportschauClip {
  title: string;
  url: string;
  thumbnailUrl?: string;
  description?: string;
}

export function buildSportschauEmbed(clip: SportschauClip): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOR_GOLD)
    .setTitle(`📺 ${clip.title}`)
    .setURL(clip.url)
    .setFooter({ text: "Quelle: sportschau.de" })
    .setTimestamp(new Date());

  if (clip.description) {
    embed.setDescription(clip.description);
  }
  if (clip.thumbnailUrl) {
    embed.setImage(clip.thumbnailUrl);
  }

  return embed;
}
