/**
 * Wire envelope + port-name format for the page stream pipe.
 *
 * Sibling of `@openheaders/core/request-lifecycle/wire.ts`. The two
 * pipes are deliberately separate: lifecycles fan out per-request shape,
 * pages fan out navigation shape. A host that cares about one but not
 * the other (desktop panel showing only requests, page-only previews,
 * etc.) opens only the relevant port.
 *
 * Envelope kinds parallel `LifecycleWireMessage`: `ready` is the
 * handshake-then-replay marker; `page-update` carries every
 * `PageStreamUpdate` variant.
 */

import type { PageStreamUpdate } from './types';

export type PageWireMessage =
  | { kind: 'ready'; tabId: number }
  | { kind: 'page-update'; update: PageStreamUpdate };

/** Channel-name prefix for the per-tab page pipe. */
export const PAGE_PORT_PREFIX = 'oh-page:';

/** Parse `oh-page:<tabId>`. Returns `null` for any other shape. */
export function parsePagePortName(name: string): number | null {
  if (!name.startsWith(PAGE_PORT_PREFIX)) return null;
  const parsed = Number.parseInt(name.slice(PAGE_PORT_PREFIX.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function pagePortName(tabId: number): string {
  return `${PAGE_PORT_PREFIX}${tabId}`;
}
