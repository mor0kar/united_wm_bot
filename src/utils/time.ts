/**
 * Zeitzonenkonvertierung.
 *
 * Regel (siehe CLAUDE.md / AGENTS.md): Intern wird immer mit UTC gearbeitet,
 * die Ausgabe erfolgt immer in MESZ. Während des WM-Zeitraums (Juni/Juli)
 * gilt in Deutschland durchgehend Sommerzeit = CEST = UTC+2.
 *
 * Wir nutzen die IANA-Zeitzone "Europe/Berlin" über Intl, damit die
 * Sommer-/Winterzeit-Logik korrekt vom System gehandhabt wird.
 */

export const TIMEZONE = "Europe/Berlin";
export const TIMEZONE_LABEL = "MESZ";

/** Wandelt einen ISO-String (z.B. football-data `utcDate`) in ein Date um. */
export function parseUtc(isoDate: string): Date {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Ungültiges Datum: ${isoDate}`);
  }
  return date;
}

/**
 * Formatiert eine Uhrzeit in MESZ, z.B. "21:00".
 */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Formatiert ein Datum in MESZ, z.B. "14.06.2026".
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Formatiert Datum + Uhrzeit in MESZ, z.B. "Sa, 14.06.2026, 21:00 MESZ".
 */
export function formatDateTime(date: Date): string {
  const formatted = new Intl.DateTimeFormat("de-DE", {
    timeZone: TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatted} ${TIMEZONE_LABEL}`;
}

/**
 * Liefert das Datum im Format YYYY-MM-DD bezogen auf die MESZ-Zeitzone.
 * Wird für API-Datumsfilter (dateFrom/dateTo) genutzt, damit "heute" sich
 * auf den deutschen Kalendertag bezieht, nicht auf UTC.
 */
export function toApiDate(date: Date): string {
  // en-CA liefert direkt das ISO-Format YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Stunde (0–23) eines Zeitpunkts in MESZ. */
export function berlinHour(date: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number.parseInt(h, 10);
}

/** Heutiges Datum (MESZ) als YYYY-MM-DD. */
export function todayApiDate(): string {
  return toApiDate(new Date());
}

/** Morgiges Datum (MESZ) als YYYY-MM-DD. */
export function tomorrowApiDate(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return toApiDate(tomorrow);
}
