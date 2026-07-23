/**
 * Main-process structured logger backed by `electron-log`.
 *
 * Output format: `YYYY-MM-DDTHH:MM:SS.mmmZ LEVEL [Component] message`
 *
 * In packaged builds the process has no stdout a user can see, so
 * `console.*` calls effectively disappear. Every line here lands in
 * electron-log's file transport at `<userData>/logs/main.log` — the
 * log root follows the userData root, so the env override and the
 * `-Dev` suffix isolate dev / e2e / installed logs from each other.
 * One exception: packaged macOS keeps the platform-conventional
 * `~/Library/Logs/OpenHeaders/main.log` (the path users are asked to
 * pull for bug reports). 5 MB rolling cap; `getLogDirectory()` reports
 * the live path.
 *
 * Capabilities beyond `electron-log/main`'s built-in `.scope()`:
 *   - `setGlobalLogLevel('debug' | 'info' | 'warn' | 'error')` — runtime
 *     toggle for verbose troubleshooting; wired to settings later.
 *   - `getLogDirectory()` — path to the log dir for a "Show Logs"
 *     affordance in settings or the tray menu.
 *   - `formatData(err | object | primitive)` — Error → `name: message`,
 *     objects → JSON, primitives → String. No more `[object Object]`.
 */

import path from 'node:path';
import type { HostLogger } from '@openheaders/core/logger';
import { app } from 'electron';
import log from 'electron-log/main';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Directory name for the packaged-macOS log fork. Matches the
 * space-free `productName`, NOT the 'Open Headers' display name —
 * electron-log would otherwise derive `~/Library/Logs/Open Headers/`
 * from `app.setName`.
 */
const LOG_DIR_APP_NAME = 'OpenHeaders';

/**
 * Log root: `<userData>/logs`, so dev, e2e, and installed builds never
 * interleave one main.log. Packaged macOS is the one fork — it keeps
 * `~/Library/Logs/OpenHeaders`, the conventional location users pull
 * from for bug reports. Must run after main.ts's userData override.
 */
function logsRootDir(): string {
  return app.isPackaged && process.platform === 'darwin'
    ? path.join(app.getPath('home'), 'Library', 'Logs', LOG_DIR_APP_NAME)
    : path.join(app.getPath('userData'), 'logs');
}

type LogLevelName = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevelName, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LEVEL_LABELS: Record<LogLevelName, string> = {
  error: 'ERROR',
  warn: 'WARN ',
  info: 'INFO ',
  debug: 'DEBUG',
};

function isLogLevelName(level: string): level is LogLevelName {
  return level in LOG_LEVELS;
}

// Defaults to `info` until `setGlobalLogLevel` overrides (settings-driven).
let currentLevel: number = LOG_LEVELS.info;

export function installMainLogger(): void {
  // We build the full prefix ourselves so the file and console formats
  // are identical and immune to electron-log template drift.
  log.transports.console.format = '{text}';
  log.transports.file.format = '{text}';
  log.transports.file.resolvePathFn = (variables) => path.join(logsRootDir(), variables.fileName ?? 'main.log');
  log.transports.file.maxSize = MAX_FILE_SIZE;
  log.transports.file.level = 'info';
  log.transports.console.level = 'info';

  // Register the IPC handler that receives messages from `electron-log/renderer`
  // (wired via `electron-log/preload`). Renderer lines flow through the same
  // file + console transports as main, so `<userData>/logs/main.log` ends up
  // with a single interleaved stream.
  log.initialize();
}

export function setGlobalLogLevel(level: string): void {
  if (!isLogLevelName(level)) return;
  currentLevel = LOG_LEVELS[level];
  log.transports.file.level = level;
  log.transports.console.level = level;
}

export function getLogDirectory(): string {
  return path.dirname(log.transports.file.getFile().path);
}

function formatData(data: unknown): string {
  if (data === null || data === undefined) return String(data);
  if (data instanceof Error) return data.stack ?? `${data.name}: ${data.message}`;
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }
  return String(data);
}

function formatPrefix(level: LogLevelName, component: string): string {
  return `${new Date().toISOString()} ${LEVEL_LABELS[level]} [${component}]`;
}

export class MainLogger {
  constructor(private readonly component: string) {}

  debug(message: string, data?: unknown): void {
    if (LOG_LEVELS.debug > currentLevel) return;
    const prefix = formatPrefix('debug', this.component);
    if (data !== undefined) log.debug(prefix, message, formatData(data));
    else log.debug(prefix, message);
  }

  info(message: string, data?: unknown): void {
    if (LOG_LEVELS.info > currentLevel) return;
    const prefix = formatPrefix('info', this.component);
    if (data !== undefined) log.info(prefix, message, formatData(data));
    else log.info(prefix, message);
  }

  warn(message: string, data?: unknown): void {
    if (LOG_LEVELS.warn > currentLevel) return;
    const prefix = formatPrefix('warn', this.component);
    if (data !== undefined) log.warn(prefix, message, formatData(data));
    else log.warn(prefix, message);
  }

  error(message: string, data?: unknown): void {
    // `error` always logs regardless of level — losing failure context
    // is never useful.
    const prefix = formatPrefix('error', this.component);
    if (data !== undefined) log.error(prefix, message, formatData(data));
    else log.error(prefix, message);
  }
}

export function createLogger(component: string): MainLogger {
  return new MainLogger(component);
}

// One MainLogger per engine scope so every line keeps its `[scope]`
// prefix in the shared main.log stream.
const engineScopeLoggers = new Map<string, MainLogger>();

function scopedLogger(scope: string): MainLogger {
  let scoped = engineScopeLoggers.get(scope);
  if (!scoped) {
    scoped = new MainLogger(scope);
    engineScopeLoggers.set(scope, scoped);
  }
  return scoped;
}

/**
 * `HostLogger` implementation for the engine (`setHostLogger`), backed
 * by the same electron-log transports as the rest of the main process.
 * The engine's rows — spine boot, sync, workspace-tree git audit —
 * land in main.log alongside everything else instead of dying on the
 * invisible stdout of a packaged app.
 */
export function createEngineHostLogger(): HostLogger {
  const emit =
    (level: 'error' | 'warn' | 'info' | 'debug') =>
    (scope: string, ...args: unknown[]): void => {
      const [first, ...rest] = args;
      const message = typeof first === 'string' ? first : formatData(first);
      if (rest.length === 0) scopedLogger(scope)[level](message);
      else if (rest.length === 1) scopedLogger(scope)[level](message, rest[0]);
      else scopedLogger(scope)[level](message, rest);
    };
  return { error: emit('error'), warn: emit('warn'), info: emit('info'), debug: emit('debug') };
}
