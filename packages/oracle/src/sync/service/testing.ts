/**
 * Sync service — test-only entry points: in-memory dependency
 * injection, synchronous Active binding, and grace-window overrides.
 */

import { getOracleHostHooks } from '../host-hooks';
import { InMemoryMutationLog, type MutationLog } from '../mutation-log';
import type { LockAcquirer } from '../oracle';
import { InMemoryPendingIntents, type PendingIntents } from '../pending-intents';
import { disposeWorkspace, getOrCreateWorkspaceService } from './lifecycle';
import { attachActiveBoundRunners, detachActiveBoundRunners } from './runners';
import { currentActive, services, setCurrentActive, setDepsFactory, setGraceMs } from './state';
import type { WireDepsFactory } from './types';

// ── Test-only entry point ────────────────────────────────────────────

export interface SyncServiceTestDeps {
  log?: MutationLog;
  intents?: PendingIntents;
  lock?: LockAcquirer;
  /** Recompile shim for tests that want to assert "the runner asked
   *  for a recompile" without booting the real DNR layer. Defaults to
   *  a no-op. */
  recompile?: (reason: string) => void;
}

/**
 * Initialize the service with in-memory dependencies. Disposes any
 * resident services synchronously (`graceMs = 0` for the duration of
 * the test) so each test starts from a clean slate. The cache + oracle
 * + broadcast bus are the real production classes — only persistence
 * + lock adapters are swapped.
 */
export function __initSyncServiceForTests(workspaceId: string, deps: SyncServiceTestDeps = {}): void {
  setGraceMs(0);
  // Reset Active + tear down every resident service synchronously.
  if (currentActive !== null) {
    const svc = services.get(currentActive);
    if (svc) detachActiveBoundRunners(svc);
    setCurrentActive(null);
  }
  for (const id of Array.from(services.keys())) {
    disposeWorkspace(id);
  }

  // Swap the deps factory so subsequent lazy materializations use the
  // injected log/intents/lock/recompile. The factory captures the deps
  // closure once; every workspace built in this test session reuses
  // the same instances. Tests that assert cross-workspace behavior
  // override the factory directly via {@link __setWireDepsFactoryForTests}.
  setDepsFactory((id) => ({
    workspaceId: id,
    log: deps.log ?? new InMemoryMutationLog(),
    intents: deps.intents ?? new InMemoryPendingIntents(),
    lock: deps.lock ?? ((_ws, _t, _id, fn) => Promise.resolve().then(fn)),
    recompile: deps.recompile ?? (() => {}),
    // Production-faithful sink (see `build.ts`): routes through the
    // host hooks, a no-op while a test leaves them unset.
    sink: (event) => getOracleHostHooks().broadcastSyncEvent?.(event),
    awarenessSink: () => {},
  }));

  // Synchronously materialize + Active-bind the workspace so tests
  // that read `getOracleForCurrentWorkspace()` immediately after this
  // call (before any awaited microtask) see the oracle. Production's
  // `setRuntimeActive` runs the full async dance (single-flight queue,
  // hydration await, runner attach); for tests the deterministic
  // synchronous shape preserves the pre-existing contract.
  const svc = getOrCreateWorkspaceService(workspaceId);
  attachActiveBoundRunners(svc);
  setCurrentActive(workspaceId);
}

/**
 * Override the dependency factory directly. Used by integration tests
 * that need each per-workspace service to receive its own log/intents
 * (cross-workspace isolation tests in commit 3). Callers should call
 * this BEFORE any `getOrCreateWorkspaceService` so the factory is in
 * place when materialization fires.
 */
export function __setWireDepsFactoryForTests(factory: WireDepsFactory): void {
  setDepsFactory(factory);
}

/** Override the disposal grace window — used by tests that exercise
 *  the grace + cancellation lifecycle directly. */
export function __setGracePeriodMsForTests(ms: number): void {
  setGraceMs(ms);
}
