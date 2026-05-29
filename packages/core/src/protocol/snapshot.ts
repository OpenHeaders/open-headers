/**
 * Snapshot bootstrap — wire types for the `SNAPSHOT_AT_HLC` blob sent
 * during the C5 cold-start path.
 *
 * When a peer's `STATE_VECTOR` is empty (fresh install) AND the local
 * history is non-trivial — `mutationCountSinceLastSnapshot > N` or
 * `estimated replay duration > 500ms` (C6 heuristic) — the sender
 * ships a {@link WorkspaceSnapshot} blob first, then deltas since.
 * This collapses cold-start from "replay 50k mutations" to "load one
 * blob + replay last 24h."
 *
 * The blob is per-workspace post-state: one array per entity-type
 * matching the shapes the per-entity caches already project. The
 * receiver re-seeds its caches from these projections, then applies
 * the delta-stream that follows (C4). The HLC watermark in
 * {@link WorkspaceSnapshot.takenAtHlc} is the state vector the
 * sender held when the blob was captured — the peer's STATE_VECTOR
 * for catch-up purposes after apply.
 *
 * What lives where:
 *
 * - **Per-workspace entities** (17 types) — included in the blob.
 * - **Global-scope `extensionWorkspace`** — NOT included; it's not
 *   per-workspace and ships through its own host-level seeding.
 * - **Sensitive entities** (`vault`, `oauth-bundle`) — per §12.3 are
 *   local-only / non-syncing in v1. The blob fields are present so
 *   the local-loopback path (replay a snapshot from disk on the same
 *   host) is uniform, but cross-host transports MUST strip them
 *   before send. Stripping is the sender's responsibility (it knows
 *   the transport's trust posture); the wire type doesn't enforce
 *   it because a future cross-host-with-shared-secret topology may
 *   permit it under explicit user consent.
 *
 * Schema-version field is the snapshot envelope's own version, not
 * any entity's `schemaVersion`. Bumps on a breaking shape change
 * here (e.g. adding a required field, renaming an array). Peers
 * older than {@link MIN_SNAPSHOT_SCHEMA_VERSION} reject the blob
 * and fall back to delta-stream replay.
 */

import * as v from 'valibot';

import { StateVectorSchema, type StateVector } from '../sync/state-vector';
import type {
  SyncCollectionPostState,
  SyncEnvironmentPostState,
  SyncFilesPostState,
  SyncFolderPostState,
  SyncLayoutStatePostState,
  SyncLiveValuePostState,
  SyncLiveVariablePostState,
  SyncLiveWorkflowPostState,
  SyncOAuthBundlePostState,
  SyncPauseMarkersPostState,
  SyncRequestCollectionPostState,
  SyncRequestFolderPostState,
  SyncRequestPostState,
  SyncRulePostState,
  SyncTemplateCollectionPostState,
  SyncTemplateFolderPostState,
  SyncTemplatePostState,
  SyncVaultPostState,
  SyncWorkspaceVariablesPostState,
} from './sync-bridge';

/** Current snapshot envelope schema version. Bumps on breaking shape changes. */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Oldest envelope schema this code can parse. Receivers reject below this and fall back to delta replay. */
export const MIN_SNAPSHOT_SCHEMA_VERSION = 1;

export interface WorkspaceSnapshot {
  /** Envelope schema version; see {@link SNAPSHOT_SCHEMA_VERSION}. */
  schemaVersion: number;
  workspaceId: string;
  /** Sender's state vector at capture time. Becomes the receiver's starting point. */
  takenAtHlc: StateVector;
  // ── Per-workspace entity post-states ────────────────────────────
  rules: SyncRulePostState[];
  environments: SyncEnvironmentPostState[];
  collections: SyncCollectionPostState[];
  workspaceVariables: SyncWorkspaceVariablesPostState[];
  vault: SyncVaultPostState[];
  folders: SyncFolderPostState[];
  requests: SyncRequestPostState[];
  requestCollections: SyncRequestCollectionPostState[];
  requestFolders: SyncRequestFolderPostState[];
  templates: SyncTemplatePostState[];
  templateCollections: SyncTemplateCollectionPostState[];
  templateFolders: SyncTemplateFolderPostState[];
  liveVariables: SyncLiveVariablePostState[];
  liveWorkflows: SyncLiveWorkflowPostState[];
  /** Resolved live-workflow values (WS-C C6). Sensitive — redacted on
   *  transports crossing a trust zone; converges same-machine. */
  liveValues: SyncLiveValuePostState[];
  oauthBundles: SyncOAuthBundlePostState[];
  pauseMarkers: SyncPauseMarkersPostState[];
  layoutState: SyncLayoutStatePostState[];
  files: SyncFilesPostState[];
}

/**
 * Envelope-level valibot. Per-entity arrays stay as opaque `unknown[]`
 * at the boundary — the per-entity schemas already validate item
 * payloads when the seed mutators run. Doing it twice would be a
 * waste of CPU on a hot cold-start path and would couple this file
 * to every entity schema.
 */
export const WorkspaceSnapshotSchema = v.object({
  schemaVersion: v.pipe(v.number(), v.integer(), v.minValue(MIN_SNAPSHOT_SCHEMA_VERSION)),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  takenAtHlc: StateVectorSchema,
  rules: v.array(v.unknown()),
  environments: v.array(v.unknown()),
  collections: v.array(v.unknown()),
  workspaceVariables: v.array(v.unknown()),
  vault: v.array(v.unknown()),
  folders: v.array(v.unknown()),
  requests: v.array(v.unknown()),
  requestCollections: v.array(v.unknown()),
  requestFolders: v.array(v.unknown()),
  templates: v.array(v.unknown()),
  templateCollections: v.array(v.unknown()),
  templateFolders: v.array(v.unknown()),
  liveVariables: v.array(v.unknown()),
  liveWorkflows: v.array(v.unknown()),
  liveValues: v.array(v.unknown()),
  oauthBundles: v.array(v.unknown()),
  pauseMarkers: v.array(v.unknown()),
  layoutState: v.array(v.unknown()),
  files: v.array(v.unknown()),
});
// NOTE: no `satisfies v.GenericSchema<WorkspaceSnapshot>` — the per-entity
// arrays are intentionally `unknown[]` at the transport boundary
// (item-level validation happens when the seed mutators run), which
// is incompatible with the typed array fields. Callers that need a
// typed value should cast after a successful parse.

export const SYNC_SNAPSHOT_TYPE = 'oh.sync.snapshot' as const;

/**
 * Wire message carrying a snapshot blob. Sender emits one after a
 * STATE_VECTOR exchange when the receiver is cold and the local
 * history exceeds the C6 threshold; receiver applies it before
 * processing the subsequent delta stream.
 */
export interface SyncSnapshotMessage {
  type: typeof SYNC_SNAPSHOT_TYPE;
  workspaceId: string;
  snapshot: WorkspaceSnapshot;
}

export const SyncSnapshotMessageSchema = v.object({
  type: v.literal(SYNC_SNAPSHOT_TYPE),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  snapshot: WorkspaceSnapshotSchema,
});

/**
 * Names of the keys in {@link WorkspaceSnapshot} that carry sensitive
 * entity post-states. Cross-host transports MUST strip these to empty
 * arrays before sending (§12.3 — vault + oauth-bundle are local-only
 * in v1). Listed as a constant so the producer + transport layers
 * don't drift.
 */
export const SENSITIVE_SNAPSHOT_KEYS = ['vault', 'oauthBundles', 'liveValues'] as const satisfies ReadonlyArray<keyof WorkspaceSnapshot>;

export type SensitiveSnapshotKey = (typeof SENSITIVE_SNAPSHOT_KEYS)[number];

/**
 * Return a copy of `snapshot` with every {@link SENSITIVE_SNAPSHOT_KEYS}
 * array replaced by an empty array. Pure; the input is not mutated.
 *
 * Call sites: any transport that crosses a trust-zone boundary
 * (Phase D LAN daemon, Phase D WAN multi-user) before writing to the
 * socket. Within-process loopback and same-user-same-device paths can
 * skip this — the strip is about transport, not storage.
 */
export function redactSensitiveSnapshotKeys(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return { ...snapshot, vault: [], oauthBundles: [], liveValues: [] };
}
