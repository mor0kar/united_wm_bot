/**
 * Discord-Ausgabe über einen Channel-Webhook.
 *
 * Der Bot postet nur (Morgen-Digest, Reminder, Ergebnisse, Sportschau) —
 * er hört nicht zu. Deshalb kein Bot-Token / kein Gateway, sondern ein
 * simpler Webhook. Wir nutzen discord.js `WebhookClient`, damit wir
 * weiterhin `EmbedBuilder` und sauberes Embed-Handling bekommen.
 *
 * Erstellung der URL: Channel > Bearbeiten > Integrationen > Webhooks > Neuer Webhook.
 */

import { WebhookClient, type EmbedBuilder } from "discord.js";
import { config } from "../config";
import { logger } from "../utils/logger";

// Anzeigename + Avatar des Webhooks für alle Posts.
const WEBHOOK_USERNAME = "WM Bot 2026 🏆";
const WEBHOOK_AVATAR_URL: string | undefined = undefined; // optional später setzen

let webhook: WebhookClient | null = null;

function getWebhook(): WebhookClient {
  if (webhook) return webhook;
  webhook = new WebhookClient({ url: config.discord.webhookUrl() });
  return webhook;
}

/** Postet eine einfache Textnachricht. */
export async function postMessage(content: string): Promise<void> {
  try {
    await getWebhook().send({
      content,
      username: WEBHOOK_USERNAME,
      avatarURL: WEBHOOK_AVATAR_URL,
    });
  } catch (error: unknown) {
    logger.error("Webhook-Textnachricht fehlgeschlagen", error);
    throw error;
  }
}

/**
 * Postet ein oder mehrere Embeds (Discord erlaubt bis zu 10 pro Nachricht).
 * Optionaler Begleittext.
 */
export async function postEmbeds(
  embeds: EmbedBuilder[],
  content?: string,
): Promise<void> {
  if (embeds.length === 0) {
    logger.warn("postEmbeds ohne Embeds aufgerufen — nichts gesendet");
    return;
  }
  try {
    // Discord-Limit: max. 10 Embeds pro Nachricht -> ggf. in Batches senden.
    for (let i = 0; i < embeds.length; i += 10) {
      const batch = embeds.slice(i, i + 10);
      await getWebhook().send({
        content: i === 0 ? content : undefined,
        embeds: batch,
        username: WEBHOOK_USERNAME,
        avatarURL: WEBHOOK_AVATAR_URL,
      });
    }
  } catch (error: unknown) {
    logger.error("Webhook-Embed fehlgeschlagen", error);
    throw error;
  }
}
