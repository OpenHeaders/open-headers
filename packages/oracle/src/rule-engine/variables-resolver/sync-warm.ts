// ── Sync-warm refresh hook ─────────────────────────────────────────
//
// Per plan §E / locked decision #6: most LVs are async-warm (rule
// compile uses cached value even if stale and enqueues a refresh in
// the background). An LV with `requireFreshOnRuleBuild: true` opts
// into sync-warm — the DNR compile path blocks on a refresh of the
// backing workflow before it resolves templates, falling back to the
// stale value if the refresh takes longer than `SYNC_WARM_TIMEOUT_MS`.
//
// Opt-in is per-LV because most workflows absorb a stale value fine
// (the scheduler catches up within one cadence tick), but a rule that
// must carry a just-rotated staging token on every fire can't; the
// yellow-pill risk of stale DNR is worse than the second of compile
// latency.
//
// Timeout chosen to match the plan's 5-second budget (§E edge-case
// table). On hit, a `warn` observability entry lets triage see "we
// blocked for the full 5 seconds and served stale" after the fact.

import { isLiveVariableEffective } from '@openheaders/core/live';
import { logger } from '@openheaders/core/utils';
import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import type { WorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';
import { getLiveVariables } from '@openheaders/oracle/live/live-variable-store';
import { getOracleHostHooks, peekActiveWorkspaceId } from '@openheaders/oracle/sync';
import { getOrCreateState, type ResolverState } from './state';

export const SYNC_WARM_TIMEOUT_MS = 5_000;

interface SyncWarmTarget {
  workflowUid: string;
  environmentId: string | null;
}

/**
 * Drive a single workflow refresh to completion for the sync-warm
 * path. Injected by `live-refresh-scheduler` at SW boot; `null` when
 * no scheduler is attached (unit tests that exercise pieces of this
 * module without the scheduler chain stay self-contained).
 */
export type SyncWarmRunner = (workspaceId: string, workflowUid: string, environmentId: string | null) => Promise<void>;

let syncWarmRunner: SyncWarmRunner | null = null;

/**
 * Register the live scheduler's synchronous refresh entry point.
 * Called once from the scheduler module at SW boot so this module
 * doesn't need a direct import chain to `live-refresh-scheduler` —
 * keeping the dependency one-way (scheduler → resolver) and the
 * DNR compile path's imports lightweight for tests.
 */
export function __setSyncWarmRunner(runner: SyncWarmRunner | null): void {
  syncWarmRunner = runner;
}

/**
 * Pick the workflows that need sync-warm refresh RIGHT NOW — enabled
 * LVs with `requireFreshOnRuleBuild: true` whose cache row for the
 * active env is absent OR past its `expiresAt`. Returns unique
 * workflow targets so two LVs pointing at the same workflow drive
 * one refresh, not two.
 */
function collectSyncWarmTargets(state: ResolverState, activeEnv: string | null, now: number): SyncWarmTarget[] {
  const lvs = getLiveVariables().filter((v) => isLiveVariableEffective(v) && v.requireFreshOnRuleBuild === true);
  if (lvs.length === 0) return [];

  const runByWorkflow = new Map<string, WorkflowRunCache>();
  for (const run of state.cachedLiveRuns) {
    if (run.environmentId === activeEnv) runByWorkflow.set(run.workflowUid, run);
  }

  const targets = new Map<string, SyncWarmTarget>();
  for (const lv of lvs) {
    if (lv.manualOverride) {
      const expired = lv.manualOverride.until != null && lv.manualOverride.until <= now;
      if (!expired) continue; // override serves a fixed value — no warm needed
    }
    const run = runByWorkflow.get(lv.workflowUid);
    const stale = !run || (run.expiresAt != null && run.expiresAt <= now) || run.extractedAt === 0;
    if (!stale) continue;
    targets.set(lv.workflowUid, { workflowUid: lv.workflowUid, environmentId: activeEnv });
  }
  return [...targets.values()];
}

/**
 * Block up to `SYNC_WARM_TIMEOUT_MS` while every `requireFreshOnRuleBuild`
 * LV's backing workflow refreshes. After the timeout the resolver
 * proceeds with whatever's in the cache — the `stale` flag on the
 * registry entry still signals to Status / observability that the
 * value is behind.
 *
 * No-op (returns immediately) when no LV is sync-warm opted in — the
 * common case. The rule engine's `rebuildAll` awaits this
 * unconditionally because the common-case cost is a single-digit-ms
 * store read + map walk.
 */
export async function kickSyncWarmRefreshes(): Promise<void> {
  if (!syncWarmRunner) return; // scheduler not attached — SW boot order or test environment
  const workspaceId = peekActiveWorkspaceId();
  if (!workspaceId) return; // no Active workspace; nothing to warm against
  const state = getOrCreateState(workspaceId);
  const targets = collectSyncWarmTargets(state, getActiveEnvironmentId(), Date.now());
  if (targets.length === 0) return;

  const runner = syncWarmRunner;
  const deadline = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), SYNC_WARM_TIMEOUT_MS));

  const refreshes = targets.map(async (t) => {
    try {
      await runner(workspaceId, t.workflowUid, t.environmentId);
    } catch (err) {
      // Adapter swallows cache-write errors via `recordRefreshError`;
      // anything that bubbles here is unexpected. Log but don't
      // throw — the rebuild path must make forward progress.
      logger.info('VariablesResolver', `sync-warm refresh for ${t.workflowUid} threw: ${(err as Error).message}`);
    }
  });

  const outcome = await Promise.race([Promise.all(refreshes).then(() => 'done' as const), deadline]);
  if (outcome === 'timeout') {
    getOracleHostHooks().recordLog?.({
      subsystem: 'live',
      op: 'sync-warm-timeout',
      level: 'warn',
      message: `Sync-warm refresh exceeded ${SYNC_WARM_TIMEOUT_MS}ms; serving stale for ${targets.length} workflow(s)`,
      context: { workspaceId },
    });
  }
}
