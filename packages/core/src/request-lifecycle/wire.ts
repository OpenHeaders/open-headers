/**
 * Wire-facing primitives for the request-lifecycle hub.
 *
 * The hub (engine-side, in `@openheaders/oracle`) and its consumers
 * (panel / popup / future surfaces in `@openheaders/ui`) sit on opposite
 * sides of the public/private boundary. The envelope shape + the port
 * name format both ends agree on lives here in `core` so neither side
 * has to import the other's package — the shared wire contract is the
 * only thing the boundary lets through.
 *
 * `LifecycleWireMessage` is two top-level kinds, NOT a 7th
 * `RequestLifecycleUpdate` variant: the lifecycle union is the
 * engine→store contract and stays semantically pure. Wire-only concerns
 * (ready handshake) extend the envelope, never the lifecycle.
 */

import type { RequestLifecycleUpdate } from './types';

export type LifecycleWireMessage =
  | { kind: 'ready'; tabId: number }
  | { kind: 'lifecycle-update'; update: RequestLifecycleUpdate };

/** Channel-name prefix for the per-tab lifecycle pipe. */
export const LIFECYCLE_PORT_PREFIX = 'oh-lifecycle:';

/** Parse `oh-lifecycle:<tabId>`. Returns `null` for any other shape. */
export function parseLifecyclePortName(name: string): number | null {
  if (!name.startsWith(LIFECYCLE_PORT_PREFIX)) return null;
  const suffix = name.slice(LIFECYCLE_PORT_PREFIX.length);
  if (!/^-?\d+$/.test(suffix)) return null;
  const parsed = Number.parseInt(suffix, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function lifecyclePortName(tabId: number): string {
  return `${LIFECYCLE_PORT_PREFIX}${tabId}`;
}
