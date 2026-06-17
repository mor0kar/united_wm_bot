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
