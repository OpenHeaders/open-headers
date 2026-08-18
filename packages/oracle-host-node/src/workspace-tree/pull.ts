/**
 * Pull pass — foreign history → the engine → a two-parent merge commit
 * (the git-sync plan §10 Phase 4; §11.4 as ratified S6: the tree git records
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
  isAncestorOf,
  listForeignAuthors,
  mergeBaseOf,
  readCommitTreeFiles,
  resolveUpstream,
} from '../git';
import {
  hashTreeContent,
  type QuarantineIndex,
  readMaterializedIndex,
  readQuarantineIndex,
  writeMaterializedIndex,
  writeQuarantineIndex,
} from './sidecar';

/**
 * The dependency set shared by every pass that integrates a foreign
 * head through the mutators — pull (Phase 4, remote upstream) and the
 * Phase 6 in-app branch merge (§6: the same machinery pointed at a
 * local ref, never raw `git merge`).
 */
export interface IntegrateForeignDeps {
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

export interface PullWorkspaceTreeOptions extends IntegrateForeignDeps {
  /**
   * The §16 force-push watermark — the remote sha this engine last
   * integrated. When the fetched head no longer descends from it, the
   * pull refuses (`force-push`) so the trichotomy dialog resolves the
   * rewrite deliberately; absent = first sync, detection off.
   */
  lastSyncedRemoteSha?: string;
}

export type PullWorkspaceTreeResult =
  | { ok: true; upToDate: true; remoteSha: string; issues: TreeIssue[] }
  | { ok: true; upToDate: false; sha: string; remoteSha: string; applied: number; issues: TreeIssue[] }
  | {
      ok: false;
      reason:
        | 'op-in-progress'
        | 'no-upstream'
        | 'fetch-failed'
        | 'force-push'
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

/**
 * Quarantine (§13.3): a schema-invalid foreign document's entity is
 * skipped by the read (its engine value stands, its absence never
 * gates a delete), but its foreign bytes still land in the working
 * tree OFF-baseline — the materializer's rung-2 guard leaves them
 * alone and every sweep keeps reporting the issue until the user
 * fixes or reverts. Each write is recorded in the sidecar quarantine
 * index so a later pass can tell this machine write from a genuine
 * hand edit. Shared by the pull pass and the §16 resolutions.
 */
export async function writeForeignQuarantine(
  rootDir: string,
  foreignFiles: readonly { path: string; content: string }[],
  issues: readonly TreeIssue[],
  changedPaths: ReadonlySet<string>,
): Promise<void> {
  const issueDirs = new Set(issues.map((issue) => dirOf(issue.path)));
  const byPath = new Map(foreignFiles.map((file) => [file.path, file.content] as const));
  const recorded = await readQuarantineIndex(rootDir);
  let recordChanged = false;
  for (const filePath of changedPaths) {
    if (!issueDirs.has(dirOf(filePath))) continue;
    const content = byPath.get(filePath);
    if (content === undefined) continue;
    const target = path.join(rootDir, ...filePath.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
    recorded[filePath] = hashTreeContent(content);
    recordChanged = true;
  }
  if (recordChanged) await writeQuarantineIndex(rootDir, recorded);
}

/**
 * The quarantine exit (§13.3's other half): when a later foreign head
 * reads CLEAN at a previously-quarantined path and the disk bytes are
 * still exactly the ones the engine quarantined (the recorded hash —
 * i.e. no user hand edit happened), the newer foreign truth supersedes
 * the engine's own stale write. Re-adopting those bytes into the
 * materializer baseline lets the ordinary diff-write normalize them to
 * the healed engine value on the very flush that follows — without
 * this, a fix pushed by the peer could never land on disk (the rung-2
 * guard would protect the engine's own quarantine write forever). A
 * path the user has since edited keeps today's posture: the record is
 * dropped, the bytes stay rung-2 input for the sweep.
 */
export async function releaseHealedQuarantine(rootDir: string, issues: readonly TreeIssue[]): Promise<void> {
  const recorded = await readQuarantineIndex(rootDir);
  const paths = Object.keys(recorded);
  if (paths.length === 0) return;
  const issueDirs = new Set(issues.map((issue) => dirOf(issue.path)));
  const baseline = await readMaterializedIndex(rootDir);
  const kept: QuarantineIndex = {};
  let adopted = false;
  for (const filePath of paths) {
    if (issueDirs.has(dirOf(filePath))) {
      kept[filePath] = recorded[filePath];
      continue;
    }
    const target = path.join(rootDir, ...filePath.split('/'));
    let disk: string | null;
    try {
      disk = await fs.readFile(target, 'utf-8');
    } catch {
      disk = null;
    }
    if (disk !== null && hashTreeContent(disk) === recorded[filePath]) {
      baseline[filePath] = recorded[filePath];
      adopted = true;
    }
  }
  await writeQuarantineIndex(rootDir, kept);
  if (adopted) await writeMaterializedIndex(rootDir, baseline);
}

export type IntegrateForeignHeadResult =
  | { ok: true; sha: string; applied: number; issues: TreeIssue[] }
  | {
      ok: false;
      reason: 'foreign-invalid' | 'identity-mismatch' | 'commit-failed';
      detail?: string;
      issues: TreeIssue[];
    };

/**
 * The shared integration core (§11.4 mechanics, ratified S6): read the
 * foreign head's tree as a checkout snapshot, three-way classify
 * against the merge base, converge through the mutators as virtual
 * batches, quarantine schema-invalid documents, materialize, then
 * record the result — a true fast-forward when the local branch has
 * not diverged (`localAhead` 0), a TWO-PARENT temp-index commit
 * otherwise. Pull points this at the fetched upstream head; the
 * Phase 6 branch merge points it at a local ref (§6).
 */
export async function integrateForeignHead(
  deps: IntegrateForeignDeps,
  args: { foreignSha: string; localAhead: number; mergeMessage: string },
): Promise<IntegrateForeignHeadResult> {
  const { run, rootDir } = deps;
  const { foreignSha } = args;

  const foreignFiles = await readCommitTreeFiles(run, rootDir, foreignSha);
  if (foreignFiles === null) {
    return { ok: false, reason: 'foreign-invalid', detail: `unreadable tree for ${foreignSha}`, issues: [] };
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
  if (foreign.state.workspace.uid !== deps.workspaceUid) {
    return { ok: false, reason: 'identity-mismatch', detail: foreign.state.workspace.uid, issues: foreign.issues };
  }

  const base = await mergeBaseOf(run, rootDir, 'HEAD', foreignSha);
  const diff = await diffForeignPaths(run, rootDir, base, foreignSha);
  if (diff === null) {
    return {
      ok: false,
      reason: 'foreign-invalid',
      detail: `undiffable range ${base ?? '(root)'}..${foreignSha}`,
      issues: foreign.issues,
    };
  }

  const snapshot = await deps.readSnapshot();
  const batches = synthesizeWorkspaceTreeDelta({
    prev: snapshot,
    next: foreign.state,
    changedPaths: diff.changed,
    removedPaths: diff.removed,
    deps: { nextCtx: deps.nextCtx, liveSetEntries: deps.liveSetEntries },
  });
  if (batches.length > 0) {
    await deps.apply(batches);
  }

  await releaseHealedQuarantine(rootDir, foreign.issues);
  await writeForeignQuarantine(rootDir, foreignFiles, foreign.issues, diff.changed);

  await deps.flush();

  // Un-diverged local branch ⇒ plain-git pull semantics: a true
  // fast-forward, no merge bubble (git itself would reduce the
  // redundant parent anyway). Foreign commits keep their own
  // authorship; any canonicalization residue the engine produced on
  // top commits as an ordinary follow-up (no-op when byte-identical).
  if (args.localAhead === 0) {
    const ff = await fastForwardWorkspaceBranch(run, rootDir, foreignSha);
    if (!ff.ok) return { ok: false, reason: 'commit-failed', detail: ff.detail, issues: foreign.issues };
    const residue = await commitWorkspaceTree({
      run,
      rootDir,
      message: 'Normalize pulled changes',
      identityEnv: deps.identityEnv,
      bypassHooks: deps.bypassHooks,
    });
    if (!residue.ok) return { ok: false, reason: 'commit-failed', detail: residue.detail, issues: foreign.issues };
    const sha = residue.committed ? residue.sha : foreignSha;
    return { ok: true, sha, applied: batches.length, issues: foreign.issues };
  }

  const authors = await listForeignAuthors(run, rootDir, 'HEAD', foreignSha);
  const trailerBlock = authors.length > 0 ? `\n\n${authors.map((a) => `Co-Authored-By: ${a}`).join('\n')}` : '';
  const commit = await commitWorkspaceTree({
    run,
    rootDir,
    message: `${args.mergeMessage}${trailerBlock}`,
    identityEnv: deps.identityEnv,
    bypassHooks: deps.bypassHooks,
    mergeParent: foreignSha,
  });
  if (!commit.ok) return { ok: false, reason: 'commit-failed', detail: commit.detail, issues: foreign.issues };
  if (!commit.committed)
    return { ok: false, reason: 'commit-failed', detail: 'merge commit did not land', issues: foreign.issues };

  return { ok: true, sha: commit.sha, applied: batches.length, issues: foreign.issues };
}

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

  // §16: a rewritten remote head never merges silently — the
  // trichotomy dialog resolves it. Checked before the behind-0 gate so
  // a remote rewound to an ancestor still surfaces.
  const watermark = options.lastSyncedRemoteSha;
  if (
    watermark !== undefined &&
    watermark !== upstream.sha &&
    !(await isAncestorOf(run, rootDir, watermark, upstream.sha))
  ) {
    return { ok: false, reason: 'force-push', detail: upstream.sha, issues: [] };
  }

  if (upstream.behind === 0) return { ok: true, upToDate: true, remoteSha: upstream.sha, issues: [] };

  const integrated = await integrateForeignHead(options, {
    foreignSha: upstream.sha,
    localAhead: upstream.ahead,
    mergeMessage: `Merge ${upstream.upstream}`,
  });
  if (!integrated.ok) return integrated;
  return {
    ok: true,
    upToDate: false,
    sha: integrated.sha,
    remoteSha: upstream.sha,
    applied: integrated.applied,
    issues: integrated.issues,
  };
}
