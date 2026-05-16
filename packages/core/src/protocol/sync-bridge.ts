/**
 * Sync bridge protocol — wire shapes for `apply(MutationBatch)` requests
 * the oracle accepts, ack responses it returns, and broadcast events it
 * emits to subscribed surfaces (Phase A R4).
 *
 * These types live in core so every node — extension surfaces, the SW
 * oracle, the desktop's main process, and the CLI — speaks the same
 * shape. Registering them with the platform-specific RPC layer
 * (chrome.runtime, the desktop bridge, …) happens in each app: the
 * shared contract is here.
 */

import type { FieldOrigin, MutationBatch, MutationEnvelope, MutatorOutcome, SideEffectIntent } from '../sync';
import type { Collection, Environment, ExtensionWorkspace, FileRef, Folder, LiveVariable, LiveWorkflow, OAuth2Auth, Request, Rule, Template, Vault, WorkspaceVariables } from '../types';
/** Surface → oracle: apply this batch all-or-nothing under the per-entity lock. */
export interface SyncApplyRequest {
  type: 'oh.sync.apply';
  batch: MutationBatch;
  /**
   * Side-effect intents emitted by the rule mutator factories. The
   * oracle enqueues them only on a successful commit; rolled-back
   * batches drop them along with the state delta.
   */
  sideEffects: SideEffectIntent[];
  /**
   * Per-write provenance tag stamped on every {@link EntityState.fieldValues}
   * entry the batch writes. Defaults to `'local'` so user-gesture
   * dispatch paths can omit it; the inbound mutation bridge and
   * hydration / snapshot replay paths pass `'inbound'` so a peer-driven
   * write doesn't masquerade as a fresh local edit (F2.h supersede-
   * local-edit signal).
   */
  applyOrigin?: FieldOrigin;
}

export interface SyncApplyAckOk {
  ok: true;
  /** Per-envelope outcomes in the same order as `request.batch.mutations`. */
  outcomes: Array<{ envelope: MutationEnvelope; outcome: MutatorOutcome }>;
}

export interface SyncApplyAckErr {
  ok: false;
  outcomes: Array<{ envelope: MutationEnvelope; outcome: MutatorOutcome }>;
  failure: { mutationId: string; status: MutatorOutcome['status']; detail?: string };
}

export type SyncApplyResponse = SyncApplyAckOk | SyncApplyAckErr;

/**
 * Post-commit projection for a Rule envelope. Carries the materialized
 * Rule and the live itemIds the oracle holds at each set-modeled
 * path, so renderer-side mirrors can:
 *
 *   1. Track the canonical rule shape without round-tripping back to
 *      the SW (synchronous-render discipline, §19.4).
 *   2. Enumerate the itemIds `removeFromSet` envelopes need to target —
 *      the materialized shape strips them, so a write helper that wants
 *      to replace a set has to learn them from somewhere.
 *
 * Optional + entity-typed: only Rule envelopes carry it for now. When
 * Phase B widens the sync engine to additional entities, this either
 * grows per-entity payload variants or wraps in a discriminated union.
 * Defer that decision until a second entity actually needs it.
 */
export interface SyncRulePostState {
  rule: Rule;
  /** Map keyed by set path (e.g. `conditions`, `action.requestHeaders`). */
  setItemIds: Record<string, string[]>;
  /**
   * Live `(itemId, orderKey)` pairs at each set-modeled path, in
   * canonical sort order. Renderer write helpers feed these into
   * `synthesizeSetDiff` so save-time gestures (reorder, content edit,
   * row add/remove) emit the minimum envelope set — `moveBefore` for
   * pure reorders, `addToSet` (LWW supersede) for content edits, with
   * no redundant `removeFromSet` (§7.2). Parallel to
   * {@link SyncRequestPostState.setOrderKeys}.
   */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/**
 * Post-commit projection for an Environment envelope. Carries the
 * materialized {@link Environment} plus the live variable uids
 * (set member identity = uid, see env mutators). Renderer-side
 * mirrors fold this in lockstep with the SW oracle so they can read
 * post-commit state without a round-trip.
 */
export interface SyncEnvironmentPostState {
  environment: Environment;
  /** Live variable uids — the set-member identity (uid) for env vars. */
  varUids: string[];
}

/**
 * Post-commit projection for a Collection envelope. Carries the
 * materialized {@link Collection} plus the live variable uids
 * (set member identity = uid, same as env vars). Renderer-side
 * mirrors fold this so collection-vars editing surfaces can read
 * post-commit state without a round-trip.
 */
export interface SyncCollectionPostState {
  collection: Collection;
  /** Live variable uids — the set-member identity (uid) for collection vars. */
  varUids: string[];
  /**
   * Live `(itemId, orderKey)` pairs at the parent-owned `folders` set
   * (§23.5). Renderer-side mirrors fold this into a per-collection
   * ordered child-folder list; the sidebar tree consumes it to render
   * folder siblings in fractional-indexing order, and the dnd surface
   * uses it to compute `keyBetween(prev, next)` at drop time.
   */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/**
 * Post-commit projection for a workspace-variables envelope. Singleton
 * entity per workspace — there is exactly one materialized record at
 * the fixed id `workspace-vars`. Carries the materialized
 * {@link WorkspaceVariables} plus the live variable uids (set
 * member identity = name, same as env + collection vars). Renderer
 * mirrors fold this so the workspace-vars editing surface reads
 * post-commit state without a round-trip.
 */
export interface SyncWorkspaceVariablesPostState {
  workspaceVariables: WorkspaceVariables;
  /** Live variable uids — the set-member identity (uid) for workspace vars. */
  varUids: string[];
}

/**
 * Post-commit projection for a vault envelope. Singleton entity per
 * workspace — there is exactly one materialized record at the fixed
 * id `vault`. Carries the materialized {@link Vault} plus the live
 * secret names (set member identity = uid, same shape as the other
 * variable scopes). Renderer mirrors fold this so the vault editing
 * surface reads post-commit state without a round-trip.
 *
 * The vault is §12.1 schema-marked sensitive in full — the broadcast
 * is local-only and never leaves the device (Vault is non-syncing in
 * v1, §12.3). Awareness publishes for entities of this type carry no
 * `fieldFocus` (§14.4); the post-state itself is data the local
 * editor needs.
 */
export interface SyncVaultPostState {
  vault: Vault;
  /** Live secret uids — the set-member identity (uid) for vault entries. */
  secretUids: string[];
}

/**
 * Post-commit projection for a Request envelope. Parallel to
 * {@link SyncRulePostState} — carries the materialized
 * {@link Request} and the live itemIds the oracle holds at each
 * set-modeled path (`headers`, `params`). Renderer-side write helpers
 * fold this into their local mirror so partial-update emit paths can
 * enumerate `removeFromSet` itemIds without round-tripping back to the
 * SW (§19.4 synchronous-render discipline).
 */
export interface SyncRequestPostState {
  request: Request;
  /** Map keyed by set path (`headers`, `params`). */
  setItemIds: Record<string, string[]>;
  /**
   * Live `(itemId, orderKey)` pairs at each set-modeled path, in
   * canonical sort order. Renderer write helpers use these to detect
   * pure-reorder gestures and emit `moveBefore` envelopes via
   * `keyBetween(prev, next)` instead of a wholesale
   * `removeFromSet + addToSet` rewrite — preserves itemIds and shrinks
   * the diff to the moved row(s) only (§7.2 LWW per itemId, §7.3
   * fractional indexing).
   */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/**
 * Post-commit projection for a Folder envelope. Carries the
 * materialized {@link Folder} with its full path reconstructed from
 * the parent walk (collection root → folder chain). Folders are
 * non-singleton entities keyed by uid; renderer-side mirrors fold this
 * per uid so sidebar tree consumers see post-commit shape without a
 * round-trip.
 *
 * Sibling order does not live on the folder itself (§23.5). The
 * parent's `folders` set carries the ordered slots — when the
 * drag-reorder gesture lands, the parent's post-state will be the
 * source for `keyBetween` lookups.
 */
export interface SyncFolderPostState {
  folder: Folder;
  /**
   * Live `(itemId, orderKey)` pairs at the folder's own `folders` set
   * (§23.5) — the slot list for child folders nested under this folder.
   * Same shape as {@link SyncCollectionPostState.setOrderKeys}; folder
   * dnd reads this to compute `keyBetween` for nested-folder drops.
   */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/**
 * Post-commit projection for a request-collection envelope. Mirrors
 * {@link SyncCollectionPostState}: carries the materialized
 * {@link Collection} plus live variable uids (set member identity =
 * name, same as env + rule-collection vars) and the parent-owned
 * `folders` order keys.
 */
export interface SyncRequestCollectionPostState {
  collection: Collection;
  /** Live variable uids — the set-member identity (uid) for request-collection vars. */
  varUids: string[];
  /** Live `(itemId, orderKey)` pairs at the parent-owned `folders` set
   *  (§23.5). Same shape as {@link SyncCollectionPostState.setOrderKeys}. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/**
 * Post-commit projection for a request-folder envelope. Same shape as
 * {@link SyncFolderPostState} — sibling order lives on the parent
 * (§23.5) and the path is reconstructed from the parent walk
 * (request-collection root → request-folder chain).
 */
export interface SyncRequestFolderPostState {
  folder: Folder;
  /** Live `(itemId, orderKey)` pairs at the folder's own `folders` set
   *  (§23.5). Same shape as {@link SyncFolderPostState.setOrderKeys}. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/**
 * Post-commit projection for a Template envelope. Parallel to
 * {@link SyncRequestPostState} — carries the materialized
 * {@link Template} and the live itemIds the oracle holds at the
 * set-modeled `conditions` path. Renderer-side write helpers fold this
 * into their local mirror so partial-update emit paths can enumerate
 * `removeFromSet` itemIds without round-tripping back to the SW
 * (§19.4 synchronous-render discipline).
 */
export interface SyncTemplatePostState {
  template: Template;
  /** Map keyed by set path (`conditions`). */
  setItemIds: Record<string, string[]>;
  /**
   * Live `(itemId, orderKey)` pairs at each set-modeled path, in
   * canonical sort order. Renderer write helpers feed these into
   * `synthesizeSetDiff` so save-time gestures emit the minimum envelope
   * set — `addToSet` (LWW supersede) for content edits, with no
   * redundant `removeFromSet` (§7.2). Parallel to
   * {@link SyncRulePostState.setOrderKeys} /
   * {@link SyncRequestPostState.setOrderKeys}.
   */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/**
 * Post-commit projection for a template-collection envelope. Mirrors
 * {@link SyncRequestCollectionPostState}: carries the materialized
 * {@link Collection} plus live variable uids and the parent-owned
 * `folders` order keys.
 */
export interface SyncTemplateCollectionPostState {
  collection: Collection;
  /** Live variable uids — the set-member identity (uid) for template-collection vars. */
  varUids: string[];
  /** Live `(itemId, orderKey)` pairs at the parent-owned `folders` set
   *  (§23.5). Same shape as {@link SyncCollectionPostState.setOrderKeys}. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/**
 * Post-commit projection for a template-folder envelope. Same shape as
 * {@link SyncRequestFolderPostState} — sibling order lives on the
 * parent (§23.5) and the path is reconstructed from the parent walk
 * (template-collection root → template-folder chain).
 */
export interface SyncTemplateFolderPostState {
  folder: Folder;
  /** Live `(itemId, orderKey)` pairs at the folder's own `folders` set
   *  (§23.5). Same shape as {@link SyncFolderPostState.setOrderKeys}. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/**
 * Post-commit projection for a Live-Variable envelope. LV is fully
 * flat-scalar (no set-modeled paths), so the payload carries only the
 * projected entity. Renderer-side mirrors fold this into their local
 * cache so partial-update emit paths can read the canonical shape
 * without round-tripping back to the SW (§19.4).
 */
export interface SyncLiveVariablePostState {
  liveVariable: LiveVariable;
}

/**
 * Post-commit projection for a Live-Workflow envelope. LW has no
 * set-modeled paths — `steps` is a whole-array scalar — so the payload
 * carries only the projected entity.
 */
export interface SyncLiveWorkflowPostState {
  workflow: LiveWorkflow;
}

/**
 * Post-commit projection for an oauth-bundle envelope. Singleton entity
 * per workspace — one materialized record at the fixed id `oauth`. The
 * three set-modeled paths (`tokens`, `configs`, `refreshErrors`) are
 * projected back into Records keyed by `credentialRef` so the renderer
 * mirror + scheduler both see post-commit state without iterating
 * arrays. Item payloads stay opaque to core — they're typed at the
 * extension boundary (`OAuth2TokenBundle`, `OAuth2Auth`,
 * `OAuthRefreshErrorState`).
 *
 * The bundle is §12.1 schema-marked sensitive in full — broadcast is
 * local-only and never crosses any sync transport (Vault + OAuth share
 * the §12.3 v1 commitment). Awareness publishes for entities of this
 * type carry no `fieldFocus` (§14.4); the post-state itself is data
 * the local scheduler / executor consume.
 */
export interface SyncOAuthBundlePostState {
  /** Per-credentialRef token bundle map. */
  tokens: Record<string, unknown>;
  /** Per-credentialRef captured config sidecar. */
  configs: Record<string, unknown>;
  /** Per-credentialRef refresh failure state. */
  refreshErrors: Record<string, unknown>;
  /** Sorted union of credentialRefs across all three maps — convenient
   *  for consumers (scheduler, UI) that iterate by credential. */
  credentialRefs: string[];
}

/**
 * Post-commit projection for a pause-markers envelope. Singleton entity
 * per workspace — there is exactly one materialized record at the fixed
 * id `pause-markers`. The catalog stores entries as set members at
 * `markers` (set member identity = path); the projection folds the live
 * set back into a `Record<path, marker>` so renderer + DNR consumers
 * see post-commit state without iterating arrays.
 *
 * Pause markers are user-visible UX state, not secrets — broadcast +
 * sync transports carry them freely.
 */
export interface SyncPauseMarkersPostState {
  /** Path → 'paused' | 'unpaused'. */
  markers: Record<string, 'paused' | 'unpaused'>;
  /** Sorted live set of marked paths — convenient for consumers
   *  iterating in deterministic order. */
  paths: string[];
}

/**
 * Post-commit projection for a layout-state envelope. Singleton entity
 * per workspace — there is exactly one materialized record at the fixed
 * id `layout-state`. The catalog stores the layout as a whole-object
 * scalar at `layout`; the projection re-emits that opaque blob so the
 * renderer's `useResponsiveLayout` / `useDockLayoutStorage` hooks can
 * pick it up without inspecting the engine's internals.
 *
 * Not sensitive — layout is pure UX state.
 */
export interface SyncLayoutStatePostState {
  /** Opaque layout blob — shape lives in the renderer hooks. `null`
   *  when the singleton hasn't been seeded yet. */
  layout: unknown;
}

/**
 * Post-commit projection for a files envelope. Singleton entity per
 * workspace — there is exactly one materialized record at the fixed id
 * `files`. The catalog stores entries as set members at `refs` (set
 * member identity = `fileId`); the projection folds the live set back
 * into a `FileRef[]` (with an alongside-sorted `fileIds: string[]` for
 * deterministic iteration) so renderer + executor consumers see post-
 * commit state without iterating arrays.
 *
 * Bytes never appear in this payload — the catalog governs only
 * `(fileId, hash, filename, mimeType, size)`. The actual blob bytes
 * live in the platform `BlobStore` (extension IDB) keyed by `fileId`
 * and are read lazily on demand.
 *
 * Not sensitive — file metadata is user-visible. Same broadcast posture
 * as pause-markers.
 */
export interface SyncFilesPostState {
  /** All currently-known FileRefs, in fileId order. */
  refs: FileRef[];
  /** Sorted live set of fileIds — convenient for consumers iterating
   *  in deterministic order. */
  fileIds: string[];
}

/**
 * Post-commit projection for an extensionWorkspace envelope. Singleton
 * entity at the GLOBAL scope (lives above the per-workspace oracle, so
 * its mutation-log + cache survive workspace-switch dispose+init). The
 * catalog stores workspace records as set members at `workspaces` (set
 * member identity = workspace id) plus the active-workspace pointer as
 * a scalar at `activeId`; the projection folds them into a sorted
 * `ExtensionWorkspace[]` (re-emitting the per-entry orderKey via a
 * synthetic `sortIndex` so legacy consumers stay byte-stable) plus the
 * scalar pointer.
 *
 * Not sensitive — workspace names + colors are user-visible. Same
 * broadcast posture as files.
 */
export interface SyncExtensionWorkspacePostState {
  /** All currently-known workspaces, sorted by orderKey ascending then id. */
  workspaces: ExtensionWorkspace[];
  /**
   * Active-workspace pointer. `null` when no envelope has set it yet
   * (cold oracle prior to seed). Consumers fall back to the first
   * workspace in the list, matching the legacy hydration guard.
   */
  activeWorkspaceId: string | null;
  /**
   * Per-workspace fractional-indexing keys, keyed by workspace id. The
   * public `ExtensionWorkspace` shape strips them (consumers see a
   * sorted list); renderer-direct write paths need them to mint
   * `keyBetween` between siblings on rename without touching position.
   */
  orderKeys: Record<string, string>;
}

/** Oracle → surfaces: a committed envelope, broadcast for ack + replay. */
export interface SyncBroadcastEvent {
  type: 'oh.sync.broadcast';
  envelope: MutationEnvelope;
  outcome: MutatorOutcome;
  batchId?: string;
  /**
   * Populated for Rule envelopes whose batch left a materialized rule
   * in place (i.e. not a `delete`). Other entity types and rolled-back
   * batches leave it `undefined`.
   */
  rulePostState?: SyncRulePostState;
  /**
   * Populated for Environment envelopes whose batch left a materialized
   * environment in place. Tombstoned environments and rolled-back
   * batches leave it `undefined`.
   */
  environmentPostState?: SyncEnvironmentPostState;
  /**
   * Populated for Collection envelopes whose batch left a materialized
   * collection in place. Tombstoned collections and rolled-back batches
   * leave it `undefined`.
   */
  collectionPostState?: SyncCollectionPostState;
  /**
   * Populated for workspace-variables envelopes whose batch left a
   * materialized record in place. Tombstoned (singleton deletion is
   * not a production gesture) and rolled-back batches leave it
   * `undefined`.
   */
  workspaceVariablesPostState?: SyncWorkspaceVariablesPostState;
  /**
   * Populated for vault envelopes whose batch left a materialized
   * record in place. Tombstoned (singleton deletion is not a
   * production gesture) and rolled-back batches leave it `undefined`.
   */
  vaultPostState?: SyncVaultPostState;
  /**
   * Populated for Folder envelopes whose batch left a materialized
   * folder in place. Tombstoned folders and rolled-back batches leave
   * it `undefined`. Folders whose parent linkage couldn't be resolved
   * (parent yet to seed during boot replay) also leave it undefined —
   * the next folder/parent broadcast will republish once the chain is
   * resolvable.
   */
  folderPostState?: SyncFolderPostState;
  /**
   * Populated for Request envelopes whose batch left a materialized
   * request in place. Tombstoned requests and rolled-back batches leave
   * it `undefined`.
   */
  requestPostState?: SyncRequestPostState;
  /**
   * Populated for request-collection envelopes whose batch left a
   * materialized collection in place. Tombstoned collections and
   * rolled-back batches leave it `undefined`.
   */
  requestCollectionPostState?: SyncRequestCollectionPostState;
  /**
   * Populated for request-folder envelopes whose batch left a
   * materialized folder in place. Tombstoned folders, rolled-back
   * batches, and folders whose parent linkage couldn't be resolved
   * (parent yet to seed during boot replay) all leave it `undefined`.
   */
  requestFolderPostState?: SyncRequestFolderPostState;
  /**
   * Populated for Template envelopes whose batch left a materialized
   * template in place. Tombstoned templates and rolled-back batches
   * leave it `undefined`.
   */
  templatePostState?: SyncTemplatePostState;
  /**
   * Populated for template-collection envelopes whose batch left a
   * materialized collection in place. Tombstoned collections and
   * rolled-back batches leave it `undefined`.
   */
  templateCollectionPostState?: SyncTemplateCollectionPostState;
  /**
   * Populated for template-folder envelopes whose batch left a
   * materialized folder in place. Tombstoned folders, rolled-back
   * batches, and folders whose parent linkage couldn't be resolved
   * (parent yet to seed during boot replay) all leave it `undefined`.
   */
  templateFolderPostState?: SyncTemplateFolderPostState;
  /**
   * Populated for Live-Variable envelopes whose batch left a materialized
   * LV in place. Tombstoned LVs and rolled-back batches leave it
   * `undefined`.
   */
  liveVariablePostState?: SyncLiveVariablePostState;
  /**
   * Populated for Live-Workflow envelopes whose batch left a
   * materialized workflow in place. Tombstoned workflows and rolled-back
   * batches leave it `undefined`.
   */
  liveWorkflowPostState?: SyncLiveWorkflowPostState;
  /**
   * Populated for oauth-bundle envelopes whose batch left a materialized
   * record in place. Tombstoned (singleton deletion is a workspace-level
   * teardown gesture only) and rolled-back batches leave it `undefined`.
   */
  oauthBundlePostState?: SyncOAuthBundlePostState;
  /**
   * Populated for pause-markers envelopes whose batch left a
   * materialized record in place. Tombstoned (singleton deletion is a
   * workspace-level teardown gesture only) and rolled-back batches
   * leave it `undefined`.
   */
  pauseMarkersPostState?: SyncPauseMarkersPostState;
  /**
   * Populated for layout-state envelopes whose batch left a materialized
   * record in place. Tombstoned (singleton deletion is a workspace-level
   * teardown gesture only) and rolled-back batches leave it `undefined`.
   */
  layoutStatePostState?: SyncLayoutStatePostState;
  /**
   * Populated for files envelopes whose batch left a materialized
   * record in place. Tombstoned (singleton deletion is a workspace-level
   * teardown gesture only) and rolled-back batches leave it `undefined`.
   */
  filesPostState?: SyncFilesPostState;
  /**
   * Populated for extensionWorkspace envelopes whose batch left the
   * global singleton in place. Tombstoned (singleton deletion is not a
   * production gesture) and rolled-back batches leave it `undefined`.
   * Published by the global-scope oracle, not the per-workspace one;
   * the renderer-side mirror filters by `body.type` so source-of-broadcast
   * is transparent to consumers.
   */
  extensionWorkspacePostState?: SyncExtensionWorkspacePostState;
}

/** Single union surface code can switch over without importing five types. */
export type SyncBridgeMessage = SyncApplyRequest | SyncBroadcastEvent;

export const SYNC_APPLY_TYPE = 'oh.sync.apply' as const;
export const SYNC_BROADCAST_TYPE = 'oh.sync.broadcast' as const;
