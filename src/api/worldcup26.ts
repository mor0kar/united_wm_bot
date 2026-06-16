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

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();

async function cachedGet<T>(path: string, ttlMs: number): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.value as T;
  }
  const response = await axios.get<T>(`${BASE_URL}${path}`, { timeout: 12_000 });
  cache.set(path, { value: response.data, expiresAt: Date.now() + ttlMs });
  return response.data;
}

// --- Team-Namen normalisieren (für robustes Matching trotz Schreibvarianten) ---

const TEAM_ALIASES: Record<string, string> = {
  turkey: "turkiye",
  "south korea": "korea republic",
  "ivory coast": "cote divoire",
  "united states": "usa",
  "cape verde": "cabo verde",
  iran: "ir iran",
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
  const data = await cachedGet<StadiumsResponse>("/get/stadiums", SIX_HOURS_MS);
  return data.stadiums ?? [];
}

/** Alle Spiele. */
export async function getGames(): Promise<RawGame[]> {
  const data = await cachedGet<GamesResponse>("/get/games", SIX_HOURS_MS);
  return data.games ?? [];
}

// In-Memory-Index: pairKey -> Venue (lazy aufgebaut, bei Cache-Refresh neu)
let venueIndex: Map<string, Venue> | null = null;
let venueIndexExpiresAt = 0;

async function buildVenueIndex(): Promise<Map<string, Venue>> {
  if (venueIndex && Date.now() < venueIndexExpiresAt) {
    return venueIndex;
  }

  const [stadiums, games] = await Promise.all([getStadiums(), getGames()]);
  const stadiumById = new Map<string, RawStadium>();
  for (const s of stadiums) stadiumById.set(s.id, s);

  const index = new Map<string, Venue>();
  for (const game of games) {
    // K.o.-Spiele ohne feststehende Teams überspringen (Namen fehlen dort)
    if (!game.home_team_name_en || !game.away_team_name_en) continue;
    const stadium = stadiumById.get(game.stadium_id);
    if (!stadium) continue;
    const venue: Venue = {
      stadium: stadium.name_en,
      city: stadium.city_en,
    };
    // Beide Richtungen indexieren, falls Heim/Auswärts vertauscht geliefert wird.
    index.set(pairKey(game.home_team_name_en, game.away_team_name_en), venue);
    index.set(pairKey(game.away_team_name_en, game.home_team_name_en), venue);
  }

  venueIndex = index;
  venueIndexExpiresAt = Date.now() + SIX_HOURS_MS;
  return index;
}

/**
 * Liefert Stadion + Stadt für eine Team-Paarung, oder `null` wenn nicht
 * auffindbar. Fehler werden geloggt, führen aber zu `null` (Anreicherung
 * ist optional, darf den Post nie blockieren).
 */
export async function getVenue(
  homeTeam: string,
  awayTeam: string,
): Promise<Venue | null> {
  try {
    const index = await buildVenueIndex();
    return index.get(pairKey(homeTeam, awayTeam)) ?? null;
  } catch (error: unknown) {
    logger.warn(
      `worldcup26.ir Venue-Lookup fehlgeschlagen für ${homeTeam} vs ${awayTeam} — fahre ohne Stadion fort`,
      error,
    );
    return null;
  }
}
