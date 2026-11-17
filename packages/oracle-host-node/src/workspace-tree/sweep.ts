/**
 * Tree-wins sweep — the rung-2 reconcile pass (the git-sync plan §3.1;
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
import type { DeletedEntityReader } from '@openheaders/core/sync-builders/mutations/restore-returns';
import type {
  EmissionBatch,
  LiveSetEntriesReader,
} from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import { synthesizeWorkspaceTreeDelta } from '@openheaders/core/sync-builders/mutations/workspace-tree-delta';
import {
  containTreeRead,
  planWorkspaceTree,
  readWorkspaceTree,
  TRUSTED_ROOTS_DOC_KEY,
  type TreeIssue,
  VAULT_DOC_KEY,
  WORKSPACE_DOC_KEY,
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_DOC_KEY,
  type WorkspaceTreeState,
} from '@openheaders/core/workspace-tree';
import type { TreeWritesWatch } from '../git';
import { TREE_HYGIENE_FILES } from './hygiene';
import { treeIssueRows } from './issue-rows';
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
  /**
   * Opens a watch of git's writes to the tree before it is read. Git
   * replaces a file by removing it and writing it anew, a piece at a
   * time, so a file that reads as removed, empty or cut short while git
   * wrote is no deletion and no edit. Absent (no git plane), nothing
   * ever writes.
   */
  watchTreeWrites?: () => Promise<TreeWritesWatch>;
  /**
   * What a reading held a while ago read (`held.reading`). A reading
   * that agrees with it is concluded whatever git holds: a lock nobody
   * gives up — a command killed, an editor left open — writes no file,
   * and a tree read the same twice is the tree.
   */
  settledReading?: string;
  /**
   * Whether the engine holds an entity deleted. A file back under such
   * a uid restores it. Absent, the engine holds nothing deleted.
   */
  isDeleted?: DeletedEntityReader;
}

export type SweepWorkspaceTreeResult =
  | {
      ok: true;
      /** Batches applied (0 = tree and engine already agreed). */
      applied: number;
      /** Externally changed / removed file counts the classification saw. */
      changed: number;
      removed: number;
      /** The reading's rows (`issue-rows.ts`): no issue at a file whose bytes are the baseline's. */
      issues: TreeIssue[];
      /**
       * Set, the pass concluded NOTHING — no batch, the baseline as it
       * stood: the tree was read while git wrote it, `files` of it
       * changed or gone. The owner reads the tree again; `reading` names
       * what was read, for a later reading to agree with
       * (`settledReading`).
       */
      held?: { files: number; reading: string };
    }
  | { ok: false; reason: 'unreadable-manifest' | 'identity-mismatch'; issues: TreeIssue[] };

const dirOf = (path: string): string => {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
};

/** The readings one pass takes in a row while each meets a git command that has ended by the time it is read. */
const MAX_READINGS = 3;

export async function sweepWorkspaceTree(options: SweepWorkspaceTreeOptions): Promise<SweepWorkspaceTreeResult> {
  for (let reading = 1; ; reading += 1) {
    const result = await sweepReading(options);
    if (!result.ok || result.held === undefined) return result;
    // The command the reading met has ended: the tree is at rest, and is
    // read again at once. A reading git still writes under — a watch
    // just opened meets it — or the last in the row goes to the owner.
    if (reading >= MAX_READINGS || (await (await options.watchTreeWrites?.())?.met()) === true) return result;
  }
}

async function sweepReading(options: SweepWorkspaceTreeOptions): Promise<SweepWorkspaceTreeResult> {
  const { rootDir, snapshot } = options;

  // A tree read while git wrote it is not a tree at rest: a file may be
  // between git's removal and its write, or written part-way — and a
  // part of a file can read as a whole one. Nothing of such a reading is
  // concluded, unless a reading before it read the same.
  const treeWrites = await options.watchTreeWrites?.();
  const heldFor = async (files: number, read: unknown): Promise<SweepWorkspaceTreeResult | null> => {
    if (files === 0 || (await treeWrites?.met()) !== true) return null;
    const reading = hashTreeContent(JSON.stringify(read));
    if (reading === options.settledReading) return null;
    return { ok: true, applied: 0, changed: 0, removed: 0, issues: [], held: { files, reading } };
  };

  // A folder or a leaf the workspace has no container for is a read
  // issue like a document that does not parse: reported, its file kept
  // and off the baseline.
  const files = await listWorkspaceTreeFiles(rootDir);
  const read = containTreeRead(readWorkspaceTree(files), snapshot);
  if (read.state.workspace === null) {
    const manifest = files.find((file) => file.path === WORKSPACE_MANIFEST_FILE);
    const held = await heldFor(1, ['manifest', manifest === undefined ? null : hashTreeContent(manifest.content)]);
    if (held !== null) return held;
    // A manifest that is gone has no tombstone to become: nothing
    // ingests its absence, and a baseline entry would have every flush
    // leave it absent. The entry is dropped, so the flush after this
    // refusal authors the manifest again.
    if (manifest === undefined) {
      const { [WORKSPACE_MANIFEST_FILE]: listed, ...rest } = await readMaterializedIndex(rootDir);
      if (listed !== undefined) await writeMaterializedIndex(rootDir, rest);
    }
    return { ok: false, reason: 'unreadable-manifest', issues: read.issues };
  }
  if (read.state.workspace.uid !== options.workspaceUid) {
    return { ok: false, reason: 'identity-mismatch', issues: read.issues };
  }

  const baseline = await readMaterializedIndex(rootDir);
  const diskHashes = new Map<string, string>();
  for (const file of files) diskHashes.set(file.path, hashTreeContent(file.content));

  // The hygiene files are kept by their own pass and never baselined
  // (`hygiene.ts`) — they are not tree input in either direction.
  const changedPaths = new Set<string>();
  for (const [path, hash] of diskHashes) {
    if (baseline[path] !== hash && !TREE_HYGIENE_FILES.has(path)) changedPaths.add(path);
  }
  const removedPaths = new Set<string>();
  for (const path of Object.keys(baseline)) {
    if (!diskHashes.has(path) && !TREE_HYGIENE_FILES.has(path)) removedPaths.add(path);
  }
  const batches = synthesizeWorkspaceTreeDelta({
    prev: snapshot,
    next: read.state,
    changedPaths,
    removedPaths,
    deps: { nextCtx: options.nextCtx, liveSetEntries: options.liveSetEntries },
    isDeleted: options.isDeleted,
  });
  // Held only where the reading has something to conclude — a batch for
  // the engine, a file gone. A file of the user's own differs from the
  // baseline at every reading and concludes nothing.
  const held =
    batches.length > 0 || removedPaths.size > 0
      ? await heldFor(changedPaths.size + removedPaths.size, [
          [...changedPaths].sort().map((path) => [path, diskHashes.get(path)]),
          [...removedPaths].sort(),
        ])
      : null;
  if (held !== null) return held;
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
  dropKeys(read.state.mqttRequests);
  dropKeys(read.state.graphqlRequests);
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
  if (read.state.trustedRoots !== null) delete merged[TRUSTED_ROOTS_DOC_KEY];
  for (const [key, rows] of Object.entries(read.unknowns)) {
    merged[key] = rows;
  }
  await writeTreeUnknownFields(rootDir, merged);

  return {
    ok: true,
    applied: batches.length,
    changed: changedPaths.size,
    removed: removedPaths.size,
    issues: treeIssueRows(read.issues, diskHashes, baseline),
  };
}
