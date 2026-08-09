/**
 * Workspace-tree runtime — the §9 status authority: one compute of the
 * git-slot frame, cached until movement invalidates it, published to
 * the host sink on a trailing debounce deduplicated by frame hash
 * (the extension rule-update discipline: a bind/sweep/flush burst
 * emits at most one frame, identical recomputes stay silent).
 */

import { logger } from '@openheaders/core/utils';
import {
  composeCommitMessage,
  countDirtyFiles,
  currentBranch,
  isWorkspaceRepo,
  listLocalBranches,
  resolveUpstream,
  userIndexHasStagedChanges,
} from '../../git';
import { type OpenBinding, type RuntimeCtx, SCOPE, STATUS_PUBLISH_DEBOUNCE_MS } from './core';
import type { WorkspaceTreeGitStatusRpcResult } from './types';
import { detectForcePush } from './watermark';

export function notBoundStatus(): WorkspaceTreeGitStatusRpcResult {
  return {
    bound: false,
    git: { available: false, reason: 'missing' },
    repo: false,
    branch: null,
    branches: [],
    dirtyFiles: null,
    userIndexBusy: false,
    suggestedMessage: '',
    cadence: 'off',
    bypassHooks: false,
    upstream: null,
    ahead: null,
    behind: null,
    autoPushOnCommit: false,
    forcePush: null,
  };
}

async function computeGitStatus(ctx: RuntimeCtx, binding: OpenBinding): Promise<WorkspaceTreeGitStatusRpcResult> {
  const { rootDir } = binding.record;
  const cadence = binding.record.commitCadence ?? 'off';
  const bypassHooks = binding.record.bypassHooks === true;
  const autoPushOnCommit = binding.record.autoPushOnCommit === true;
  const git = await ctx.ensureGitAvailability(rootDir);
  if (!git.available) {
    return {
      bound: true,
      git,
      repo: false,
      branch: null,
      branches: [],
      dirtyFiles: null,
      userIndexBusy: false,
      suggestedMessage: composeCommitMessage(binding.intents),
      cadence,
      bypassHooks,
      upstream: null,
      ahead: null,
      behind: null,
      autoPushOnCommit,
      forcePush: null,
    };
  }
  const repo = await isWorkspaceRepo(ctx.gitRun, rootDir);
  const branch = repo ? await currentBranch(ctx.gitRun, rootDir) : null;
  const upstream = repo ? await resolveUpstream(ctx.gitRun, rootDir) : null;
  return {
    bound: true,
    git,
    repo,
    branch,
    branches: repo ? await listLocalBranches(ctx.gitRun, rootDir) : [],
    dirtyFiles: repo ? await countDirtyFiles(ctx.gitRun, rootDir) : null,
    userIndexBusy: repo ? await userIndexHasStagedChanges(ctx.gitRun, rootDir) : false,
    suggestedMessage: composeCommitMessage(binding.intents),
    cadence,
    bypassHooks,
    upstream: upstream?.upstream ?? null,
    ahead: upstream?.ahead ?? null,
    behind: upstream?.behind ?? null,
    autoPushOnCommit,
    forcePush: repo ? await detectForcePush(ctx, binding, branch, upstream) : null,
  };
}

/**
 * The one status READ path (§9): the cached frame when the world
 * hasn't moved since the last compute, else one shared recompute.
 * Every consumer — the `gitStatus` RPC, the refs rail's `current`,
 * the debounced sink below — reads through here, so a burst of
 * surfaces mounting costs at most one porcelain spawn cluster.
 */
export function readGitStatus(ctx: RuntimeCtx, binding: OpenBinding): Promise<WorkspaceTreeGitStatusRpcResult> {
  return binding.status.read(() => computeGitStatus(ctx, binding));
}

/**
 * Live git-slot feed (§9) — called after every pass that can move
 * `git status` and on setting changes; the ONE invalidation point of
 * the status authority. Invalidates the snapshot immediately (so any
 * reader from here on recomputes against the post-movement world),
 * then hands the sink a frame on the trailing debounce, deduplicated
 * by frame hash.
 */
export async function publishGitStatus(ctx: RuntimeCtx, binding: OpenBinding): Promise<void> {
  binding.status.invalidate();
  const sink = ctx.options.onGitStatus;
  if (!sink || binding.closed) return;
  if (binding.statusPublishTimer) clearTimeout(binding.statusPublishTimer);
  binding.statusPublishTimer = setTimeout(() => {
    binding.statusPublishTimer = null;
    void (async () => {
      if (binding.closed) return;
      try {
        const status = await readGitStatus(ctx, binding);
        const hash = JSON.stringify(status);
        if (hash === binding.lastStatusHash) return;
        binding.lastStatusHash = hash;
        sink(binding.record.workspaceId, status);
      } catch (err) {
        logger.warn(SCOPE, `git status publish failed for ${binding.record.rootDir}`, err);
      }
    })();
  }, STATUS_PUBLISH_DEBOUNCE_MS);
}
