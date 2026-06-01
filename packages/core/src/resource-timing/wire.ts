/**
 * Wire envelope + port-name format for the resource-timing pipe.
 *
 * Sibling of `@openheaders/core/page-stream/wire.ts`. The feed rides its
 * own `oh-rt:<tabId>` pipe so a host that wants only requests or only
 * pages never inherits resource-timing shape, and vice versa.
 *
 * Envelope kinds parallel `PageWireMessage`: `ready` is the
 * handshake-then-replay marker; `rt-update` carries every
 * `ResourceTimingUpdate` variant.
 */

import type { ResourceTimingUpdate } from './types';

export type ResourceTimingWireMessage =
  | { kind: 'ready'; tabId: number }
  | { kind: 'rt-update'; update: ResourceTimingUpdate };

/** Channel-name prefix for the per-tab resource-timing pipe. */
export const RESOURCE_TIMING_PORT_PREFIX = 'oh-rt:';

/** Parse `oh-rt:<tabId>`. Returns `null` for any other shape. */
export function parseResourceTimingPortName(name: string): number | null {
  if (!name.startsWith(RESOURCE_TIMING_PORT_PREFIX)) return null;
  const parsed = Number.parseInt(name.slice(RESOURCE_TIMING_PORT_PREFIX.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function resourceTimingPortName(tabId: number): string {
  return `${RESOURCE_TIMING_PORT_PREFIX}${tabId}`;
}
