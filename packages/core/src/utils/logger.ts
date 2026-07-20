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
 * the settings store: `data.logLevel` in `rules/settings/schema/data.ts`.
 * The bootstrap helper `wireLoggerToSettings()` (utils/settings-bootstrap)
 * reads that setting at init and subscribes for future changes.
 *
 * Sink: lines delegate to the installed {@link HostLogger} (hosts with
 * a durable sink — the desktop's main.log — capture every module this
 * way), falling back to the console when no host adapter is installed
 * or when this logger IS the installed adapter (the extension installs
 * it directly; the self-check breaks the recursion).
 */

import { getHostLogger } from '../logger/host-logger';

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

function hostSink(): ReturnType<typeof getHostLogger> {
  const host = getHostLogger();
  return host !== null && host !== logger ? host : null;
}

export const logger = {
  error(module: string, ...args: unknown[]): void {
    if (!shouldLog('error')) return;
    const host = hostSink();
    if (host) host.error(module, ...args);
    else console.error(formatPrefix('error', module), ...args);
  },

  warn(module: string, ...args: unknown[]): void {
    if (!shouldLog('warn')) return;
    const host = hostSink();
    if (host) host.warn(module, ...args);
    else console.warn(formatPrefix('warn', module), ...args);
  },

  info(module: string, ...args: unknown[]): void {
    if (!shouldLog('info')) return;
    const host = hostSink();
    if (host) host.info(module, ...args);
    else console.log(formatPrefix('info', module), ...args);
  },

  debug(module: string, ...args: unknown[]): void {
    if (!shouldLog('debug')) return;
    const host = hostSink();
    if (host) host.debug(module, ...args);
    else console.log(formatPrefix('debug', module), ...args);
  },

  getLevel(): LogLevel {
    return currentLevel;
  },

  setLevel(level: LogLevel): void {
    currentLevel = level;
  },
};
