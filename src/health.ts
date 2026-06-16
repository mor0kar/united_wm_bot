/**
 * Status-/Health-Server (im selben Prozess, kein extra Service).
 *
 * Routen:
 *   GET  /health                 → JSON 200 (Railway-Healthcheck)
 *   GET  /                        → kleine HTML-Status-Seite
 *   GET  /api/status             → JSON: Uptime, nächstes Spiel, letzte Aktionen
 *   POST /api/trigger/digest         ┐ manuelle Trigger, geschützt durch
 *   POST /api/trigger/reminder-check ├ Header `x-dashboard-token`
 *   POST /api/trigger/result-check   ┘ (aktiv nur wenn DASHBOARD_TOKEN gesetzt)
 *
 * Bewusst ohne externe Library (Node-eingebautes `http`).
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  getMatchesToday,
  getMatchesTomorrow,
  type Match,
} from "./api/footballData";
import { postDailyDigest } from "./scheduler/dailyDigest";
import { checkReminders } from "./scheduler/matchReminder";
import { checkResults } from "./scheduler/matchResult";
import { getEvents } from "./status";
import { formatDateTime, parseUtc } from "./utils/time";
import { logger } from "./utils/logger";

const startedAt = new Date();

interface NextMatch {
  home: string;
  away: string;
  kickoff: string;
  status: string;
}

/** Frühestes anstehendes Spiel (heute/morgen), oder null. */
async function getNextMatch(): Promise<NextMatch | null> {
  const [today, tomorrow] = await Promise.all([
    getMatchesToday(),
    getMatchesTomorrow(),
  ]);
  const now = Date.now();
  const upcoming = [...today, ...tomorrow]
    .filter(
      (m: Match) =>
        (m.status === "SCHEDULED" || m.status === "TIMED") &&
        parseUtc(m.utcDate).getTime() > now,
    )
    .sort(
      (a, b) => parseUtc(a.utcDate).getTime() - parseUtc(b.utcDate).getTime(),
    );

  const m = upcoming[0];
  if (!m) return null;
  return {
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    kickoff: formatDateTime(parseUtc(m.utcDate)),
    status: m.status,
  };
}

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Prüft den Dashboard-Token. Ohne gesetzten Token sind Trigger deaktiviert. */
function checkAuth(req: IncomingMessage): "ok" | "disabled" | "forbidden" {
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) return "disabled";
  const provided = req.headers["x-dashboard-token"];
  return provided === expected ? "ok" : "forbidden";
}

async function handleTrigger(
  req: IncomingMessage,
  res: ServerResponse,
  action: () => Promise<void>,
  label: string,
): Promise<void> {
  const auth = checkAuth(req);
  if (auth === "disabled") {
    sendJson(res, 503, { error: "Trigger deaktiviert (DASHBOARD_TOKEN nicht gesetzt)" });
    return;
  }
  if (auth === "forbidden") {
    sendJson(res, 403, { error: "Falscher oder fehlender Token" });
    return;
  }
  logger.info(`Manueller Trigger via Status-Seite: ${label}`);
  void action(); // im Hintergrund laufen lassen, sofort antworten
  sendJson(res, 202, { ok: true, triggered: label });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && url === "/health") {
    sendJson(res, 200, {
      status: "ok",
      service: "wm-bot-2026",
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
    return;
  }

  if (method === "GET" && url === "/api/status") {
    let nextMatch: NextMatch | null = null;
    try {
      nextMatch = await getNextMatch();
    } catch (error: unknown) {
      logger.warn("Status: nächstes Spiel konnte nicht geladen werden", error);
    }
    sendJson(res, 200, {
      status: "ok",
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      triggersEnabled: Boolean(process.env.DASHBOARD_TOKEN),
      nextMatch,
      events: getEvents(),
    });
    return;
  }

  if (method === "POST" && url === "/api/trigger/digest") {
    await handleTrigger(req, res, postDailyDigest, "Daily Digest");
    return;
  }
  if (method === "POST" && url === "/api/trigger/reminder-check") {
    await handleTrigger(req, res, checkReminders, "Reminder-Check");
    return;
  }
  if (method === "POST" && url === "/api/trigger/result-check") {
    await handleTrigger(req, res, checkResults, "Ergebnis-Check");
    return;
  }

  if (method === "GET" && (url === "/" || url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(STATUS_PAGE_HTML);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
}

export function startStatusServer(): void {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error: unknown) => {
      logger.error("Status-Server Request-Fehler", error);
      if (!res.headersSent) sendJson(res, 500, { error: "intern" });
    });
  });
  server.on("error", (error) => logger.error("Status-Server Fehler", error));
  server.listen(port, () => {
    logger.info(`Status-Server lauscht auf Port ${port}`);
  });
}

// --- Statische HTML-Seite (lädt /api/status per fetch, kein Build-Schritt) ---

const STATUS_PAGE_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>WM Bot 2026 — Status</title>
<style>
  :root { --rot:#C0392B; --gold:#FFD700; --bg:#1a1a1a; --card:#262626; --txt:#eee; --muted:#999; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,sans-serif; background:var(--bg); color:var(--txt); padding:24px; }
  h1 { color:var(--gold); margin:0 0 4px; font-size:1.5rem; }
  .sub { color:var(--muted); margin-bottom:20px; font-size:.85rem; }
  .card { background:var(--card); border-radius:12px; padding:16px 18px; margin-bottom:16px; border-left:4px solid var(--rot); }
  .card h2 { margin:0 0 10px; font-size:1rem; color:var(--gold); }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%; background:#2ecc71; margin-right:8px; }
  .next { font-size:1.15rem; font-weight:600; }
  .ev { padding:6px 0; border-bottom:1px solid #333; font-size:.9rem; display:flex; justify-content:space-between; gap:12px; }
  .ev:last-child { border-bottom:none; }
  .ev .k { color:var(--gold); font-weight:600; text-transform:uppercase; font-size:.72rem; letter-spacing:.5px; }
  .ev .t { color:var(--muted); font-size:.78rem; white-space:nowrap; }
  .btns { display:flex; gap:8px; flex-wrap:wrap; }
  button { background:var(--rot); color:#fff; border:none; padding:9px 14px; border-radius:8px; cursor:pointer; font-size:.85rem; }
  button:hover { filter:brightness(1.1); }
  input { background:#111; color:#eee; border:1px solid #444; border-radius:8px; padding:9px 12px; width:100%; margin-bottom:10px; font-size:.85rem; }
  .hint { color:var(--muted); font-size:.78rem; margin-top:8px; }
  .toast { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#333; padding:10px 18px; border-radius:8px; opacity:0; transition:opacity .2s; }
  .toast.show { opacity:1; }
</style>
</head>
<body>
  <h1>🏆 WM Bot 2026</h1>
  <div class="sub" id="uptime">lädt…</div>

  <div class="card">
    <h2>Nächstes Spiel</h2>
    <div class="next" id="next">–</div>
  </div>

  <div class="card">
    <h2>Letzte Aktionen</h2>
    <div id="events">–</div>
  </div>

  <div class="card">
    <h2>Manuelle Trigger</h2>
    <input id="token" type="password" placeholder="Dashboard-Token (wird lokal gespeichert)" />
    <div class="btns">
      <button onclick="trigger('digest')">Digest posten</button>
      <button onclick="trigger('reminder-check')">Reminder-Check</button>
      <button onclick="trigger('result-check')">Ergebnis-Check</button>
    </div>
    <div class="hint" id="trigHint"></div>
  </div>

  <div class="toast" id="toast"></div>

<script>
  const tokenEl = document.getElementById('token');
  tokenEl.value = localStorage.getItem('wmbot_token') || '';
  tokenEl.addEventListener('input', () => localStorage.setItem('wmbot_token', tokenEl.value));

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  function fmtAgo(iso) {
    const s = Math.round((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return s + 's her';
    if (s < 3600) return Math.round(s/60) + 'min her';
    return Math.round(s/3600) + 'h her';
  }

  async function refresh() {
    try {
      const r = await fetch('/api/status');
      const d = await r.json();
      const up = d.uptimeSeconds;
      const upTxt = up < 3600 ? Math.round(up/60)+'min' : Math.round(up/3600)+'h';
      document.getElementById('uptime').innerHTML = '<span class="dot"></span>Online · Uptime ' + upTxt;
      document.getElementById('next').textContent = d.nextMatch
        ? d.nextMatch.home + ' – ' + d.nextMatch.away + '  ·  ' + d.nextMatch.kickoff
        : 'Aktuell kein anstehendes Spiel';
      document.getElementById('events').innerHTML = d.events.length
        ? d.events.map(e => '<div class="ev"><span><span class="k">'+e.kind+'</span> &nbsp;'+e.summary+'</span><span class="t">'+fmtAgo(e.at)+'</span></div>').join('')
        : '<span class="t">noch keine Aktionen</span>';
      document.getElementById('trigHint').textContent = d.triggersEnabled
        ? '' : 'Trigger deaktiviert — setze DASHBOARD_TOKEN in den Env-Vars, um sie zu aktivieren.';
    } catch (e) {
      document.getElementById('uptime').textContent = 'Status nicht erreichbar';
    }
  }

  async function trigger(action) {
    try {
      const r = await fetch('/api/trigger/' + action, {
        method: 'POST',
        headers: { 'x-dashboard-token': tokenEl.value },
      });
      const d = await r.json();
      toast(r.ok ? ('✅ ' + (d.triggered || action)) : ('⚠️ ' + (d.error || 'Fehler')));
      setTimeout(refresh, 1500);
    } catch (e) { toast('⚠️ Netzwerkfehler'); }
  }

  refresh();
  setInterval(refresh, 15000);
</script>
</body>
</html>`;
