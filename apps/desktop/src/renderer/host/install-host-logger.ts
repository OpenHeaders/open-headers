/**
 * Boot-time wiring: route renderer logs through `electron-log/renderer`
 * so every line lands in `<userData>/logs/main.log` alongside the
 * main-process stream. The same prefix format as `MainLogger`
 * (`ISO LEVEL [scope] message`) is built here, so the file has one
 * coherent interleaved log regardless of origin.
 *
 * Level filtering reuses the core `logger` from `@openheaders/core/utils`
 * — settings-bootstrap wires it to `data.logLevel`, so toggling that
 * setting silences both renderer and main consistently. `error` always
 * emits (losing failure context is never useful), matching `MainLogger`.
 *
 * Devtools still sees every line via electron-log's renderer console
 * transport, so local debugging is unchanged.
 */

import { setHostLogger, type HostLogger } from '@openheaders/core/logger';
import { logger as coreLogger, type LogLevel } from '@openheaders/core/utils';
import log from 'electron-log/renderer';

const LEVEL_LABELS: Record<LogLevel, string> = {
  error: 'ERROR',
  warn: 'WARN ',
  info: 'INFO ',
  debug: 'DEBUG',
};

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// `{text}` ⇒ the joined `data` array is the line. We pass our own prefix
// as the first datum so the format matches `MainLogger` byte-for-byte.
log.transports.console.format = '{text}';
log.transports.console.level = 'debug';
log.transports.ipc.level = 'debug';

function formatPrefix(level: LogLevel, scope: string): string {
  return `${new Date().toISOString()} ${LEVEL_LABELS[level]} [${scope}]`;
}

function emit(level: LogLevel, scope: string, args: unknown[]): void {
  if (level !== 'error' && LEVEL_RANK[level] > LEVEL_RANK[coreLogger.getLevel()]) return;
  log[level](formatPrefix(level, scope), ...args);
}

const rendererHostLogger: HostLogger = {
  error: (scope, ...args) => emit('error', scope, args),
  warn: (scope, ...args) => emit('warn', scope, args),
  info: (scope, ...args) => emit('info', scope, args),
  debug: (scope, ...args) => emit('debug', scope, args),
};

setHostLogger(rendererHostLogger);
