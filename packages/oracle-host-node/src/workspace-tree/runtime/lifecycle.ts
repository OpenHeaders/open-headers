/**
 * Workspace-tree runtime — binding lifecycle: opening a binding wires
 * the materializer, the two watchers (tree quiescence + `.git/HEAD`),
 * the cadence and fetch timers, and the repo adopt/init pass; closing
 * tears every timer down and drains the chain before releasing the
 * workspace service.
 */

import type { WorkspaceTreeBindingRecord } from '@openheaders/core/storage';
import { logger } from '@openheaders/core/utils';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '@openheaders/oracle/sync/service';
import { ensureWorkspaceRepo } from '../../git';
import { GitHeadWatcher } from '../head-watcher';
import { WorkspaceTreeMaterializer } from '../materializer';
import { readTreeUnknownFields } from '../sidecar';
import { StatusCache } from '../status-cache';
import { WorkspaceTreeWatcher } from '../watcher';
import { FETCH_INTERVAL_MS, type OpenBinding, type RuntimeCtx, SCOPE } from './core';

export async function openBinding(ctx: RuntimeCtx, record: WorkspaceTreeBindingRecord): Promise<OpenBinding> {
  const service = getOrCreateWorkspaceService(record.workspaceId);
  const materializer = new WorkspaceTreeMaterializer({
    rootDir: record.rootDir,
    readSnapshot: async () => ({
      state: await ctx.buildSnapshot(record.workspaceId),
      unknowns: await readTreeUnknownFields(record.rootDir),
    }),
    log: (level, msg, ...rest) => logger[level](SCOPE, msg, ...rest),
  });
  let binding: OpenBinding;
  const watcher = new WorkspaceTreeWatcher({
    rootDir: record.rootDir,
    onQuiescence: () =>
      ctx.enqueue(binding, async () => {
        await ctx.runSweep(binding);
        await binding.materializer.flush();
        await ctx.publishGitStatus(binding);
      }),
    log: (level, msg, ...rest) => logger[level](SCOPE, msg, ...rest),
  });
  // External checkout trigger (Phase 6): a terminal `git checkout`
  // moves `.git/HEAD`, which the tree watcher deliberately ignores —
  // and a switch between identical trees moves NOTHING else. The
  // HEAD watch re-probes the branch on the chain and runs the same
  // rung-2 sweep an in-app switch runs; echoes of our own wrapped
  // checkout no-op via the pointer comparison.
  const headWatcher = new GitHeadWatcher({
    rootDir: record.rootDir,
    onHeadMove: () =>
      ctx.enqueue(binding, async () => {
        if (await ctx.syncLogBranch(binding)) {
          ctx.drainIntents(binding);
          await ctx.runSweep(binding);
          await binding.materializer.flush();
          logger.info(SCOPE, `external checkout reconciled for ${record.rootDir}: ${binding.logBranch ?? 'HEAD'}`);
        }
        await ctx.publishGitStatus(binding);
      }),
    log: (level, msg, ...rest) => logger[level](SCOPE, msg, ...rest),
  });
  binding = {
    record,
    service,
    materializer,
    watcher,
    headWatcher,
    logBranch: null,
    chain: Promise.resolve(),
    materializeTimer: null,
    commitTimer: null,
    commitInterval: null,
    fetchInterval: null,
    lastFetchAt: 0,
    holdRetryTimer: null,
    statusPublishTimer: null,
    lastStatusHash: null,
    status: new StatusCache(),
    intents: [],
    contributors: new Set(),
    issues: [],
    closed: false,
  };
  ctx.open.set(record.workspaceId, binding);
  watcher.start();
  ctx.applyCadenceTimers(binding);
  // Background fetch (§3.2): ~5m interval + one pass at open so the
  // ahead/behind affordance lights without waiting a cycle.
  binding.fetchInterval = setInterval(() => {
    ctx.enqueueFetch(binding, 'interval');
  }, FETCH_INTERVAL_MS);
  ctx.enqueueFetch(binding, 'open');
  // Phase 3: a bound folder is a REPO. Adopt an existing `.git` or
  // init a fresh one; missing git disables only the git plane (§7).
  ctx.enqueue(binding, async () => {
    const availability = await ctx.ensureGitAvailability(record.rootDir);
    if (!availability.available) {
      logger.warn(SCOPE, `git plane disabled for ${record.rootDir}: ${availability.reason}`);
      return;
    }
    const repo = await ensureWorkspaceRepo(ctx.gitRun, record.rootDir);
    if (!repo.ok) logger.warn(SCOPE, `repo init failed for ${record.rootDir}: ${repo.detail}`);
    else if (repo.initialized) logger.info(SCOPE, `initialized repo at ${record.rootDir}`);
    if (repo.ok) {
      // §6.3: point the per-branch log at HEAD's branch before any
      // batch lands, and arm the external-checkout trigger.
      await ctx.syncLogBranch(binding);
      binding.headWatcher.start();
    }
    await ctx.publishGitStatus(binding);
  });
  return binding;
}

export async function closeBinding(ctx: RuntimeCtx, binding: OpenBinding): Promise<void> {
  binding.closed = true;
  binding.watcher.dispose();
  binding.headWatcher.dispose();
  if (binding.materializeTimer) {
    clearTimeout(binding.materializeTimer);
    binding.materializeTimer = null;
  }
  if (binding.commitTimer) {
    clearTimeout(binding.commitTimer);
    binding.commitTimer = null;
  }
  if (binding.commitInterval) {
    clearInterval(binding.commitInterval);
    binding.commitInterval = null;
  }
  if (binding.fetchInterval) {
    clearInterval(binding.fetchInterval);
    binding.fetchInterval = null;
  }
  if (binding.holdRetryTimer) {
    clearTimeout(binding.holdRetryTimer);
    binding.holdRetryTimer = null;
  }
  if (binding.statusPublishTimer) {
    clearTimeout(binding.statusPublishTimer);
    binding.statusPublishTimer = null;
  }
  binding.materializer.dispose();
  await binding.chain;
  ctx.open.delete(binding.record.workspaceId);
  releaseWorkspaceService(binding.record.workspaceId);
}
