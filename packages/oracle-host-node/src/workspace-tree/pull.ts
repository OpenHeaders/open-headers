/**
 * Pull pass — foreign history → the engine → a two-parent merge commit
 * (GIT_PLAN.md §10 Phase 4; §11.4 as ratified S6: the tree git records
 * is ENGINE-WRITTEN and `git merge` is never invoked).
 *
 * The sequence, on the binding's §8 chain:
 *
 *   1. hold if a git operation is in progress (§3.3 — a mid-rebase
 *      tree is never ingested);
 *   2. `git fetch` (non-mutating), then ahead/behind against the
 *      branch's upstream — behind 0 is a clean no-op;
 *   3. the foreign head's tree is read as a checkout snapshot
 *      (string-in, the same `readWorkspaceTree` the sweep uses) and
 *      diffed at file level against the MERGE BASE — three-way
 *      discipline: only paths the foreign history touched are
 *      tree-authored; everything else stays engine-owned;
 *   4. `synthesizeWorkspaceTreeDelta` (engine snapshot = `prev`,
 *      foreign snapshot = `next`) mints ordinary virtual batches with
 *      fresh HLCs; the mutators converge — there is no second data
 *      plane (plan law #1);
 *   5. schema-invalid foreign documents QUARANTINE (§13.3): their
 *      foreign bytes land in the working tree off-baseline (so the
 *      materializer's rung-2 guard protects them and the next sweep
 *      keeps reporting them), the engine keeps its own value, and the
 *      issue rows surface through the card's quarantine list;
 *   6. materialize the converged tree, then record the pull:
 *      an un-diverged local branch FAST-FORWARDS (plain-git pull
 *      semantics — no merge bubble; engine canonicalization residue
 *      commits as an ordinary follow-up), while genuine divergence
 *      records a TWO-PARENT commit (local HEAD + foreign head) through
 *      the temp-index machinery — hooks and signing run;
 *      `Co-Authored-By:` trailers name the foreign commits' authors
 *      (§23.6/§23.7).
 *
 * Tracked files only by construction: the foreign snapshot comes from
 * the commit's tree, so a gitignored local-only entity can never be
 * mistaken for a foreign deletion (§3.3).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { MutatorContext } from '@openheaders/core/sync';
import type {
  EmissionBatch,
  LiveSetEntriesReader,
} from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import { synthesizeWorkspaceTreeDelta } from '@openheaders/core/sync-builders/mutations/workspace-tree-delta';
import { readWorkspaceTree, type TreeIssue, type WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import {
  commitWorkspaceTree,
  diffForeignPaths,
  fastForwardWorkspaceBranch,
  fetchWorkspaceRemote,
  type GitRunner,
  gitOperationInProgress,
  listForeignAuthors,
  mergeBaseOf,
  readCommitTreeFiles,
  resolveUpstream,
} from '../git';

export interface PullWorkspaceTreeOptions {
  run: GitRunner;
  rootDir: string;
  /** The bound workspace's identity — a foreign tree claiming another uid is refused. */
  workspaceUid: string;
  /** Engine snapshot provider — read AFTER the fetch so the delta sees current state. */
  readSnapshot: () => Promise<WorkspaceTreeState>;
  nextCtx: () => MutatorContext;
  liveSetEntries: LiveSetEntriesReader;
  /** Apply the synthesized batches through the workspace's resident service. */
  apply: (batches: EmissionBatch[]) => Promise<void>;
  /** Materialize the converged engine state to disk (the runtime's flush). */
  flush: () => Promise<unknown>;
  /** Env from `resolveCommitIdentity` for the merge commit. */
  identityEnv: Record<string, string>;
  /** The explicit `--no-verify` setting (§3.3). */
  bypassHooks: boolean;
}

export type PullWorkspaceTreeResult =
  | { ok: true; upToDate: true; issues: TreeIssue[] }
  | { ok: true; upToDate: false; sha: string; applied: number; issues: TreeIssue[] }
  | {
      ok: false;
      reason:
        | 'op-in-progress'
        | 'no-upstream'
        | 'fetch-failed'
        | 'foreign-invalid'
        | 'identity-mismatch'
        | 'commit-failed';
      detail?: string;
      issues: TreeIssue[];
    };

const dirOf = (filePath: string): string => {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '' : filePath.slice(0, idx);
};

export async function pullWorkspaceTree(options: PullWorkspaceTreeOptions): Promise<PullWorkspaceTreeResult> {
  const { run, rootDir } = options;

  const opMarker = await gitOperationInProgress(rootDir);
  if (opMarker !== null) {
    return { ok: false, reason: 'op-in-progress', detail: opMarker, issues: [] };
  }

  if ((await resolveUpstream(run, rootDir)) === null) return { ok: false, reason: 'no-upstream', issues: [] };

  const fetched = await fetchWorkspaceRemote(run, rootDir);
  if (!fetched.ok) return { ok: false, reason: 'fetch-failed', detail: fetched.detail, issues: [] };

  const upstream = await resolveUpstream(run, rootDir);
  if (upstream === null) return { ok: false, reason: 'no-upstream', issues: [] };
  if (upstream.behind === 0) return { ok: true, upToDate: true, issues: [] };

  const foreignFiles = await readCommitTreeFiles(run, rootDir, upstream.sha);
  if (foreignFiles === null) {
    return { ok: false, reason: 'foreign-invalid', detail: `unreadable tree for ${upstream.sha}`, issues: [] };
  }
  const foreign = readWorkspaceTree(foreignFiles);
  if (foreign.state.workspace === null) {
    return {
      ok: false,
      reason: 'foreign-invalid',
      detail: 'foreign workspace.yaml missing or unparseable',
      issues: foreign.issues,
    };
  }
  if (foreign.state.workspace.uid !== options.workspaceUid) {
    return { ok: false, reason: 'identity-mismatch', detail: foreign.state.workspace.uid, issues: foreign.issues };
  }

  const base = await mergeBaseOf(run, rootDir, 'HEAD', upstream.sha);
  const diff = await diffForeignPaths(run, rootDir, base, upstream.sha);
  if (diff === null) {
    return {
      ok: false,
      reason: 'foreign-invalid',
      detail: `undiffable range ${base ?? '(root)'}..${upstream.sha}`,
      issues: foreign.issues,
    };
  }

  const snapshot = await options.readSnapshot();
  const batches = synthesizeWorkspaceTreeDelta({
    prev: snapshot,
    next: foreign.state,
    changedPaths: diff.changed,
    removedPaths: diff.removed,
    deps: { nextCtx: options.nextCtx, liveSetEntries: options.liveSetEntries },
  });
  if (batches.length > 0) {
    await options.apply(batches);
  }

  // Quarantine (§13.3): a schema-invalid foreign document's entity was
  // skipped by the read above (its prev value stands in the engine).
  // Its foreign bytes still land in the working tree — off-baseline,
  // so the materializer's rung-2 guard leaves them alone and every
  // sweep keeps reporting the issue until the user fixes or reverts.
  const issueDirs = new Set(foreign.issues.map((issue) => dirOf(issue.path)));
  const byPath = new Map(foreignFiles.map((file) => [file.path, file.content] as const));
  for (const filePath of diff.changed) {
    if (!issueDirs.has(dirOf(filePath))) continue;
    const content = byPath.get(filePath);
    if (content === undefined) continue;
    const target = path.join(rootDir, ...filePath.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
  }

  await options.flush();

  // Un-diverged local branch ⇒ plain-git pull semantics: a true
  // fast-forward, no merge bubble (git itself would reduce the
  // redundant parent anyway). Foreign commits keep their own
  // authorship; any canonicalization residue the engine produced on
  // top commits as an ordinary follow-up (no-op when byte-identical).
  if (upstream.ahead === 0) {
    const ff = await fastForwardWorkspaceBranch(run, rootDir, upstream.sha);
    if (!ff.ok) return { ok: false, reason: 'commit-failed', detail: ff.detail, issues: foreign.issues };
    const residue = await commitWorkspaceTree({
      run,
      rootDir,
      message: 'Normalize pulled changes',
      identityEnv: options.identityEnv,
      bypassHooks: options.bypassHooks,
    });
    if (!residue.ok) return { ok: false, reason: 'commit-failed', detail: residue.detail, issues: foreign.issues };
    const sha = residue.committed ? residue.sha : upstream.sha;
    return { ok: true, upToDate: false, sha, applied: batches.length, issues: foreign.issues };
  }

  const authors = await listForeignAuthors(run, rootDir, 'HEAD', upstream.sha);
  const trailerBlock = authors.length > 0 ? `\n\n${authors.map((a) => `Co-Authored-By: ${a}`).join('\n')}` : '';
  const commit = await commitWorkspaceTree({
    run,
    rootDir,
    message: `Merge ${upstream.upstream}${trailerBlock}`,
    identityEnv: options.identityEnv,
    bypassHooks: options.bypassHooks,
    mergeParent: upstream.sha,
  });
  if (!commit.ok) return { ok: false, reason: 'commit-failed', detail: commit.detail, issues: foreign.issues };
  if (!commit.committed)
    return { ok: false, reason: 'commit-failed', detail: 'merge commit did not land', issues: foreign.issues };

  return { ok: true, upToDate: false, sha: commit.sha, applied: batches.length, issues: foreign.issues };
}
