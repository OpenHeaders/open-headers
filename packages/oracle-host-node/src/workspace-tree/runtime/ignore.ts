/**
 * Workspace-tree runtime — the Commit window's ignore verbs: append a
 * validated tree path's anchored entry to the repo-root `.gitignore`
 * (shared) or to `.git/info/exclude` (local-only). Runs on the
 * per-binding chain like every write — the entry lands in the working
 * tree the sweep/status planes read — and the verb wiring publishes a
 * status frame after, so the window refetches and the row moves out of
 * Unversioned Files on its own.
 */

import { logger } from '@openheaders/core/utils';
import { addIgnoreEntry, type IgnoreTarget, isWorkspaceRepo } from '../../git';
import { type OpenBinding, type RuntimeCtx, SCOPE } from './core';
import type { WorkspaceTreeIgnoreRpcResult } from './types';

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
