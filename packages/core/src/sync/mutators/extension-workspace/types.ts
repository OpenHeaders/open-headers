/**
 * ExtensionWorkspace mutator catalog — routing constants.
 *
 * Cross-workspace ("global") metadata entity. Stores the LIST of
 * extension workspaces the user has created. Distinct from every other
 * Phase-B entity in scope: lives ABOVE the per-workspace oracle (the
 * per-workspace oracle keys IDB by `workspaceId`; this catalog uses a
 * sentinel id `EXTENSION_WORKSPACE_GLOBAL_SCOPE` so it survives
 * workspace switches).
 *
 * Singleton entity: one record at id = `EXTENSION_WORKSPACE_ID`.
 *   - `workspaces` set path keyed by workspace id; each slot mirrors the
 *     public {@link ExtensionWorkspace} shell minus `sortIndex`
 *     (ordering lives on the set entry's `orderKey`, §23.5) and minus
 *     `schemaVersion` (the singleton itself carries the schema version
 *     when persisted).
 *
 * Which workspace a host is operating on is per host (§8 of the sync
 * engine design): the pointer is the host-local `active-workspace`
 * singleton beside this record, never a field on it. The `activeId`
 * scalar this record used to carry is a legacy row shape — present in
 * every existing log, ignored by type and path everywhere it is read.
 *
 * Whole-record replace via `addToSet` on the `workspaces` path is the
 * Phase B established posture (sessions 21+ for set-modeled entities).
 * Per-field LWW within a slot would be cleaner for concurrent
 * rename + recolor, but is not a v1 primitive (§7.2 condition note).
 *
 * Side effects: a row removal purges the workspace's data; nothing
 * else. Workspace-meta changes don't recompile DNR (rules compile from
 * the active workspace's per-workspace oracle, not the meta entity)
 * and don't invalidate the variables resolver (the resolver scopes are
 * per-workspace too).
 *
 * Not sensitive — workspace names + colors are user-visible.
 */

/** Routing key carried on every extensionWorkspace mutation envelope. */
export const EXTENSION_WORKSPACE_ENTITY_TYPE = 'extensionWorkspace';

/** Fixed singleton id — one record across the whole extension. */
export const EXTENSION_WORKSPACE_ID = 'global';

/** Set path holding the {@link ExtensionWorkspaceSlot} entries on the singleton. */
export const EXTENSION_WORKSPACES_SET_PATH = 'workspaces';

/**
 * Legacy scalar path of the replicated active pointer. Nothing writes
 * it any more; the read gates keep hiding the workspace id a legacy row
 * names, and the projector + side-effect derivation ignore the rows.
 */
export const EXTENSION_WORKSPACE_ACTIVE_ID_PATH = 'activeId';

/**
 * Sentinel `workspaceId` used by the global-scope oracle. Distinct
 * from any user-mintable id (those come from `generateWorkspaceId`
 * — canonical UUIDv7 — and never collide with this fixed string).
 * The IDB mutation log + pending intents stripe by this key so
 * global-scope state survives workspace-switch dispose+init cycles.
 */
export const EXTENSION_WORKSPACE_GLOBAL_SCOPE = '__global__';

/**
 * Set-item shape carried inside the singleton's `workspaces` set.
 * Mirrors {@link ExtensionWorkspace} minus `schemaVersion` (carried
 * by the singleton-level snapshot) and minus `sortIndex` (replaced by
 * the envelope-resident `orderKey` on each set entry, §23.5). Stored
 * directly so the projector can rebuild a `ExtensionWorkspace[]`
 * straight from `liveSetItems`.
 */
export interface ExtensionWorkspaceSlot {
  id: string;
  kind: 'personal' | 'team';
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  source?: { desktopWorkspaceId: string; displayPath?: string };
  /** Migration provenance — the vendor workspace this one mirrors 1:1. */
  importedFrom?: { vendor: string; workspaceId: string };
  /** Org binding stamped at workspace creation (the unified-oracle model §6.1). */
  orgId: string;
  /**
   * Read-visibility beyond explicit grants (the access-foundation plan
   * §6). Plain string on the sync row by the forward-tolerant decode
   * law: a value minted by a newer build must ride through unchanged,
   * never drop the slot. Absent = `private`; narrow with
   * `resolveWorkspaceVisibility` at enforcement and render sites.
   */
  visibility?: string;
}
