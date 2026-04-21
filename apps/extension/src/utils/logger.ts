/**
 * Centralized logger with configurable log levels.
 *
 * Output format: 2026-03-23T13:35:17.674Z INFO  [Module] message
 *
 * Log levels (each includes all levels above it):
 * - error: Operation failures and exceptions
 * - warn:  Anomalies, retries, and fallbacks
 * - info:  Operational events and state changes
 * - debug: Detailed internals for troubleshooting (reconnect attempts, skip messages, etc.)
 *
 * The current level is held in-memory only. Persistence is owned by
 * the settings store: `data.logLevel` in `workbench/settings/schema/data.ts`.
 * The bootstrap helper `wireLoggerToSettings()` (utils/settings-bootstrap)
 * reads that setting at init and subscribes for future changes.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  error: 'ERROR',
  warn: 'WARN ',
  info: 'INFO ',
  debug: 'DEBUG',
};

let currentLevel: LogLevel = 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
}

function formatPrefix(level: LogLevel, module: string): string {
  return `${new Date().toISOString()} ${LEVEL_LABELS[level]} [${module}]`;
}

export function isValidLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && value in LOG_LEVELS;
}

export const logger = {
  error(module: string, ...args: unknown[]): void {
    if (shouldLog('error')) console.error(formatPrefix('error', module), ...args);
  },

  warn(module: string, ...args: unknown[]): void {
    if (shouldLog('warn')) console.warn(formatPrefix('warn', module), ...args);
  },

  info(module: string, ...args: unknown[]): void {
    if (shouldLog('info')) console.log(formatPrefix('info', module), ...args);
  },

  debug(module: string, ...args: unknown[]): void {
    if (shouldLog('debug')) console.log(formatPrefix('debug', module), ...args);
  },

  getLevel(): LogLevel {
    return currentLevel;
  },

  setLevel(level: LogLevel): void {
    currentLevel = level;
  },
};
