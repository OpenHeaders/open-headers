/**
 * Bind / unbind — attach one workspace to one on-disk tree
 * (GIT_PLAN.md §3.5 exclusivity + identity; §10 Phase 2).
 *
 * Bind establishes three facts, refusing loudly when any fails:
 *   - identity: `workspace.yaml` carries the workspace uid (written on
 *     init; verified on rebind — a tree belonging to a different
 *     workspace is refused, and a tree whose uuid already exists on
 *     this host via another source is the §3.5 clone-collision);
 *   - exclusivity: the `.oh/lock` file — one tree, one engine
 *     instance; a second host on the same clone is refused with the
 *     holder's identity so the error can explain itself;
 *   - hygiene: `.gitignore` (`.oh/` + `*.secret.yaml`) is authored
 *     when absent so a later `git init` can never commit secrets.
 *
 * Unbind releases the lock and keeps everything else — the tree
 * remains a valid workspace folder (`.oh/` is disposable, §23.9).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { parseWorkspace } from '@openheaders/core/codec/yaml';
import type { Workspace } from '@openheaders/core/types';
import {
  GITIGNORE_FILE,
  serializeWorkspaceManifest,
  WORKSPACE_GITIGNORE_CONTENT,
  WORKSPACE_MANIFEST_FILE,
} from '@openheaders/core/workspace-tree';
import { acquireTreeLock, releaseTreeLock, type TreeLockHolder } from './sidecar';

export interface BindWorkspaceTreeOptions {
  /** Absolute path of the folder to bind. Created when missing. */
  rootDir: string;
  /** The workspace being bound — its uid is the tree identity. */
  workspace: Workspace;
  /**
   * Uids of every workspace already present on this host via any other
   * source (local store, consumed backend). A tree whose manifest names
   * one of these (and not `workspace.uid` itself) is the §3.5
   * clone-collision — the workspace is "already here via <source>".
   */
  knownWorkspaceUids?: readonly string[];
  /** Stable identity of this engine instance for the lockfile. */
  hostId: string;
}

export type BindWorkspaceTreeResult =
  | { ok: true /** true when bind authored a fresh `workspace.yaml` (empty-folder init). */; initialized: boolean }
  | { ok: false; reason: 'locked'; holder: TreeLockHolder }
  | { ok: false; reason: 'uuid-collision'; treeWorkspaceUid: string }
  | { ok: false; reason: 'identity-mismatch'; treeWorkspaceUid: string }
  | { ok: false; reason: 'invalid-manifest'; message: string };

/** Identity probe — what workspace (if any) does this folder claim to be? */
export async function probeWorkspaceTree(
  rootDir: string,
): Promise<
  { present: false } | { present: true; workspaceUid: string; name: string } | { present: true; error: string }
> {
  const manifestPath = path.join(rootDir, WORKSPACE_MANIFEST_FILE);
  let yaml: string;
  try {
    yaml = await fs.readFile(manifestPath, 'utf-8');
  } catch {
    return { present: false };
  }
  try {
    const parsed = parseWorkspace(yaml);
    return { present: true, workspaceUid: parsed.value.uid, name: parsed.value.name };
  } catch (err) {
    return { present: true, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function bindWorkspaceTree(options: BindWorkspaceTreeOptions): Promise<BindWorkspaceTreeResult> {
  const { rootDir, workspace, hostId } = options;
  await fs.mkdir(rootDir, { recursive: true });

  const probe = await probeWorkspaceTree(rootDir);
  if (probe.present && 'error' in probe) {
    return { ok: false, reason: 'invalid-manifest', message: probe.error };
  }
  if (probe.present && probe.workspaceUid !== workspace.uid) {
    const known = options.knownWorkspaceUids ?? [];
    return known.includes(probe.workspaceUid)
      ? { ok: false, reason: 'uuid-collision', treeWorkspaceUid: probe.workspaceUid }
      : { ok: false, reason: 'identity-mismatch', treeWorkspaceUid: probe.workspaceUid };
  }

  const lock = await acquireTreeLock(rootDir, hostId);
  if (!lock.ok) return { ok: false, reason: 'locked', holder: lock.holder };

  let initialized = false;
  if (!probe.present) {
    await fs.writeFile(path.join(rootDir, WORKSPACE_MANIFEST_FILE), serializeWorkspaceManifest(workspace), 'utf-8');
    initialized = true;
  }
  const gitignorePath = path.join(rootDir, GITIGNORE_FILE);
  try {
    await fs.writeFile(gitignorePath, WORKSPACE_GITIGNORE_CONTENT, { encoding: 'utf-8', flag: 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
  }

  return { ok: true, initialized };
}

/** Release this engine's hold on the tree; the folder stays a valid workspace tree. */
export async function unbindWorkspaceTree(rootDir: string, hostId: string): Promise<void> {
  await releaseTreeLock(rootDir, hostId);
}
