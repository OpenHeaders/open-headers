/**
 * Scope HEAD tracker — the client side of the git-sync plan §3.5's
 * reconnect-across-checkout notice.
 *
 * Every SYNCED a backend answers for a git-bound workspace carries the
 * host's checked-out HEAD stamp. This module remembers the last stamp
 * seen per workspace across the host's wires and reports a change ONCE:
 * the first frame for a workspace only records (a fresh install, a
 * restarted worker and a first join have nothing to compare against),
 * an identical stamp is silence, a different stamp is one change. A
 * frame without a stamp — the workspace was unbound on the host, or the
 * responder predates the field — forgets the workspace, so a later
 * rebind starts over instead of reading as a branch move.
 *
 * Module state, not React state: the SYNCED lands in the sync plane
 * (a service worker, the desktop main process, the served tab's wire)
 * and the workbench only hears the change it fans out.
 */

export interface ScopeGitHeadChange {
  readonly workspaceId: string;
  /** The stamp the previous SYNCED for the workspace carried. */
  readonly previous: string;
  /** The stamp this SYNCED carries. */
  readonly gitHead: string;
}

const lastHeadByWorkspace = new Map<string, string>();

/**
 * Fold one scope's SYNCED stamp; the change when the host's HEAD
 * differs from the previous frame's, null otherwise.
 */
export function foldScopeGitHead(workspaceId: string, gitHead: string | null): ScopeGitHeadChange | null {
  if (gitHead === null) {
    lastHeadByWorkspace.delete(workspaceId);
    return null;
  }
  const previous = lastHeadByWorkspace.get(workspaceId);
  lastHeadByWorkspace.set(workspaceId, gitHead);
  if (previous === undefined || previous === gitHead) return null;
  return { workspaceId, previous, gitHead };
}

/** Test seam — forget every remembered stamp. */
export function resetScopeGitHeadTrackerForTests(): void {
  lastHeadByWorkspace.clear();
}
