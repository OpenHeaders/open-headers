/**
 * Daemon logger — the service-operation sink behind the host-logger
 * seam. Same visual contract as the console logger
 * (`<ISO timestamp> LEVEL [scope] message`) with one hard guarantee on
 * top: **one event, one line**. Service logs are consumed by grep,
 * journalctl, and log scanners (Phase 3's fail2ban posture), so every
 * argument — errors included — is flattened into the line and embedded
 * newlines are escaped. Level filtering is fixed at construction from
 * the resolved daemon config.
 */

import type { HostLogger } from '@openheaders/core/logger';
import type { LogLevel } from '@openheaders/core/utils';

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

function renderArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/** Flatten one log event into a single physical line. */
export function formatLogLine(level: LogLevel, scope: string, args: readonly unknown[]): string {
  const message = args.map(renderArg).join(' ').replace(/\r?\n/g, '\\n');
  return `${new Date().toISOString()} ${LEVEL_LABELS[level]} [${scope}] ${message}`;
}

export interface DaemonLoggerOptions {
  level: LogLevel;
  /** Line sinks — default stdout for info/debug, stderr for error/warn. */
  writeOut?: (line: string) => void;
  writeErr?: (line: string) => void;
}

export function createDaemonLogger(options: DaemonLoggerOptions): HostLogger {
  const threshold = LOG_LEVELS[options.level];
  const writeOut = options.writeOut ?? ((line: string) => process.stdout.write(`${line}\n`));
  const writeErr = options.writeErr ?? ((line: string) => process.stderr.write(`${line}\n`));
  const emit = (level: LogLevel, scope: string, args: readonly unknown[]): void => {
    if (LOG_LEVELS[level] > threshold) return;
    const line = formatLogLine(level, scope, args);
    if (level === 'error' || level === 'warn') writeErr(line);
    else writeOut(line);
  };
  return {
    error: (scope, ...args) => emit('error', scope, args),
    warn: (scope, ...args) => emit('warn', scope, args),
    info: (scope, ...args) => emit('info', scope, args),
    debug: (scope, ...args) => emit('debug', scope, args),
  };
}
