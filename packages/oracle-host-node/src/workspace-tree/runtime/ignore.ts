/**
 * Workspace-tree runtime — the Commit window's ignore verbs: append a
 * validated tree path's anchored entry to the repo-root `.gitignore`
 * (shared) or to `.git/info/exclude` (local-only), and the inverse
 * Stop Ignoring pass that deletes exactly that entry (never a glob —
 * the surface gates on the provenance's `removable`). Both run on the
 * per-binding chain like every write — the entry lands in the working
 * tree the sweep/status planes read — and the verb wiring publishes a
 * status frame after, so the window refetches and the row moves
 * between groups on its own.
 */

import { logger } from '@openheaders/core/utils';
import { addIgnoreEntry, type IgnoreTarget, isWorkspaceRepo, removeIgnoreEntry } from '../../git';
import { type OpenBinding, type RuntimeCtx, SCOPE } from './core';
import type { WorkspaceTreeIgnoreRpcResult, WorkspaceTreeUnignoreRpcResult } from './types';

/** One ignore-entry pass — availability/repo guards, then the append. */
export async function runIgnorePath(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  filePath: string,
  target: IgnoreTarget,
): Promise<WorkspaceTreeIgnoreRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const result = await addIgnoreEntry(rootDir, filePath, target);
  if (!result.ok) return { ok: false, reason: 'ignore-failed', detail: result.detail };
  if (result.added) logger.info(SCOPE, `ignore entry ${result.entry} → ${target} for ${rootDir}`);
  return { ok: true, added: result.added };
}

/** One Stop Ignoring pass — deletes the path's exact entry from the target file. */
export async function runUnignorePath(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  filePath: string,
  target: IgnoreTarget,
): Promise<WorkspaceTreeUnignoreRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const result = await removeIgnoreEntry(rootDir, filePath, target);
  if (!result.ok) return { ok: false, reason: 'ignore-failed', detail: result.detail };
  if (result.removed) logger.info(SCOPE, `ignore entry /${filePath} removed from ${target} for ${rootDir}`);
  return { ok: true, removed: result.removed };
}
