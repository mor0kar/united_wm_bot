/**
 * Wrapper für die football-data.org v4 API — primäre Datenquelle.
 *
 * - Auth über X-Auth-Token Header (FOOTBALL_DATA_API_KEY aus .env)
 * - Free Tier: 10 Requests/Minute -> Responses werden gecacht (Default 60s)
 * - Alle Methoden liefern typisierte Objekte, kein `any`
 * - Fehler werden geloggt und als Error weitergereicht, nie still geschluckt
 */

import axios, { AxiosInstance, isAxiosError } from "axios";
import { logger } from "../utils/logger";
import { todayApiDate, tomorrowApiDate } from "../utils/time";

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup
const SEASON = "2026";

// --- Typen (Ausschnitt der football-data v4 Response, nur was wir brauchen) ---

export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED";

export interface Team {
  id: number | null;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

export interface ScoreSide {
  home: number | null;
  away: number | null;
}

export interface Score {
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  duration: string;
  fullTime: ScoreSide;
  halfTime: ScoreSide;
}

export interface Match {
  id: number;
  utcDate: string;
  status: MatchStatus;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
  venue: string | null;
}

export interface StandingRow {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface GroupStanding {
  stage: string;
  type: string;
  group: string | null;
  table: StandingRow[];
}

// --- Raw Response Shapes (nur intern zum Parsen) ---

interface MatchesResponse {
  matches: Match[];
}

interface StandingsResponse {
  standings: GroupStanding[];
}

// --- Simpler In-Memory Cache mit TTL ---

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 60s — respektiert das Rate Limit
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCached<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// --- Axios Client (lazy, damit fehlender Key nicht beim Import crasht) ---

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (client) return client;

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FOOTBALL_DATA_API_KEY fehlt in .env — football-data.org Requests nicht möglich",
    );
  }

  client = axios.create({
    baseURL: BASE_URL,
    headers: { "X-Auth-Token": apiKey },
    timeout: 10_000,
  });
  return client;
}

/**
 * Generischer GET mit Cache. Cache-Key = path.
 */
async function cachedGet<T>(path: string, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const cached = getCached<T>(path);
  if (cached !== undefined) {
    logger.debug(`football-data cache hit: ${path}`);
    return cached;
  }

  try {
    logger.debug(`football-data request: ${path}`);
    const response = await getClient().get<T>(path);
    setCached(path, response.data, ttlMs);
    return response.data;
  } catch (error: unknown) {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        logger.error(
          `football-data Rate Limit erreicht (429) bei ${path} — Free Tier erlaubt 10 Req/min`,
        );
      } else {
        logger.error(
          `football-data Request fehlgeschlagen (${status ?? "?"}) bei ${path}: ${error.message}`,
        );
      }
    } else {
      logger.error(`football-data unerwarteter Fehler bei ${path}`, error);
    }
    throw error;
  }
}

// --- Öffentliche API ---

/** Alle WM-Spiele in einem Datumsbereich (inklusive), YYYY-MM-DD. */
export async function getMatchesBetween(
  dateFrom: string,
  dateTo: string,
): Promise<Match[]> {
  const path = `/competitions/${COMPETITION}/matches?season=${SEASON}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const data = await cachedGet<MatchesResponse>(path);
  return data.matches ?? [];
}

/** Alle WM-Spiele an einem bestimmten Tag (MESZ-Kalendertag), YYYY-MM-DD. */
export async function getMatchesByDate(date: string): Promise<Match[]> {
  return getMatchesBetween(date, date);
}

/** Alle WM-Spiele von heute (MESZ). */
export async function getMatchesToday(): Promise<Match[]> {
  return getMatchesByDate(todayApiDate());
}

/** Alle WM-Spiele von morgen (MESZ). */
export async function getMatchesTomorrow(): Promise<Match[]> {
  return getMatchesByDate(tomorrowApiDate());
}

/** Einzelnes Match per ID. */
export async function getMatchById(id: number): Promise<Match> {
  const path = `/matches/${id}`;
  // football-data liefert das Match direkt als Objekt zurück
  return cachedGet<Match>(path);
}

/**
 * Gruppen-Standings. Ohne Argument: alle Gruppen.
 * Mit `group` (z.B. "E" oder "Group E"): nur die passende Gruppe.
 */
export async function getStandings(
  group?: string,
): Promise<GroupStanding[]> {
  const path = `/competitions/${COMPETITION}/standings?season=${SEASON}`;
  const data = await cachedGet<StandingsResponse>(path);
  const all = data.standings ?? [];
  if (!group) return all;

  const normalized = normalizeGroup(group);
  return all.filter((s) => s.group && normalizeGroup(s.group) === normalized);
}

/** "E", "e", "Group E", "GROUP_E" -> "E" */
function normalizeGroup(group: string): string {
  const match = group.toUpperCase().match(/[A-L]\b|[A-L]$/);
  return match ? match[0] : group.toUpperCase().trim();
}
