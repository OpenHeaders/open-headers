/**
 * Workspace-tree runtime — the §16 sync watermark: per-branch
 * last-integrated remote shas on the binding record, and the
 * force-push detector that compares the watermark's ancestry against
 * the fetched remote head.
 */

import { currentBranch, isAncestorOf, type UpstreamState } from '../../git';
import type { OpenBinding, RuntimeCtx } from './core';

/** The current branch's §16 watermark; undefined before the first sync on that branch. */
export function watermarkFor(binding: OpenBinding, branch: string | null): string | undefined {
  return branch === null ? undefined : binding.record.syncedRemoteShas?.[branch];
}

/** Record a successful sync (pull/push/resolution) as the current branch's watermark. */
export async function recordWatermark(ctx: RuntimeCtx, binding: OpenBinding, sha: string): Promise<void> {
  const branch = await currentBranch(ctx.gitRun, binding.record.rootDir);
  if (branch === null) return;
  await ctx.updateBindingRecord(binding.record.workspaceId, {
    syncedRemoteShas: { ...binding.record.syncedRemoteShas, [branch]: sha },
  });
}

/**
 * §16 detection: the current branch's last-integrated remote sha
 * must remain an ancestor of the (fetched) remote head — anything
 * else means the remote history was rewritten since this engine last
 * synced. Null before the first sync on this branch (no watermark)
 * and while at rest.
 */
export async function detectForcePush(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  branch: string | null,
  upstream: UpstreamState | null,
): Promise<{ remoteSha: string; lastSyncedSha: string } | null> {
  const lastSyncedSha = watermarkFor(binding, branch);
  if (lastSyncedSha === undefined || upstream === null || upstream.sha === lastSyncedSha) return null;
  if (await isAncestorOf(ctx.gitRun, binding.record.rootDir, lastSyncedSha, upstream.sha)) return null;
  return { remoteSha: upstream.sha, lastSyncedSha };
}
