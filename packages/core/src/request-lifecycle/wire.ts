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
 *
 * Direction: `LifecycleWireMessage` flows engine→consumer.
 * `LifecycleSubscribeMessage` flows consumer→engine — the consumer opens
 * the port, then sends one `subscribe` to declare which slice of history
 * it wants replayed. `sinceMs` is a `startedAtMs` floor: the engine
 * replays only lifecycles started strictly after it. A consumer that
 * omits `sinceMs` is asking for "session-start" — the engine floors at
 * the current watermark, so nothing pre-existing replays, and reports
 * that watermark back in `ready` so the consumer can re-subscribe with
 * it after a reconnect (and keep its view stable across SW evictions).
 */

import type { RequestLifecycleUpdate } from './types';

export type LifecycleWireMessage =
  | { kind: 'ready'; tabId: number; watermarkMs: number }
  | { kind: 'lifecycle-update'; update: RequestLifecycleUpdate }
  | { kind: 'tab-cleared'; tabId: number };

/**
 * Consumer→engine. Sent once on connect, and again to re-scope the
 * replay (e.g. toggling a "show background history" view). Each
 * `subscribe` re-runs the replay against the floor; the engine clears
 * and re-delivers from `ready` onward.
 *
 * `sinceMs` semantics:
 *   - omitted → session-start: floor at the current watermark (replay
 *     nothing pre-existing).
 *   - a `startedAtMs` value → replay lifecycles started after it.
 *   - `-1` → replay everything currently retained (all `startedAtMs`
 *     are non-negative epoch ms).
 */
export type LifecycleSubscribeMessage = { kind: 'subscribe'; sinceMs?: number };

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
