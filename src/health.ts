/**
 * Minimaler Healthcheck-HTTP-Server.
 *
 * Der Bot selbst ist Webhook-basiert (kein offener Port nötig), aber Railway &
 * Co. erwarten oft einen lauschenden Port, sonst gilt der Deploy als "crashed".
 * Dieser Server bindet an process.env.PORT und antwortet mit einem kleinen
 * Status-JSON — auch praktisch für Uptime-Checks.
 *
 * Bewusst ohne externe Library (Node-eingebautes `http`).
 */

import { createServer } from "node:http";
import { logger } from "./utils/logger";

const startedAt = new Date();

export function startHealthServer(): void {
  // Railway/Render setzen PORT automatisch; lokal Default 3000.
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);

  const server = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          service: "wm-bot-2026",
          startedAt: startedAt.toISOString(),
          uptimeSeconds: Math.round(process.uptime()),
        }),
      );
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  server.on("error", (error) => {
    logger.error("Health-Server Fehler", error);
  });

  server.listen(port, () => {
    logger.info(`Health-Server lauscht auf Port ${port}`);
  });
}
