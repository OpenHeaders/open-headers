/**
 * Wire envelope + port-name format for the JS-contexts stream.
 *
 * Sibling of `@openheaders/core/console-stream/wire.ts`. Engine
 * (`@openheaders/oracle`) and consumer (`@openheaders/ui`) agree on this
 * envelope without either importing the other.
 *
 * `'ready'` is the handshake-then-replay marker. `'contexts-update'` carries
 * every {@link JsContextUpdate} variant.
 */

import type { JsContextUpdate } from './types';

export type JsContextsWireMessage =
  | { kind: 'ready'; tabId: number }
  | { kind: 'contexts-update'; update: JsContextUpdate };

/** Channel-name prefix for the per-tab contexts pipe. */
export const JS_CONTEXTS_PORT_PREFIX = 'oh-contexts:';

/** Parse `oh-contexts:<tabId>`. Returns `null` for any other shape — the
 *  `\d+` gate rejects negatives, an empty suffix, and numeric-then-garbage
 *  (`oh-contexts:12abc`) that a bare `parseInt` would silently accept. */
export function parseJsContextsPortName(name: string): number | null {
  if (!name.startsWith(JS_CONTEXTS_PORT_PREFIX)) return null;
  const suffix = name.slice(JS_CONTEXTS_PORT_PREFIX.length);
  if (!/^\d+$/.test(suffix)) return null;
  return Number.parseInt(suffix, 10);
}

export function jsContextsPortName(tabId: number): string {
  return `${JS_CONTEXTS_PORT_PREFIX}${tabId}`;
}
