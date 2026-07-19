/**
 * In-app branch merge — the Phase 4 pull machinery pointed at a LOCAL
 * ref (GIT_PLAN.md §6 / §10 Phase 6). Raw `git merge` is never
 * invoked: two branches that diverged textually CAN conflict at the
 * git level, and the no-`<<<<<<<` guarantee (§23.7) holds only when
 * the mutation pipeline does the merging. The other branch's commits
 * are treated exactly like foreign history — snapshot diff against the
 * merge base → virtual mutation batches → mutator convergence →
 * converged tree written → a true fast-forward when the current branch
 * has not diverged, a two-parent commit with `Co-Authored-By:`
 * trailers otherwise.
 *
 * The ref may be a local branch (`local-test`) or a remote-tracking
 * ref (`origin/main`) — the §6 teammate scenario's "pull `main` into
 * your branch" is a merge of the already-fetched `origin/main` while
 * `local-test` is checked out. No network is ever touched here; the
 * background fetch keeps remote-tracking refs fresh (§3.2).
 */

import type { TreeIssue } from '@openheaders/core/workspace-tree';
import { countLeftRight, currentBranch, gitOperationInProgress, resolveRefSha } from '../git';
import { type IntegrateForeignDeps, integrateForeignHead } from './pull';

export interface MergeWorkspaceBranchOptions extends IntegrateForeignDeps {
  /** The ref to merge into the current branch (local branch or remote-tracking ref). */
  ref: string;
}

export type MergeWorkspaceBranchResult =
  | { ok: true; upToDate: true }
  | { ok: true; upToDate: false; sha: string; applied: number; issues: TreeIssue[] }
  | {
      ok: false;
      reason:
        | 'op-in-progress'
        | 'unknown-ref'
        | 'self-merge'
        | 'detached-head'
        | 'foreign-invalid'
        | 'identity-mismatch'
        | 'commit-failed';
      detail?: string;
      issues: TreeIssue[];
    };

export async function mergeWorkspaceBranch(options: MergeWorkspaceBranchOptions): Promise<MergeWorkspaceBranchResult> {
  const { run, rootDir, ref } = options;

  const opMarker = await gitOperationInProgress(rootDir);
  if (opMarker !== null) return { ok: false, reason: 'op-in-progress', detail: opMarker, issues: [] };

  const branch = await currentBranch(run, rootDir);
  if (branch === null) return { ok: false, reason: 'detached-head', issues: [] };
  if (ref === branch) return { ok: false, reason: 'self-merge', detail: ref, issues: [] };

  const foreignSha = await resolveRefSha(run, rootDir, ref);
  if (foreignSha === null) return { ok: false, reason: 'unknown-ref', detail: ref, issues: [] };

  const counts = await countLeftRight(run, rootDir, 'HEAD', foreignSha);
  if (counts === null) return { ok: false, reason: 'unknown-ref', detail: ref, issues: [] };
  if (counts.behind === 0) return { ok: true, upToDate: true };

  const integrated = await integrateForeignHead(options, {
    foreignSha,
    localAhead: counts.ahead,
    mergeMessage: `Merge branch '${ref}'`,
  });
  if (!integrated.ok) return integrated;
  return { ok: true, upToDate: false, sha: integrated.sha, applied: integrated.applied, issues: integrated.issues };
}
