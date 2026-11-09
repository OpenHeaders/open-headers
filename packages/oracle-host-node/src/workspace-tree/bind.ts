/**
 * Bind / unbind — attach one workspace to one on-disk tree
 * (the git-sync plan §3.5 exclusivity + identity; §10 Phase 2).
 *
 * Bind establishes three facts, refusing loudly when any fails:
 *   - identity: `workspace.yaml` carries the workspace uid (written on
 *     init; verified on rebind — a tree belonging to a different
 *     workspace is refused, and a tree whose uuid already exists on
 *     this host via another source is the §3.5 clone-collision);
 *   - exclusivity: the `.oh/lock` file — one tree, one engine
 *     instance; a second host on the same clone is refused with the
 *     holder's identity so the error can explain itself;
 *   - hygiene: `.gitignore` (`.oh/` + `*.secret.yaml`) and
 *     `.gitattributes` (`*.yaml text eol=lf`, §3.4) are authored when
 *     absent, and a `.gitignore` the folder already holds gets the
 *     entries it lacks appended (`hygiene.ts`), so a later `git init`
 *     can never commit secrets or let autocrlf break byte-determinism.
 *
 * Adopt (§3.5 / §5, the S25 gap K) is the pre-flight for opening a
 * foreign tree — a teammate's clone — as a NEW local workspace: the
 * manifest's identity is read, a uid this host already holds refuses
 * (the clone-collision), and the tree lock is taken BEFORE the caller
 * mints the workspace record, so a refused lock never orphans a
 * workspace. The caller then binds through the ordinary ritual (the
 * lock is re-entrant for the same engine).
 *
 * Unbind releases the lock and keeps everything else — the tree
 * remains a valid workspace folder (`.oh/` is disposable, §23.9).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { parseWorkspace } from '@openheaders/core/codec/yaml';
import type { Workspace } from '@openheaders/core/types';
import { serializeWorkspaceManifest, WORKSPACE_MANIFEST_FILE } from '@openheaders/core/workspace-tree';
import { ensureTreeHygiene } from './hygiene';
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
  | { ok: false; reason: 'identity-mismatch'; treeWorkspaceUid: string; treeWorkspaceName: string }
  | { ok: false; reason: 'invalid-manifest'; message: string };

/** The manifest identity a probe answers — what adopt mints a workspace from. */
export interface WorkspaceTreeIdentity {
  workspaceUid: string;
  name: string;
  description?: string;
}

export type ProbeWorkspaceTreeResult =
  | { present: false }
  | ({ present: true } & WorkspaceTreeIdentity)
  | { present: true; error: string };

/** Identity probe — what workspace (if any) does this folder claim to be? */
export async function probeWorkspaceTree(rootDir: string): Promise<ProbeWorkspaceTreeResult> {
  const manifestPath = path.join(rootDir, WORKSPACE_MANIFEST_FILE);
  let yaml: string;
  try {
    yaml = await fs.readFile(manifestPath, 'utf-8');
  } catch {
    return { present: false };
  }
  try {
    const { value } = parseWorkspace(yaml);
    return {
      present: true,
      workspaceUid: value.uid,
      name: value.name,
      ...(value.description !== undefined ? { description: value.description } : {}),
    };
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
      : { ok: false, reason: 'identity-mismatch', treeWorkspaceUid: probe.workspaceUid, treeWorkspaceName: probe.name };
  }

  const lock = await acquireTreeLock(rootDir, hostId);
  if (!lock.ok) return { ok: false, reason: 'locked', holder: lock.holder };

  let initialized = false;
  if (!probe.present) {
    await fs.writeFile(path.join(rootDir, WORKSPACE_MANIFEST_FILE), serializeWorkspaceManifest(workspace), 'utf-8');
    initialized = true;
  }
  await ensureTreeHygiene(rootDir);

  return { ok: true, initialized };
}

export interface ReserveWorkspaceTreeForAdoptOptions {
  /** Absolute path of the existing tree (a clone) to open as a new workspace. */
  rootDir: string;
  /** Uids of every workspace already on this host via any source — the manifest naming one is the §3.5 clone-collision. */
  knownWorkspaceUids: readonly string[];
  /** Stable identity of this engine instance for the lockfile. */
  hostId: string;
}

export type ReserveWorkspaceTreeForAdoptResult =
  | { ok: true; identity: WorkspaceTreeIdentity }
  | { ok: false; reason: 'not-a-workspace' }
  | { ok: false; reason: 'invalid-manifest'; message: string }
  | { ok: false; reason: 'uuid-collision'; treeWorkspaceUid: string }
  | { ok: false; reason: 'locked'; holder: TreeLockHolder };

/**
 * Adopt pre-flight: read the tree's identity, refuse a uid this host
 * already holds, and take the tree lock so the caller can mint the
 * workspace record without racing another engine. On success the
 * caller binds the minted workspace through {@link bindWorkspaceTree}
 * (same engine — the lock re-enters); on a failed mint it releases the
 * reservation with {@link unbindWorkspaceTree}.
 */
export async function reserveWorkspaceTreeForAdopt(
  options: ReserveWorkspaceTreeForAdoptOptions,
): Promise<ReserveWorkspaceTreeForAdoptResult> {
  const probe = await probeWorkspaceTree(options.rootDir);
  if (!probe.present) return { ok: false, reason: 'not-a-workspace' };
  if ('error' in probe) return { ok: false, reason: 'invalid-manifest', message: probe.error };
  if (options.knownWorkspaceUids.includes(probe.workspaceUid)) {
    return { ok: false, reason: 'uuid-collision', treeWorkspaceUid: probe.workspaceUid };
  }
  const lock = await acquireTreeLock(options.rootDir, options.hostId);
  if (!lock.ok) return { ok: false, reason: 'locked', holder: lock.holder };
  return {
    ok: true,
    identity: {
      workspaceUid: probe.workspaceUid,
      name: probe.name,
      ...(probe.description !== undefined ? { description: probe.description } : {}),
    },
  };
}

/** Release this engine's hold on the tree; the folder stays a valid workspace tree. */
export async function unbindWorkspaceTree(rootDir: string, hostId: string): Promise<void> {
  await releaseTreeLock(rootDir, hostId);
}
