/**
 * Workspace-aware loader — the carve-out seam for v2.1.
 *
 * Some snapshot fields reference workspace-scoped entity uids (rule
 * uids, request uids, folder ids — anything that is not stable across
 * workspaces). Inheriting those across workspaces would surface
 * entities the new tab can't open. This module houses the decision
 * tree that resolves a loaded snapshot against the current workspace
 * id and rebuilds the workspace-scoped slice from a host-supplied
 * fall-through when the donor was a different workspace.
 *
 * Design § 2.2. The loader is a generic factory: surfaces declare the
 * shape of their workspace slice, the read of `getActiveWorkspaceId`,
 * and the fall-through builder. The factory composes these into the
 * `resolveSnapshot` async hook that `useEditingScopeViewState` consumes.
 */

/**
 * The workspace-scoped slice envelope. The `workspaceId` IS the
 * source of truth for which workspace this slice belongs to — the
 * resolver compares it against the current workspace id and rebuilds
 * the slice when they differ.
 */
export interface WorkspaceSlice<S> {
  workspaceId: string;
  data: S;
}

/**
 * Adapter the host implements to wire a generic snapshot type into
 * the workspace-aware decision tree. Three responsibilities:
 *
 *   1. Read the active workspace id (async — backed by storage).
 *   2. Project the snapshot to / from its workspace slice (so the
 *      resolver can swap the slice without knowing the rest of the
 *      snapshot's shape).
 *   3. Build a fall-through slice for a workspace that has no donor
 *      match (typically reads the workspace's legacy per-workspace
 *      key — e.g. `wsKeys(id).tabSession` — and fills the rest with
 *      factory defaults).
 */
export interface WorkspaceAwareConfig<T, S> {
  /** Read the current active workspace id. Returns `null` when the
   *  workspace pointer hasn't been initialized yet (cold profile). */
  getActiveWorkspaceId: () => Promise<string | null>;
  /** Project the snapshot to its workspace slice. Returns `null` when
   *  the snapshot has no workspace slice yet (fresh factory state or
   *  post-fall-through wipe). */
  getSlice: (snap: T) => WorkspaceSlice<S> | null;
  /** Replace (or set / clear) the workspace slice on a snapshot. */
  withSlice: (snap: T, slice: WorkspaceSlice<S> | null) => T;
  /** Build a fall-through slice for a workspace that has no donor
   *  match. Reads the workspace's legacy per-workspace key (or any
   *  other store) and fills the rest from factory defaults. */
  fallThrough: (workspaceId: string) => Promise<S>;
}

/**
 * Build the `resolveSnapshot` async hook for `useEditingScopeViewState`.
 *
 * Decision tree:
 *
 *   getActiveWorkspaceId() → null      ⇒ return raw  (no workspace yet)
 *   slice == null                       ⇒ build slice via fallThrough(activeId)
 *   slice.workspaceId === activeId      ⇒ return raw  (matched donor)
 *   slice.workspaceId !== activeId      ⇒ replace slice via fallThrough(activeId)
 *
 * The resolver runs on every load path (sessionStorage hit, donor
 * record, factoryDefault) — see `useEditingScopeViewState`'s mount lifecycle.
 */
export function createWorkspaceAwareResolver<T, S>(
  cfg: WorkspaceAwareConfig<T, S>,
): (raw: T) => Promise<T> {
  return async (raw) => {
    const activeId = await cfg.getActiveWorkspaceId();
    if (!activeId) return raw;

    const slice = cfg.getSlice(raw);
    if (slice && slice.workspaceId === activeId) return raw;

    const data = await cfg.fallThrough(activeId);
    return cfg.withSlice(raw, { workspaceId: activeId, data });
  };
}
