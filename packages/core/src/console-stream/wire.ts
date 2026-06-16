/**
 * Wire envelope + port-name format for the console stream.
 *
 * Sibling of `@openheaders/core/rule-fire-stream/wire.ts` and
 * `@openheaders/core/page-stream/wire.ts`. Engine (`@openheaders/oracle`)
 * and consumer (`@openheaders/ui`) agree on this envelope without either
 * importing the other.
 *
 * `'ready'` is the handshake-then-replay marker. `'console-update'` carries
 * every {@link ConsoleStreamUpdate} variant.
 */

import type { ConsoleStreamUpdate } from './types';

export type ConsoleStreamWireMessage =
  | { kind: 'ready'; tabId: number }
  | { kind: 'console-update'; update: ConsoleStreamUpdate };

/** Channel-name prefix for the per-tab console pipe. */
export const CONSOLE_STREAM_PORT_PREFIX = 'oh-console:';

/** Parse `oh-console:<tabId>`. Returns `null` for any other shape — the
 *  `\d+` gate rejects negatives, an empty suffix, and numeric-then-garbage
 *  (`oh-console:12abc`) that a bare `parseInt` would silently accept. */
export function parseConsoleStreamPortName(name: string): number | null {
  if (!name.startsWith(CONSOLE_STREAM_PORT_PREFIX)) return null;
  const suffix = name.slice(CONSOLE_STREAM_PORT_PREFIX.length);
  if (!/^\d+$/.test(suffix)) return null;
  return Number.parseInt(suffix, 10);
}

export function consoleStreamPortName(tabId: number): string {
  return `${CONSOLE_STREAM_PORT_PREFIX}${tabId}`;
}
