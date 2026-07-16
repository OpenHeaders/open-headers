/**
 * Preview RPC — the read-only diff + missing-deps + snapshot-hash pass
 * the import-preview modal renders before the user submits.
 */

import type { MissingDep } from '@openheaders/core/import';
import {
  applyBackupRestoreToggle,
  diffWorkspaceExport,
  type TargetWorkspaceState,
  type WorkspaceExport,
  walkMissingDeps,
} from '@openheaders/core/workspace-export';
import { getActiveWorkspaceId, getWorkspace } from '@openheaders/oracle/workspace/extension-workspace-store';
import { readTargetWorkspaceState } from './target';
import type { ImportTargetSelector } from './types';

export interface PreviewWorkspaceImportArgs {
  incoming: WorkspaceExport;
  /** target=new returns an empty target — every entity is "new". */
  target: ImportTargetSelector;
  /** Backup-restore toggle preview state. */
  backupRestore?: boolean;
}

export interface PreviewWorkspaceImportResult {
  diff: ReturnType<typeof diffWorkspaceExport>;
  missingDeps: MissingDep[];
  /** Stable hash of the diff structure — renderer compares preview-time
   *  vs submit-time diffs to detect concurrent edits during preview. */
  snapshotHash: string;
  /** Resolved target descriptor (for target=new this is null — modal
   *  uses incoming.workspace metadata directly). */
  targetWorkspaceId: string | null;
}

/**
 * Preview-time analog of `importWorkspace`. Reads (no writes) the chosen
 * target workspace and runs `diffWorkspaceExport` + `walkMissingDeps` so
 * the preview modal can render collision badges, the missing-deps
 * section, and a fresh snapshot hash for concurrent-edit detection.
 *
 * No lock — preview is an estimate. The submit path runs a fresh diff
 * inside the workspace-import lock and is the authoritative state.
 */
export async function previewWorkspaceImport(args: PreviewWorkspaceImportArgs): Promise<PreviewWorkspaceImportResult> {
  let targetState: TargetWorkspaceState;
  let targetWorkspaceId: string | null;
  if (args.target.mode === 'new') {
    targetWorkspaceId = null;
    targetState = emptyTargetState();
  } else {
    const wsId = args.target.mode === 'current' ? getActiveWorkspaceId() : args.target.workspaceId;
    if (args.target.mode === 'picked' && !getWorkspace(args.target.workspaceId)) {
      throw new Error(`Picked workspace ${args.target.workspaceId} not found`);
    }
    targetWorkspaceId = wsId;
    const read = await readTargetWorkspaceState(wsId);
    targetState = read.targetState;
  }

  let diff = diffWorkspaceExport(args.incoming, targetState);
  if (args.backupRestore) diff = applyBackupRestoreToggle(diff);
  const missingDeps = walkMissingDeps(args.incoming, targetState);
  const snapshotHash = await hashDiffSnapshot(diff);
  return { diff, missingDeps, snapshotHash, targetWorkspaceId };
}

function emptyTargetState(): TargetWorkspaceState {
  return {
    collections: [],
    folders: [],
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    liveWorkflows: [],
    liveVariables: [],
    specs: [],
  };
}

/**
 * Stable hash of the diff's identity-bearing fields (uids + collision
 * states). Used by the renderer to detect that the target workspace's
 * state changed between preview and submit. Not a security primitive —
 * just a change-detection signal.
 */
async function hashDiffSnapshot(diff: ReturnType<typeof diffWorkspaceExport>): Promise<string> {
  const stable = {
    collections: diff.collections.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    folders: diff.folders.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    rules: diff.rules.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    requests: diff.requests.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    templates: diff.templates.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    environments: diff.environments.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    liveWorkflows: diff.liveWorkflows.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    liveVariables: diff.liveVariables.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    specs: diff.specs.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    workspaceVars: [diff.workspaceVars.state, diff.workspaceVars.targetHasContent],
    vault: [diff.vault.state, diff.vault.targetHasContent],
  };
  const bytes = new TextEncoder().encode(JSON.stringify(stable));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
