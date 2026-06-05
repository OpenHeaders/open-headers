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
 * `LifecycleConsumerMessage` flows consumer→engine — the consumer opens
 * the port, then sends one `subscribe` to declare its "watch session" for
 * the tab. The engine resolves the session floor it owns for the tab
 * (establishing it at the current watermark the first time the tab is
 * watched) and replays from there. The engine owning the floor is what
 * keeps a panel's view stable across reconnects, panel remounts, and SW
 * restarts without the consumer having to carry the floor itself;
 * `clear-session` starts a fresh floor.
 *
 * The `ready` envelope also carries the current `sessionToken` — the
 * per-DevTools-session identity the engine resolves for the tab (minted by
 * the devtools_page, advanced on a genuine reopen). Consumers gate
 * session-scoped UI (e.g. the panel's open editor tabs) on it: state stamped
 * with a matching token survives an in-session reconnect/remount; a changed
 * token means a new DevTools session, so that state is dropped. Absent until
 * the engine has seen the session message for the tab.
 */

import type { RequestLifecycleUpdate } from './types';

/**
 * Which correlator currently feeds a tab. `'cdp'` means the tab's rows are
 * the higher-fidelity CDP-sourced view (exact initiator stack, precise
 * blocked reasons, on-the-wire headers); `'heuristic'` is the default
 * `webRequest`+HAR path. Drives the panel's "CDP-enhanced" badge. Mirrors
 * the engine-side `TabOwner` — the literal lives here so the boundary can
 * carry it without the consumer importing the chrome-side router.
 */
export type LifecycleSource = 'heuristic' | 'cdp';

export type LifecycleWireMessage =
  | { kind: 'ready'; tabId: number; watermarkMs: number; sessionToken?: string }
  | { kind: 'lifecycle-update'; update: RequestLifecycleUpdate }
  | { kind: 'tab-cleared'; tabId: number }
  /**
   * Per-tab provenance. Sent once on (re)connect with the current owner,
   * then again whenever ownership flips (CDP attach / fall-back). Carries
   * no request data — it is the badge's provenance signal, derived from the
   * attach state, not sniffed from the rows.
   */
  | { kind: 'source'; tabId: number; source: LifecycleSource };

/**
 * Consumer→engine. Sent once on connect to declare the consumer's watch
 * session for the tab. The engine resolves (and, the first time the tab
 * is watched, establishes at the current watermark) the tab's session
 * floor and replays from there. Reconnects/remounts re-resolve the SAME
 * floor, so an in-flight request observed earlier in the session still
 * replays.
 */
export type LifecycleSubscribeMessage = { kind: 'subscribe' };

/**
 * Consumer→engine. Starts a fresh watch session for the tab — the engine
 * advances the session floor to the current watermark, so subsequent
 * replays drop everything observed before now (the user's "Clear"). The
 * consumer clears its own mirror locally in the same action; this message
 * makes the reset durable so a later reconnect does not resurrect the
 * cleared requests.
 */
export type LifecycleClearSessionMessage = { kind: 'clear-session' };

/** Every consumer→engine message on the lifecycle port. */
export type LifecycleConsumerMessage = LifecycleSubscribeMessage | LifecycleClearSessionMessage;

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
