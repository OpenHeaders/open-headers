/**
 * ExtensionWorkspace mutator catalog — routing constants.
 *
 * Cross-workspace ("global") metadata entity. Stores the list of
 * extension workspaces the user has created plus a pointer to the
 * currently-active one. Distinct from every other Phase-B entity in
 * scope: lives ABOVE the per-workspace oracle (the per-workspace
 * oracle keys IDB by `workspaceId`; this catalog uses a sentinel id
 * `EXTENSION_WORKSPACE_GLOBAL_SCOPE` so it survives workspace switches).
 *
 * Singleton entity: one record at id = `EXTENSION_WORKSPACE_ID`.
 *   - `workspaces` set path keyed by workspace id; each slot mirrors the
 *     public {@link ExtensionWorkspace} shell minus `sortIndex`
 *     (ordering lives on the set entry's `orderKey`, §23.5) and minus
 *     `schemaVersion` (the singleton itself carries the schema version
 *     when persisted).
 *   - `activeId` scalar — id of the active workspace, LWW.
 *
 * Whole-record replace via `addToSet` on the `workspaces` path is the
 * Phase B established posture (sessions 21+ for set-modeled entities).
 * Per-field LWW within a slot would be cleaner for concurrent
 * rename + recolor, but is not a v1 primitive (§7.2 condition note).
 *
 * No side effects. Workspace-meta changes don't recompile DNR (rules
 * compile from the active workspace's per-workspace oracle, not the
 * meta entity) and don't invalidate the variables resolver (the
 * resolver scopes are per-workspace too).
 *
 * Not sensitive — workspace names + colors are user-visible. The
 * `setActiveWorkspace` envelope is global by design (cross-tab
 * convergence on the active selection); §8 design-doc note that
 * marks it device-local applies to multi-device futures, not the
 * single-device-multi-tab posture handled here.
 */

/** Routing key carried on every extensionWorkspace mutation envelope. */
export const EXTENSION_WORKSPACE_ENTITY_TYPE = 'extensionWorkspace';

/** Fixed singleton id — one record across the whole extension. */
export const EXTENSION_WORKSPACE_ID = 'global';

/** Set path holding the {@link ExtensionWorkspaceSlot} entries on the singleton. */
export const EXTENSION_WORKSPACES_SET_PATH = 'workspaces';

/** Scalar path holding the active workspace id (string). */
export const EXTENSION_WORKSPACE_ACTIVE_ID_PATH = 'activeId';

/**
 * Sentinel `workspaceId` used by the global-scope oracle. Distinct
 * from any user-mintable id (those come from `generateUid` and never
 * collide with this fixed string). The IDB mutation log + pending
 * intents stripe by this key so global-scope state survives
 * workspace-switch dispose+init cycles.
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
}
