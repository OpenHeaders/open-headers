/**
 * Awareness bridge protocol — wire shapes for ephemeral, high-frequency
 * presence signals that do NOT ride the sync mutation channel
 * (`docs/SYNC_ENGINE_DESIGN.md` §14).
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
 * Sensitive-entity rule (§14.4): for entities the schema marks
 * sensitive (Vault, OAuth client_secret, …) the `fieldFocus` slot MUST
 * be `null` on the wire. Publishers strip it; the SW oracle is the
 * single GC authority and re-broadcasts canonical presence sets only.
 */
import type { HLC } from '../sync/hlc';

/**
 * Per-surface presence record. The SW oracle keeps one of these per
 * `(workspaceId, surfaceId)` and prunes by `lastActivityHlc` TTL on
 * each publish.
 *
 * `surfaceId` identifies a specific renderer surface (workbench tab,
 * popup, devpanel) and is stable across that surface's lifetime.
 * `deviceId` identifies the physical box; in v1 we have one device per
 * SW, but Phase C will need to disambiguate localhost-WS peers.
 */
export interface AwarenessState {
  surfaceId: string;
  deviceId: string;
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
 * Default TTL — surfaces older than this without a heartbeat are
 * pruned. Tuned to the §14 spec (~30s) and the 10s heartbeat cadence
 * the renderer publisher uses, leaving room for a couple of missed
 * heartbeats over a flaky bridge before a surface drops off.
 */
export const AWARENESS_TTL_MS = 30_000;
