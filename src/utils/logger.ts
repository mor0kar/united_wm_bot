/**
 * Simples Logging mit Zeitstempel und Log-Level.
 * Fehler werden immer geloggt, nie still geschluckt (siehe AGENTS.md).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Über LOG_LEVEL in .env steuerbar, Default: info
const activeLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[activeLevel];
}

function timestamp(): string {
  return new Date().toISOString();
}

function format(level: LogLevel, message: string): string {
  return `[${timestamp()}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug(message: string, ...meta: unknown[]): void {
    if (shouldLog("debug")) console.debug(format("debug", message), ...meta);
  },
  info(message: string, ...meta: unknown[]): void {
    if (shouldLog("info")) console.info(format("info", message), ...meta);
  },
  warn(message: string, ...meta: unknown[]): void {
    if (shouldLog("warn")) console.warn(format("warn", message), ...meta);
  },
  error(message: string, ...meta: unknown[]): void {
    if (shouldLog("error")) console.error(format("error", message), ...meta);
  },
};
