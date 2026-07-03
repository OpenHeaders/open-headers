/**
 * Shared seam for the LF1–LF4 detectors: the log tag, the host's
 * `refreshNow` hook (set by the lifecycle, read by every detector),
 * and the changed-pair shape the LF2 + LF4 paths exchange.
 */

export const LOG = 'DefinitionalFreshness';

/**
 * Gated immediate refresh of one `(workspace, workflow, env)` identity —
 * the single host-specific seam. The extension routes it through the
 * sync-warm adapter path (circuit gate + observability); the desktop
 * routes it through its gated `fire`. Errors are caught by the caller.
 */
export type RefreshNow = (workspaceId: string, workflowUid: string, environmentId: string | null) => Promise<void>;

export let refreshNow: RefreshNow | null = null;

export function setRefreshNow(next: RefreshNow | null): void {
  refreshNow = next;
}

/** One changed `(workflow, env)` pair — shared by the LF2 + LF4 paths. */
export interface ChangedWorkflowEnv {
  workflowUid: string;
  environmentId: string | null;
}
