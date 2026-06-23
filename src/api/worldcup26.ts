/**
 * Wrapper für worldcup26.ir — Fallback-/Anreicherungsquelle.
 *
 * Zweck: football-data.org Free Tier liefert KEIN `venue` (verifiziert 2026-06-16).
 * worldcup26.ir hat pro Spiel eine `stadium_id` und beide Team-Namen (englisch,
 * gleiche Schreibweise wie football-data). Wir mappen also:
 *   (homeTeam, awayTeam) -> game.stadium_id -> stadium (name + city)
 *
 * Kein Auth nötig. Community-Projekt — nur als Fallback nutzen, nie als Primärquelle.
 * Wenn keine Zuordnung gefunden wird, liefern wir `null` (nie ein Fehler).
 */

import axios from "axios";
import { logger } from "../utils/logger";

const BASE_URL = "https://worldcup26.ir";

// --- Raw Response Shapes (nur was wir brauchen) ---

interface RawStadium {
  id: string;
  name_en: string;
  fifa_name: string;
  city_en: string;
  country_en: string;
}

interface RawGame {
  id: string;
  home_team_name_en: string;
  away_team_name_en: string;
  stadium_id: string;
  group: string;
  matchday: string;
  // Torschützen als roher Postgres-Array-String, z.B. {"K. Mbappé 14'","..."}
  // (kann auch "null" oder leer sein). Karten liefert worldcup26.ir NICHT.
  home_scorers?: string;
  away_scorers?: string;
}

interface StadiumsResponse {
  stadiums: RawStadium[];
}

interface GamesResponse {
  games: RawGame[];
}

/** Öffentlicher Venue-Typ für Embeds. */
export interface Venue {
  stadium: string;
  city: string;
}

/** Ein Tor: Schütze + Minute (z.B. "14'" oder "90+4'"). */
export interface Goal {
  scorer: string;
  minute: string;
}

/** Torschützen eines Spiels, getrennt nach Heim/Auswärts. */
export interface MatchGoals {
  home: Goal[];
  away: Goal[];
}

// --- Cache (Stadien/Spiele sind quasi statisch -> lange TTL) ---

// worldcup26.ir ist ein langsames Community-Projekt (~12s/Request) und bricht
// zeitweise ab. Deshalb großzügiger Timeout + Retries.
const HTTP_TIMEOUT_MS = 20_000;
const HTTP_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GET mit Retries + großzügigem Timeout, sauberes Fehler-Logging (kein Dump). */
async function httpGet<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= HTTP_RETRIES; attempt++) {
    try {
      const response = await axios.get<T>(`${BASE_URL}${path}`, {
        timeout: HTTP_TIMEOUT_MS,
      });
      return response.data;
    } catch (error: unknown) {
      lastError = error;
      const reason = axios.isAxiosError(error)
        ? (error.code ?? error.message)
        : String(error);
      logger.warn(
        `worldcup26.ir ${path} Versuch ${attempt}/${HTTP_RETRIES} fehlgeschlagen: ${reason}`,
      );
      if (attempt < HTTP_RETRIES) await delay(1000 * attempt);
    }
  }
  throw lastError;
}

// --- Team-Namen normalisieren (für robustes Matching trotz Schreibvarianten) ---

const TEAM_ALIASES: Record<string, string> = {
  turkey: "turkiye",
  "south korea": "korea republic",
  "ivory coast": "cote divoire",
  "united states": "usa",
  "cape verde": "cabo verde",
  iran: "ir iran",
  // football-data: "Czechia" | worldcup26: "Czech Republic"
  czechia: "czech republic",
  // football-data: "Bosnia-Herzegovina" (Bindestrich entfällt beim Normalisieren
  // -> "bosniaherzegovina") | worldcup26: "Bosnia and Herzegovina"
  bosniaherzegovina: "bosnia and herzegovina",
  // football-data: "Congo DR" | worldcup26: "Democratic Republic of the Congo"
  "congo dr": "congo",
  "dr congo": "congo",
  "democratic republic of congo": "congo",
  "democratic republic of the congo": "congo",
};

function normalizeTeam(name: string): string {
  if (!name) return "";
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Diakritika (combining marks) entfernen
    .replace(/[^a-z\s]/g, "")
    .trim();
  return TEAM_ALIASES[base] ?? base;
}

function pairKey(home: string, away: string): string {
  return `${normalizeTeam(home)}|${normalizeTeam(away)}`;
}

// --- Öffentliche API ---

/** Alle Stadien. */
export async function getStadiums(): Promise<RawStadium[]> {
  const data = await httpGet<StadiumsResponse>("/get/stadiums");
  return data.stadiums ?? [];
}

/** Alle Spiele. */
export async function getGames(): Promise<RawGame[]> {
  const data = await httpGet<GamesResponse>("/get/games");
  return data.games ?? [];
}

// --- Venue-Index mit stale-while-revalidate ---
// Stadion-Zuordnungen sind für das Turnier statisch. Ein einmal gebauter Index
// wird bei worldcup26.ir-Ausfällen NICHT geleert — Stadien verschwinden nie mehr.

const INDEX_TTL_MS = 12 * 60 * 60 * 1000;
let venueIndex: Map<string, Venue> | null = null;
let venueIndexBuiltAt = 0;
let buildInFlight: Promise<Map<string, Venue>> | null = null;

async function rebuildIndex(): Promise<Map<string, Venue>> {
  const [stadiums, games] = await Promise.all([getStadiums(), getGames()]);
  const stadiumById = new Map<string, RawStadium>();
  for (const s of stadiums) stadiumById.set(s.id, s);

  const index = new Map<string, Venue>();
  for (const game of games) {
    // K.o.-Spiele ohne feststehende Teams überspringen (Namen fehlen dort)
    if (!game.home_team_name_en || !game.away_team_name_en) continue;
    const stadium = stadiumById.get(game.stadium_id);
    if (!stadium) continue;
    const venue: Venue = { stadium: stadium.name_en, city: stadium.city_en };
    // Beide Richtungen indexieren, falls Heim/Auswärts vertauscht geliefert wird.
    index.set(pairKey(game.home_team_name_en, game.away_team_name_en), venue);
    index.set(pairKey(game.away_team_name_en, game.home_team_name_en), venue);
  }

  venueIndex = index;
  venueIndexBuiltAt = Date.now();
  logger.info(`worldcup26.ir Venue-Index gebaut (${index.size / 2} Spiele)`);
  return index;
}

/**
 * Liefert den Venue-Index. Bei Fehlern wird der letzte gute Stand serviert
 * (stale-while-revalidate). Nur EIN Build gleichzeitig (API ist langsam).
 */
async function getIndex(): Promise<Map<string, Venue> | null> {
  const fresh = venueIndex && Date.now() - venueIndexBuiltAt < INDEX_TTL_MS;
  if (fresh) return venueIndex;

  if (!buildInFlight) {
    buildInFlight = rebuildIndex().finally(() => {
      buildInFlight = null;
    });
  }

  // Veralteten Index haben? -> sofort zurück, Rebuild läuft im Hintergrund weiter.
  if (venueIndex) {
    buildInFlight.catch(() => undefined);
    return venueIndex;
  }

  // Noch nie erfolgreich gebaut -> auf den Build warten.
  try {
    return await buildInFlight;
  } catch {
    return null; // Fehler bereits in httpGet geloggt
  }
}

/** Baut den Venue-Index beim Start vor (fire-and-forget). */
export function warmVenueIndex(): void {
  void getIndex().then((idx) => {
    if (!idx) {
      logger.warn(
        "worldcup26.ir Venue-Index beim Start nicht gebaut — wird bei Bedarf erneut versucht",
      );
    }
  });
}

/**
 * Liefert Stadion + Stadt für eine Team-Paarung, oder `null` wenn nicht
 * auffindbar. Blockiert nie einen Post (Anreicherung ist optional).
 */
export async function getVenue(
  homeTeam: string,
  awayTeam: string,
): Promise<Venue | null> {
  const index = await getIndex();
  if (!index) return null;
  return index.get(pairKey(homeTeam, awayTeam)) ?? null;
}

// --- Torschützen ---
// Anders als Stadien ändern sich Torschützen während/nach dem Spiel. Deshalb
// KEIN langer Venue-Index, sondern ein eigener kurzlebiger games-Cache: ein
// gerade beendetes Spiel hat seine Schützen so nach spätestens TTL parat.

const GAMES_TTL_MS = 2 * 60 * 1000; // 2 Min — frisch genug nach Abpfiff
let gamesCache: { at: number; games: RawGame[] } | null = null;

async function getGamesCached(): Promise<RawGame[]> {
  if (gamesCache && Date.now() - gamesCache.at < GAMES_TTL_MS) {
    return gamesCache.games;
  }
  const games = await getGames();
  gamesCache = { at: Date.now(), games };
  return games;
}

/**
 * Parst das rohe Torschützen-Feld von worldcup26.ir in einzelne Tore.
 *
 * Format ist ein Postgres-Array-String, der mit geraden ODER typografischen
 * Anführungszeichen geliefert wird, z.B.:
 *   {"K. Mbappé 14'","K. Mbappé 54'"}
 *   {“J. Quiñones 9'”,”R. Jiménez 67'”}
 * "null"/leer -> keine Tore.
 */
export function parseScorers(raw: string | null | undefined): Goal[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (s === "" || s.toLowerCase() === "null" || s === "{}") return [];

  // Jeden in Anführungszeichen (gerade " oder typografisch “ ” ) gefassten
  // Eintrag herausziehen — robust gegen Kommata zwischen den Einträgen.
  const quoted = s.match(/[“"”]([^“"”]+)[“"”]/g) ?? [];
  const goals: Goal[] = [];
  for (const q of quoted) {
    const text = q.replace(/[“"”]/g, "").trim();
    if (!text) continue;
    // Minute am Ende abtrennen: "Name 14'" / "Name 90+4'"
    const m = text.match(/^(.*?)\s+(\d+(?:\+\d+)?')$/);
    if (m) goals.push({ scorer: m[1].trim(), minute: m[2] });
    else goals.push({ scorer: text, minute: "" });
  }
  return goals;
}

/**
 * Liefert die Torschützen eines Spiels (Heim/Auswärts in der Reihenfolge der
 * übergebenen Teams), oder `null` wenn nicht auffindbar. Blockiert nie einen
 * Post — Anreicherung ist optional. Karten gibt es bei worldcup26.ir nicht.
 */
export async function getMatchGoals(
  homeTeam: string,
  awayTeam: string,
): Promise<MatchGoals | null> {
  let games: RawGame[];
  try {
    games = await getGamesCached();
  } catch {
    return null; // Fehler bereits in httpGet geloggt
  }

  const wantHome = normalizeTeam(homeTeam);
  const wantAway = normalizeTeam(awayTeam);
  for (const g of games) {
    const gh = normalizeTeam(g.home_team_name_en);
    const ga = normalizeTeam(g.away_team_name_en);
    if (gh === wantHome && ga === wantAway) {
      return {
        home: parseScorers(g.home_scorers),
        away: parseScorers(g.away_scorers),
      };
    }
    // Heim/Auswärts bei worldcup26 vertauscht -> Schützen entsprechend drehen.
    if (gh === wantAway && ga === wantHome) {
      return {
        home: parseScorers(g.away_scorers),
        away: parseScorers(g.home_scorers),
      };
    }
  }
  return null;
}
