/**
 * Branch-switch pass — the wrapped checkout behind the in-app switch
 * gesture (GIT_PLAN.md §6; DATA_PLANE_TOPOLOGIES.md §6.2). The gesture
 * carries the uncommitted-changes answer when the tree is dirty:
 *
 *   - `commit` — the ordinary engine commit (semantic draft) lands
 *     first, then a plain checkout;
 *   - `stash` — `git stash push -u` onto the user's own stash stack
 *     (recoverable with their own `git stash pop`), then checkout;
 *   - `discard` — `checkout --force` + `clean -fd` (gitignored paths —
 *     the sidecar and secrets — survive); the card danger-confirms
 *     this choice before it ever reaches the host;
 *   - absent — a dirty tree refuses with the count so the surface can
 *     raise the §6.2 prompt.
 *
 * The caller (runtime) owns what follows a successful switch: flip the
 * §6.3 per-branch log pointer, then the rung-2 tree-wins sweep that
 * converges the engine to the new branch's tree — the same path an
 * external terminal checkout takes via the HEAD watcher.
 */

import {
  checkoutWorkspaceBranch,
  cleanUntracked,
  countDirtyFiles,
  currentBranch,
  type GitRunner,
  gitOperationInProgress,
  resolveRefSha,
  stashWorkspaceTree,
} from '../git';

export type SwitchDirtyAction = 'commit' | 'stash' | 'discard';

export interface SwitchWorkspaceBranchOptions {
  run: GitRunner;
  rootDir: string;
  /** The local branch to check out. */
  branch: string;
  /** The user's §6.2 prompt answer; absent = refuse when dirty. */
  dirtyAction?: SwitchDirtyAction;
  /** The ordinary engine commit pass — the `commit` choice rides it. */
  commit: () => Promise<{ ok: boolean; detail?: string }>;
}

export type SwitchWorkspaceBranchResult =
  | { ok: true; branch: string; switched: boolean }
  | {
      ok: false;
      reason: 'op-in-progress' | 'unknown-branch' | 'dirty' | 'commit-failed' | 'stash-failed' | 'checkout-failed';
      detail?: string;
      dirtyFiles?: number;
    };

export async function switchWorkspaceBranch(
  options: SwitchWorkspaceBranchOptions,
): Promise<SwitchWorkspaceBranchResult> {
  const { run, rootDir, branch } = options;

  const opMarker = await gitOperationInProgress(rootDir);
  if (opMarker !== null) return { ok: false, reason: 'op-in-progress', detail: opMarker };

  const active = await currentBranch(run, rootDir);
  if (active === branch) return { ok: true, branch, switched: false };

  if ((await resolveRefSha(run, rootDir, `refs/heads/${branch}`)) === null) {
    return { ok: false, reason: 'unknown-branch', detail: branch };
  }

  const dirty = (await countDirtyFiles(run, rootDir)) ?? 0;
  if (dirty > 0) {
    if (options.dirtyAction === undefined) return { ok: false, reason: 'dirty', dirtyFiles: dirty };
    if (options.dirtyAction === 'commit') {
      const committed = await options.commit();
      if (!committed.ok) {
        return {
          ok: false,
          reason: 'commit-failed',
          ...(committed.detail !== undefined ? { detail: committed.detail } : {}),
        };
      }
    } else if (options.dirtyAction === 'stash') {
      const stashed = await stashWorkspaceTree(run, rootDir, `OpenHeaders: switch to ${branch}`);
      if (!stashed.ok) return { ok: false, reason: 'stash-failed', detail: stashed.detail };
    }
  }

  const force = dirty > 0 && options.dirtyAction === 'discard';
  const checkedOut = await checkoutWorkspaceBranch(run, rootDir, branch, { force });
  if (!checkedOut.ok) return { ok: false, reason: 'checkout-failed', detail: checkedOut.detail };

  if (force) {
    const cleaned = await cleanUntracked(run, rootDir);
    if (!cleaned.ok) return { ok: false, reason: 'checkout-failed', detail: cleaned.detail };
  }

  return { ok: true, branch, switched: true };
}
