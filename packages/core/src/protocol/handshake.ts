/**
 * Sync handshake protocol — Yjs-style state-vector exchange.
 *
 * Implements the wire types for `docs/DATA_PLANE_TOPOLOGIES.md` §11.1:
 *
 * ```
 *   1. Client opens WS  →  HELLO        { protocol_version, clientNodeId, ... }
 *   2. Server replies   →  WELCOME      { protocol_version_ok, serverNodeId, ... }
 *   3. Both sides       →  STATE_VECTOR { perNodeMaxHlc: Record<nodeId, HLC> }
 *   4. Each side streams mutations the peer is missing (out of scope for C1;
 *      handled by C4 delta-stream computation + future SNAPSHOT_AT_HLC for
 *      cold-start bootstrap above the C6 threshold).
 *   5. Both sides       →  SYNCED       { stateVectorAfter }
 *   6. Live mode: every new mutation streams real-time.
 * ```
 *
 * All four messages share a `type: 'oh.sync.<step>'` discriminator so a
 * single switch on a deserialized envelope routes them. They live in
 * core/protocol — not core/sync — because the messages are a transport
 * concern (extension SW ↔ desktop main ↔ standalone daemon) and the
 * sync engine itself stays transport-free. Schemas validate at the
 * receive boundary; in-memory paths never re-validate.
 *
 * Version negotiation rules:
 * - `protocolVersion` in HELLO/WELCOME is the wire version (the same
 *   integer as {@link PROTOCOL_VERSION} in `version.ts`).
 * - Adding new handshake message types is additive — peers that don't
 *   speak them simply don't send them, so {@link PROTOCOL_VERSION} does
 *   not bump for the C1 introduction. It will bump when the FIRST
 *   field-shape change lands (e.g. `perNodeMaxHlc` growing a sibling).
 */

import * as v from 'valibot';

import { OrgSchema } from '../schemas/identity';
import { StateVectorSchema, type StateVector } from '../sync/state-vector';
import type { Org } from '../types/identity';

export { StateVectorSchema };
export type { StateVector };

// ── Constants ─────────────────────────────────────────────────────────

export const SYNC_HELLO_TYPE = 'oh.sync.hello' as const;
export const SYNC_WELCOME_TYPE = 'oh.sync.welcome' as const;
export const SYNC_STATE_VECTOR_TYPE = 'oh.sync.stateVector' as const;
export const SYNC_SYNCED_TYPE = 'oh.sync.synced' as const;

/**
 * Reason codes a peer can send in WELCOME when refusing the handshake.
 * Distinct from {@link PROTOCOL_INCOMPATIBLE_CLOSE_CODE} (WS close-code
 * level) — these surface in-band so the UI can render an explanatory
 * pane instead of a generic disconnect.
 */
export const HANDSHAKE_REJECT_REASONS = {
  PROTOCOL_TOO_OLD: 'protocol-too-old',
  PROTOCOL_TOO_NEW: 'protocol-too-new',
  WORKSPACE_UNKNOWN: 'workspace-unknown',
  AUTH_REQUIRED: 'auth-required',
} as const;

export type HandshakeRejectReason = (typeof HANDSHAKE_REJECT_REASONS)[keyof typeof HANDSHAKE_REJECT_REASONS];

// ── Roles ─────────────────────────────────────────────────────────────

/**
 * Role of the peer announcing itself in HELLO/WELCOME. Used by the
 * receiver for telemetry + UI ("connected to: desktop app on this
 * machine" vs. "connected to: daemon at lan.local:8137"). Not a
 * trust signal — Phase C is trust-by-process within a single user
 * boundary; auth lands in Phase D (§11.4).
 */
export const HANDSHAKE_ROLES = {
  EXTENSION: 'extension',
  DESKTOP: 'desktop',
  DAEMON: 'daemon',
  CLI: 'cli',
  /** openheaders.io web bundle (future). Hosted in a real browser tab,
   *  separate from the extension. */
  WEB: 'web',
} as const;

export type HandshakeRole = (typeof HANDSHAKE_ROLES)[keyof typeof HANDSHAKE_ROLES];

const HandshakeRoleSchema = v.picklist([
  HANDSHAKE_ROLES.EXTENSION,
  HANDSHAKE_ROLES.DESKTOP,
  HANDSHAKE_ROLES.DAEMON,
  HANDSHAKE_ROLES.CLI,
  HANDSHAKE_ROLES.WEB,
]);

// ── HELLO ─────────────────────────────────────────────────────────────

/**
 * Client → server greeting. First wire message after the WS upgrade.
 *
 * `nodeId` is the HLC `nodeId` the client will stamp on its own
 * mutations — the peer pins it into its state vector. Distinct from
 * `deviceId` in the origin envelope: a node is a writer identity
 * (extension SW process, desktop main process, daemon instance);
 * device is the physical machine. Same on solo localhost; can diverge
 * on shared LAN daemons.
 *
 * `workspaceId` is the canonical UUIDv7 (§11.3). Peer rejects with
 * `WORKSPACE_UNKNOWN` if it doesn't know that workspace; the
 * mode-switch dialog (§11.2) then decides Coexist / Import / Discard.
 */
export interface SyncHelloMessage {
  type: typeof SYNC_HELLO_TYPE;
  protocolVersion: number;
  role: HandshakeRole;
  nodeId: string;
  workspaceId: string;
  /** Free-form software version (`@openheaders/extension@5.0.0-pre.42`) for diagnostics only. */
  agent: string;
  /**
   * Long-lived daemon access token presented by the peer when the
   * daemon is bound non-loopback (U3.2, `UNIFIED_ORACLE_MODEL.md` §4.2
   * / `DATA_PLANE_TOPOLOGIES.md` §11.4). Omitted on loopback handshakes
   * (trust-by-process); a missing or wrong token on a non-loopback
   * daemon yields a `AUTH_REQUIRED` reject. Secret material — never
   * logged.
   */
  authToken?: string;
}

export const SyncHelloMessageSchema = v.object({
  type: v.literal(SYNC_HELLO_TYPE),
  protocolVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  role: HandshakeRoleSchema,
  nodeId: v.pipe(v.string(), v.minLength(1)),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  agent: v.string(),
  authToken: v.optional(v.pipe(v.string(), v.minLength(1))),
}) satisfies v.GenericSchema<SyncHelloMessage>;

// ── WELCOME ───────────────────────────────────────────────────────────

/**
 * Server → client reply. Either accepts the handshake (the peer will
 * follow with STATE_VECTOR) or rejects with a reason the UI can
 * render in-band before the socket closes.
 *
 * `rejectReason` and accept-path fields are mutually exclusive on the
 * type — the discriminated `accepted` field switches between them.
 */
export type SyncWelcomeMessage = SyncWelcomeAccept | SyncWelcomeReject;

export interface SyncWelcomeAccept {
  type: typeof SYNC_WELCOME_TYPE;
  accepted: true;
  protocolVersion: number;
  role: HandshakeRole;
  nodeId: string;
  workspaceId: string;
  agent: string;
  /**
   * The responding backend's home `Org` (UNIFIED_ORACLE_MODEL.md §6.2).
   * The joining peer folds this into its identity snapshot's authorized
   * Org set (Phase U5.2 — "consume-first join") so the backend's
   * workspaces sync down through the existing `authorizedOrgIds` filter.
   * The joiner's own data is never pushed up — the receiver-side org
   * filter on the backend enforces that structurally (§6.1).
   *
   * Optional: absent when the responder has no identity snapshot yet
   * (pre-bootstrap). The joiner skips the fold in that case.
   */
  org?: Org;
}

export interface SyncWelcomeReject {
  type: typeof SYNC_WELCOME_TYPE;
  accepted: false;
  reason: HandshakeRejectReason;
  /** Peer's protocol version, so the client UI can suggest "update extension" vs "update desktop". */
  protocolVersion: number;
  /** Human-readable detail; never load-bearing for logic. */
  detail?: string;
}

const SyncWelcomeAcceptSchema = v.object({
  type: v.literal(SYNC_WELCOME_TYPE),
  accepted: v.literal(true),
  protocolVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  role: HandshakeRoleSchema,
  nodeId: v.pipe(v.string(), v.minLength(1)),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  agent: v.string(),
  org: v.optional(OrgSchema),
}) satisfies v.GenericSchema<SyncWelcomeAccept>;

const SyncWelcomeRejectSchema = v.object({
  type: v.literal(SYNC_WELCOME_TYPE),
  accepted: v.literal(false),
  reason: v.picklist([
    HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_OLD,
    HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_NEW,
    HANDSHAKE_REJECT_REASONS.WORKSPACE_UNKNOWN,
    HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED,
  ]),
  protocolVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  detail: v.optional(v.string()),
}) satisfies v.GenericSchema<SyncWelcomeReject>;

export const SyncWelcomeMessageSchema = v.variant('accepted', [
  SyncWelcomeAcceptSchema,
  SyncWelcomeRejectSchema,
]) satisfies v.GenericSchema<SyncWelcomeMessage>;

// ── STATE_VECTOR ──────────────────────────────────────────────────────

/**
 * Each side announces what it has seen. Symmetric: both peers send one
 * after the HELLO/WELCOME exchange. The receiver computes its peer's
 * missing set (mutations whose HLC exceeds `perNodeMaxHlc[nodeId]` for
 * the recorded node, plus all nodes the peer's vector is missing
 * entirely) and streams them over.
 *
 * An empty `perNodeMaxHlc` from one side is the cold-oracle signal that
 * triggers snapshot bootstrap on the other side (C5/C6) when its own
 * history is non-trivial.
 */
export interface SyncStateVectorMessage {
  type: typeof SYNC_STATE_VECTOR_TYPE;
  workspaceId: string;
  perNodeMaxHlc: StateVector;
}

export const SyncStateVectorMessageSchema = v.object({
  type: v.literal(SYNC_STATE_VECTOR_TYPE),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  perNodeMaxHlc: StateVectorSchema,
}) satisfies v.GenericSchema<SyncStateVectorMessage>;

// ── SYNCED ────────────────────────────────────────────────────────────

/**
 * Each side declares it has finished sending the deltas the peer was
 * missing. The connection then enters live mode — every freshly
 * committed mutation streams in real-time (C7–C10).
 *
 * `stateVectorAfter` is the sender's vector after flushing — the
 * receiver MAY assert that, post-apply, its own vector now meets or
 * exceeds it. A failed assertion is a bug in the engine, not a
 * recoverable runtime state, and should panic the connection (close
 * with a typed error code) rather than silently desync.
 */
export interface SyncSyncedMessage {
  type: typeof SYNC_SYNCED_TYPE;
  workspaceId: string;
  stateVectorAfter: StateVector;
}

export const SyncSyncedMessageSchema = v.object({
  type: v.literal(SYNC_SYNCED_TYPE),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  stateVectorAfter: StateVectorSchema,
}) satisfies v.GenericSchema<SyncSyncedMessage>;

// ── Union ─────────────────────────────────────────────────────────────

/**
 * Discriminated union over the four handshake messages. Receivers
 * deserialize once, validate against {@link SyncHandshakeMessageSchema},
 * then switch on `type` to route into the local handler. The C7–C10
 * mutation-streaming envelopes are intentionally NOT included here —
 * they're a separate concern routed through `SyncBridgeMessage`.
 */
export type SyncHandshakeMessage =
  | SyncHelloMessage
  | SyncWelcomeMessage
  | SyncStateVectorMessage
  | SyncSyncedMessage;

export const SyncHandshakeMessageSchema = v.variant('type', [
  SyncHelloMessageSchema,
  SyncWelcomeAcceptSchema,
  SyncWelcomeRejectSchema,
  SyncStateVectorMessageSchema,
  SyncSyncedMessageSchema,
]) satisfies v.GenericSchema<SyncHandshakeMessage>;
