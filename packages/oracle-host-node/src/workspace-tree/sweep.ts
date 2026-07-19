/**
 * Tree-wins sweep — the rung-2 reconcile pass (GIT_PLAN.md §3.1;
 * S3 §11.2 ratification: MANDATORY on every bind-open, and the same
 * pass the filesystem watcher schedules for live external edits).
 *
 * Three-way classification against the hashed `.oh/` baseline:
 *
 *   disk == baseline          → engine-owned bytes (at worst a stale
 *                               materialization) — never ingested;
 *   disk != baseline / new    → external change; the owning document
 *                               is tree-authored and wins via
 *                               fresh-HLC virtual batches;
 *   baseline, no disk file    → external deletion; tombstones (only
 *                               files the materializer wrote are
 *                               deletable from the tree side).
 *
 * After synthesizing + applying the delta, the sweep RE-BASELINES the
 * ingested paths (baseline := current disk hash): the external input
 * is now "seen", so the next materialize pass may normalize the
 * hand-edited formatting to canonical bytes (S2 decision) instead of
 * treating the file as still-pending rung-2 input. Documents that
 * failed to parse are exempt — their read issues are the quarantine
 * seam (§13.3): the whole entity directory stays guarded and
 * untouched until a later phase (or the user) resolves it.
 *
 * Unknown-field rows captured by the read replace the sidecar rows for
 * every document present in the tree; rows for engine-only entities
 * (not yet materialized) are retained. This is the S4 half of the S3
 * unknown-rows loop — the next plan feeds them back into their files.
 *
 * Pure orchestration over injected seams (snapshot, apply) — callers
 * serialize sweeps against materializer passes (§8 single actor).
 */

import type { MutatorContext } from '@openheaders/core/sync';
import type {
  EmissionBatch,
  LiveSetEntriesReader,
} from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import { synthesizeWorkspaceTreeDelta } from '@openheaders/core/sync-builders/mutations/workspace-tree-delta';
import {
  planWorkspaceTree,
  readWorkspaceTree,
  type TreeIssue,
  VAULT_DOC_KEY,
  WORKSPACE_DOC_KEY,
  WORKSPACE_VARS_DOC_KEY,
  type WorkspaceTreeState,
} from '@openheaders/core/workspace-tree';
import { listWorkspaceTreeFiles } from './reader';
import {
  hashTreeContent,
  type MaterializedIndex,
  readMaterializedIndex,
  readTreeUnknownFields,
  writeMaterializedIndex,
  writeTreeUnknownFields,
} from './sidecar';

export interface SweepWorkspaceTreeOptions {
  rootDir: string;
  /** The bound workspace's identity — a tree claiming another uid is refused. */
  workspaceUid: string;
  /** The engine's current snapshot (the sweep's `prev` side). */
  snapshot: WorkspaceTreeState;
  nextCtx: () => MutatorContext;
  liveSetEntries: LiveSetEntriesReader;
  /** Apply the synthesized batches through the workspace's resident service. */
  apply: (batches: EmissionBatch[]) => Promise<void>;
}

export type SweepWorkspaceTreeResult =
  | {
      ok: true;
      /** Batches applied (0 = tree and engine already agreed). */
      applied: number;
      /** Externally changed / removed file counts the classification saw. */
      changed: number;
      removed: number;
      issues: TreeIssue[];
    }
  | { ok: false; reason: 'unreadable-manifest' | 'identity-mismatch'; issues: TreeIssue[] };

const dirOf = (path: string): string => {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
};

export async function sweepWorkspaceTree(options: SweepWorkspaceTreeOptions): Promise<SweepWorkspaceTreeResult> {
  const { rootDir, snapshot } = options;

  const files = await listWorkspaceTreeFiles(rootDir);
  const read = readWorkspaceTree(files);
  if (read.state.workspace === null) {
    return { ok: false, reason: 'unreadable-manifest', issues: read.issues };
  }
  if (read.state.workspace.uid !== options.workspaceUid) {
    return { ok: false, reason: 'identity-mismatch', issues: read.issues };
  }

  const baseline = await readMaterializedIndex(rootDir);
  const diskHashes = new Map<string, string>();
  for (const file of files) diskHashes.set(file.path, hashTreeContent(file.content));

  const changedPaths = new Set<string>();
  for (const [path, hash] of diskHashes) {
    if (baseline[path] !== hash) changedPaths.add(path);
  }
  const removedPaths = new Set<string>();
  for (const path of Object.keys(baseline)) {
    if (!diskHashes.has(path)) removedPaths.add(path);
  }

  const batches = synthesizeWorkspaceTreeDelta({
    prev: snapshot,
    next: read.state,
    changedPaths,
    removedPaths,
    deps: { nextCtx: options.nextCtx, liveSetEntries: options.liveSetEntries },
  });
  if (batches.length > 0) {
    await options.apply(batches);
  }

  // Re-baseline the ingested input so the next materialize may
  // normalize it — except quarantined documents (read issues): their
  // whole directory stays off-baseline and thus write-guarded. Only
  // paths the PLANNER owns for the post-sweep state may enter the
  // baseline: the baseline is "bytes the materializer wrote", and its
  // delete pass sweeps stale baseline paths — adopting a file the read
  // ignored (README, a user's own notes, a staged scratch file) would
  // hand the user's bytes to that delete pass on the next flush.
  const plannedPaths = new Set(
    planWorkspaceTree({ ...read.state, workspace: read.state.workspace }, read.unknowns).map((file) => file.path),
  );
  const issueDirs = new Set(read.issues.map((issue) => dirOf(issue.path)));
  const issuePaths = new Set(read.issues.map((issue) => issue.path));
  const nextBaseline: MaterializedIndex = { ...baseline };
  for (const path of removedPaths) delete nextBaseline[path];
  for (const path of changedPaths) {
    if (!plannedPaths.has(path)) continue;
    if (issuePaths.has(path) || issueDirs.has(dirOf(path))) continue;
    const hash = diskHashes.get(path);
    if (hash !== undefined) nextBaseline[path] = hash;
  }
  await writeMaterializedIndex(rootDir, nextBaseline);

  // Unknown-rows loop: rows read from the tree replace the sidecar's
  // rows for every document the tree holds; engine-only documents keep
  // their stored rows for the next materialize to re-attach.
  const stored = await readTreeUnknownFields(rootDir);
  const merged = { ...stored };
  const dropKeys = (items: readonly { uid: string }[]): void => {
    for (const item of items) delete merged[item.uid];
  };
  dropKeys(read.state.rules);
  dropKeys(read.state.requests);
  dropKeys(read.state.grpcRequests);
  dropKeys(read.state.websocketRequests);
  dropKeys(read.state.templates);
  dropKeys(read.state.specs);
  dropKeys(read.state.liveWorkflows);
  dropKeys(read.state.liveVariables);
  dropKeys(read.state.environments);
  dropKeys(read.state.collections);
  dropKeys(read.state.requestCollections);
  dropKeys(read.state.templateCollections);
  dropKeys(read.state.folders);
  dropKeys(read.state.requestFolders);
  dropKeys(read.state.templateFolders);
  delete merged[WORKSPACE_DOC_KEY];
  if (read.state.workspaceVariables !== null) delete merged[WORKSPACE_VARS_DOC_KEY];
  if (read.state.vault !== null) delete merged[VAULT_DOC_KEY];
  for (const [key, rows] of Object.entries(read.unknowns)) {
    merged[key] = rows;
  }
  await writeTreeUnknownFields(rootDir, merged);

  return {
    ok: true,
    applied: batches.length,
    changed: changedPaths.size,
    removed: removedPaths.size,
    issues: read.issues,
  };
}
