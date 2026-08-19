/**
 * Awareness bridge protocol — wire shapes for ephemeral, high-frequency
 * presence signals that do NOT ride the sync mutation channel
 * (the sync-engine design §14).
 *
 * Awareness is non-persistent and never participates in mutator
 * convergence. It carries surface focus + dirty-fields + heartbeats so
 * UI affordances (badges, field chips, live-update animations) can show
 * who is doing what right now, without entangling the data plane.
 *
 * Channel separation matters: piggybacking awareness on `syncBroadcast`
 * would couple ephemeral fan-out (every keystroke updates focus) to the
 * persisted mutation log lifecycle. Keep them on different broadcast
 * names so each can evolve, throttle, and GC independently.
 *
 * Identity model — the wire carries a {@link PresenceIdentity} envelope
 * rather than a flat `surfaceId` string. Every layer is optional except
 * `instanceId` + `surfaceKind`; richer layers (`userId`, `browserContext`,
 * navigation handles) light up incrementally as deployment topology
 * grows from Mode 1 (single browser) to Mode 2 (multi-device daemon) to
 * Mode 3 (team cloud) — the oracle architecture notes.
 *
 * Sensitive-entity rule (§14.4): for entities the schema marks
 * sensitive (Vault, OAuth client_secret, …) the `fieldFocus` slot MUST
 * be `null` on the wire. Publishers strip it; the SW oracle is the
 * single GC authority and re-broadcasts canonical presence sets only.
 */
import type { HLC } from '../sync/hlc';

/** Surface taxonomy. New surfaces must register here so renderers can
 *  type-narrow on `surfaceKind` instead of pattern-matching free strings. */
export type SurfaceKind = 'workbench' | 'popup' | 'devpanel' | 'sidepanel';

/** Application carrying the surface. `extension` today; `desktop` and
 *  `cli` arrive with multi-device topologies. */
/**
 * App kind a surface is mounted in. Drives presence grouping +
 * appropriate "this surface" decoration in the awareness popover.
 *
 *   - `extension` — browser extension contexts (popup, sidepanel,
 *     devpanel, full-page workbench tab). Carries `browserContext`.
 *   - `desktop`   — Electron main window. No `browserContext`.
 *   - `web`       — the openheaders.com web bundle, when shipped.
 *     Hosted in a real browser, so carries `browserContext`, but
 *     bucketed separately from extension surfaces in the same
 *     browser so the popover can disambiguate.
 *   - `cli`       — reserved for the CLI sync peer; CLI has no
 *     surface today, so it never appears as a presence row.
 */
export type AppKind = 'extension' | 'desktop' | 'cli' | 'web';

/** Browser identifier — populated only when the surface lives inside a
 *  browser (`appId === 'extension'`). `profile` is best-effort: Chrome's
 *  extension API doesn't expose the active profile name without `identity`
 *  permissions, so callers may leave it undefined. */
export interface BrowserContext {
  browser: 'chrome' | 'firefox' | 'edge' | 'safari' | 'other';
  profile?: string;
}

/**
 * Navigation handle — describes how a peer surface can be focused from
 * another surface ("click to switch to that tab"). Tagged by `kind` so
 * the receiving renderer dispatches to the right `chrome.*` API.
 *
 * Surfaces that aren't peer-addressable (popups dismiss on focus loss;
 * a popup pointer would be a lie) omit `navigation` entirely on their
 * identity record — the consuming UI renders a non-clickable row.
 */
export type NavigationHandle =
  | { kind: 'chrome-tab'; tabId: number; windowId: number; url?: string; route?: string }
  | { kind: 'devtools-inspected-tab'; inspectedTabId: number; inspectedUrl?: string }
  | { kind: 'side-panel'; windowId: number; tabId?: number }
  | { kind: 'desktop-window'; windowId: string };

/**
 * Identity envelope for one connected presence. Replaces the flat
 * `surfaceId`/`deviceId` pair so multiple instances of the same surface
 * kind (two workbench tabs, two open DevTools panels) coexist as
 * distinct rows instead of clobbering each other in the SW store.
 *
 * `instanceId` is THE primary key. Stable for the lifetime of the
 * surface mount, regenerated when the surface remounts. This is what
 * the SW awareness store keys on; surface-level disambiguation falls
 * out of it for free.
 */
export interface PresenceIdentity {
  /** Stable per-mount id. Acts as the SW awareness store key. */
  instanceId: string;
  /** What kind of surface is this. Drives badge color + grouping. */
  surfaceKind: SurfaceKind;
  /** Application carrying the surface. */
  appId: AppKind;
  /** Physical device. One per box; populated for Mode 2/3 transports. */
  deviceId?: string;
  /** Authenticated user. Populated only for Mode 3 cloud topology. */
  userId?: string;
  /** Browser context — present iff `appId === 'extension'`. */
  browserContext?: BrowserContext;
  /** Raw descriptive context — the data half of the surface's display
   *  label: the tab title for own-tab surfaces (what the user sees on
   *  the browser tab strip), the inspected page's title or hostname
   *  for DevTools panels. Locale-neutral wire data; viewers compose
   *  the display label from their own translation of `surfaceKind`
   *  plus this context, so peers render in the viewer's locale.
   *  Absent when the surface has no richer context than its kind. */
  labelContext?: string;
  /** Peer-addressable handle for click-to-switch. Optional: surfaces
   *  that can't be focused programmatically (popup) omit this. */
  navigation?: NavigationHandle;
}

/**
 * Per-surface presence record. The SW oracle keeps one per
 * `(workspaceId, identity.instanceId)` and prunes by `lastActivityHlc`
 * TTL on each publish.
 */
export interface AwarenessState {
  identity: PresenceIdentity;
  /**
   * `(type, id)` of the entity currently in focus on this surface. For
   * sensitive entities the publisher emits `entityFocus` only — see
   * `fieldFocus` rule below.
   */
  entityFocus: { type: string; id: string } | null;
  /**
   * `(type, id, path)` of the field currently in focus. Always `null`
   * for sensitive entities (§14.4).
   */
  fieldFocus: { type: string; id: string; path: string } | null;
  /** Field paths the user has uncommitted edits for. */
  dirtyFields: string[];
  /** HLC of the last activity that produced this state. Drives GC. */
  lastActivityHlc: HLC;
}

/** Surface → oracle: publish or refresh this surface's presence. */
export interface AwarenessPublishRequest {
  type: 'oh.awareness.publish';
  workspaceId: string;
  state: AwarenessState;
}

export interface AwarenessPublishResponse {
  ok: true;
  /** Canonical presence after the publish landed (post-GC). */
  presence: AwarenessState[];
}

/** Oracle → surfaces: canonical presence after every change / GC tick. */
export interface AwarenessBroadcastEvent {
  type: 'oh.awareness.broadcast';
  workspaceId: string;
  presence: AwarenessState[];
}

export const AWARENESS_PUBLISH_TYPE = 'oh.awareness.publish' as const;
export const AWARENESS_BROADCAST_TYPE = 'oh.awareness.broadcast' as const;

/**
 * Defensive TTL — backstop for cases where a lifeline port's
 * `onDisconnect` is missed (extremely rare; can happen across SW
 * eviction edges or browser bugs). Liveness is determined primarily
 * by the connection-bound lifeline port (see `awareness-lifeline.ts`
 * on both renderer and SW sides), so this TTL is set generously to
 * five minutes — long enough that a normally-functioning surface
 * never trips it, short enough that a leaked entry self-heals.
 */
export const AWARENESS_TTL_MS = 5 * 60_000;
