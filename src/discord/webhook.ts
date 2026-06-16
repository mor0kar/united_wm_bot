/**
 * Discord-Ausgabe über einen Channel-Webhook.
 *
 * Der Bot postet nur (Morgen-Digest, Reminder, Ergebnisse, Sportschau) —
 * er hört nicht zu. Deshalb kein Bot-Token / kein Gateway, sondern ein
 * simpler Webhook. Wir nutzen discord.js `WebhookClient`, damit wir
 * weiterhin `EmbedBuilder` und sauberes Embed-Handling bekommen.
 *
 * Modi (siehe config.mode):
 *   - "live": postet in DISCORD_WEBHOOK_URL (Produktion)
 *   - "test": postet in TEST_WEBHOOK_URL, oder — falls nicht gesetzt — Dry-Run
 *             (nur Log, KEIN Post). So landet kein Testpost im echten Channel.
 *
 * Erstellung der URL: Channel > Bearbeiten > Integrationen > Webhooks > Neuer Webhook.
 */

import { WebhookClient, type EmbedBuilder } from "discord.js";
import { config } from "../config";
import { logger } from "../utils/logger";

// Anzeigename + Avatar des Webhooks für alle Posts.
const WEBHOOK_USERNAME = "WM Bot 2026 🏆";
const WEBHOOK_AVATAR_URL: string | undefined = undefined; // optional später setzen

type Target =
  | { kind: "post"; url: string; label: string }
  | { kind: "dryrun" };

/** Ermittelt das Post-Ziel anhand des Modus. */
function resolveTarget(): Target {
  if (config.mode === "live") {
    return { kind: "post", url: config.discord.webhookUrl(), label: "live" };
  }
  // Test-Modus
  const testUrl = config.discord.testWebhookUrl();
  if (testUrl) {
    return { kind: "post", url: testUrl, label: "test" };
  }
  return { kind: "dryrun" };
}

// WebhookClient pro URL cachen (live und test können beide vorkommen).
const clients = new Map<string, WebhookClient>();
function clientFor(url: string): WebhookClient {
  let client = clients.get(url);
  if (!client) {
    client = new WebhookClient({ url });
    clients.set(url, client);
  }
  return client;
}

/** Postet eine einfache Textnachricht. */
export async function postMessage(content: string): Promise<void> {
  const target = resolveTarget();
  if (target.kind === "dryrun") {
    logger.info(`[DRY-RUN] Nachricht NICHT gepostet: "${content}"`);
    return;
  }
  try {
    await clientFor(target.url).send({
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

  const target = resolveTarget();
  if (target.kind === "dryrun") {
    const titles = embeds
      .map((e) => e.toJSON().title ?? "(ohne Titel)")
      .join(" | ");
    logger.info(`[DRY-RUN] ${embeds.length} Embed(s) NICHT gepostet: ${titles}`);
    return;
  }

  try {
    // Discord-Limit: max. 10 Embeds pro Nachricht -> ggf. in Batches senden.
    for (let i = 0; i < embeds.length; i += 10) {
      const batch = embeds.slice(i, i + 10);
      await clientFor(target.url).send({
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
