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

import type { MutationBatch, MutationEnvelope, MutatorOutcome, SideEffectIntent } from '../sync';
import type { V5 } from '../types';

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
 * V5.Rule and the live itemIds the oracle holds at each set-modeled
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
  rule: V5.Rule;
  /** Map keyed by set path (e.g. `conditions`, `action.requestHeaders`). */
  setItemIds: Record<string, string[]>;
}

/**
 * Post-commit projection for an Environment envelope. Carries the
 * materialized {@link V5.Environment} plus the live variable names
 * (set member identity = name, see env mutators). Renderer-side
 * mirrors fold this in lockstep with the SW oracle so they can read
 * post-commit state without a round-trip.
 */
export interface SyncEnvironmentPostState {
  environment: V5.Environment;
  /** Live variable names — the set-member identity for env vars. */
  varNames: string[];
}

/**
 * Post-commit projection for a Collection envelope. Carries the
 * materialized {@link V5.Collection} plus the live variable names
 * (set member identity = name, same as env vars). Renderer-side
 * mirrors fold this so collection-vars editing surfaces can read
 * post-commit state without a round-trip.
 */
export interface SyncCollectionPostState {
  collection: V5.Collection;
  /** Live variable names — the set-member identity for collection vars. */
  varNames: string[];
}

/**
 * Post-commit projection for a workspace-variables envelope. Singleton
 * entity per workspace — there is exactly one materialized record at
 * the fixed id `workspace-vars`. Carries the materialized
 * {@link V5.WorkspaceVariables} plus the live variable names (set
 * member identity = name, same as env + collection vars). Renderer
 * mirrors fold this so the workspace-vars editing surface reads
 * post-commit state without a round-trip.
 */
export interface SyncWorkspaceVariablesPostState {
  workspaceVariables: V5.WorkspaceVariables;
  /** Live variable names — the set-member identity for workspace vars. */
  varNames: string[];
}

/**
 * Post-commit projection for a vault envelope. Singleton entity per
 * workspace — there is exactly one materialized record at the fixed
 * id `vault`. Carries the materialized {@link V5.Vault} plus the live
 * secret names (set member identity = name, same shape as the other
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
  vault: V5.Vault;
  /** Live secret names — the set-member identity for vault entries. */
  secretNames: string[];
}

/**
 * Post-commit projection for a Request envelope. Parallel to
 * {@link SyncRulePostState} — carries the materialized
 * {@link V5.Request} and the live itemIds the oracle holds at each
 * set-modeled path (`headers`, `params`). Renderer-side write helpers
 * fold this into their local mirror so partial-update emit paths can
 * enumerate `removeFromSet` itemIds without round-tripping back to the
 * SW (§19.4 synchronous-render discipline).
 */
export interface SyncRequestPostState {
  request: V5.Request;
  /** Map keyed by set path (`headers`, `params`). */
  setItemIds: Record<string, string[]>;
}

/**
 * Post-commit projection for a Folder envelope. Carries the
 * materialized {@link V5.Folder} with its full path reconstructed from
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
  folder: V5.Folder;
}

/**
 * Post-commit projection for a request-collection envelope. Mirrors
 * {@link SyncCollectionPostState} but the catalog ships rename-only at
 * v1 — request collections don't expose collection-variable editing
 * today, so no live `varNames` are carried. If a future surface adds
 * variable-editing for request collections, copy the rule-collection
 * shape (catalog flatten + projector inverse + `varNames` payload).
 */
export interface SyncRequestCollectionPostState {
  collection: V5.Collection;
}

/**
 * Post-commit projection for a request-folder envelope. Same shape as
 * {@link SyncFolderPostState} — sibling order lives on the parent
 * (§23.5) and the path is reconstructed from the parent walk
 * (request-collection root → request-folder chain).
 */
export interface SyncRequestFolderPostState {
  folder: V5.Folder;
}

/**
 * Post-commit projection for a Template envelope. Parallel to
 * {@link SyncRequestPostState} — carries the materialized
 * {@link V5.Template} and the live itemIds the oracle holds at the
 * set-modeled `conditions` path. Renderer-side write helpers fold this
 * into their local mirror so partial-update emit paths can enumerate
 * `removeFromSet` itemIds without round-tripping back to the SW
 * (§19.4 synchronous-render discipline).
 */
export interface SyncTemplatePostState {
  template: V5.Template;
  /** Map keyed by set path (`conditions`). */
  setItemIds: Record<string, string[]>;
}

/**
 * Post-commit projection for a template-collection envelope. Mirrors
 * {@link SyncRequestCollectionPostState} — the catalog ships rename-only
 * at v1, so each entry carries `{ collection }` only. If a future
 * surface adds variable-editing for template collections, copy the
 * rule-collection shape (catalog flatten + projector inverse +
 * `varNames` payload).
 */
export interface SyncTemplateCollectionPostState {
  collection: V5.Collection;
}

/**
 * Post-commit projection for a template-folder envelope. Same shape as
 * {@link SyncRequestFolderPostState} — sibling order lives on the
 * parent (§23.5) and the path is reconstructed from the parent walk
 * (template-collection root → template-folder chain).
 */
export interface SyncTemplateFolderPostState {
  folder: V5.Folder;
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
}

/** Single union surface code can switch over without importing five types. */
export type SyncBridgeMessage = SyncApplyRequest | SyncBroadcastEvent;

export const SYNC_APPLY_TYPE = 'oh.sync.apply' as const;
export const SYNC_BROADCAST_TYPE = 'oh.sync.broadcast' as const;
