/**
 * Zentraler Zugriff auf Umgebungsvariablen.
 * Lädt .env und stellt typisierte, validierte Werte bereit.
 * Secrets kommen ausschließlich aus der Umgebung, nie hardcoded (siehe AGENTS.md).
 */

import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Umgebungsvariable ${name} fehlt. Bitte in .env setzen (siehe .env.example).`,
    );
  }
  return value.trim();
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export const config = {
  discord: {
    // Webhook-URL aus den Channel-Einstellungen (Integrationen > Webhooks).
    // Kein Bot-Token nötig — der Bot postet nur, er hört nicht zu.
    webhookUrl: () => required("DISCORD_WEBHOOK_URL"),
  },
  footballData: {
    apiKey: () => required("FOOTBALL_DATA_API_KEY"),
  },
  logLevel: optional("LOG_LEVEL") ?? "info",
} as const;
