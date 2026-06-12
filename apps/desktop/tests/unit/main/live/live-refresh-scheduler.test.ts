/**
 * Desktop live refresh scheduler (WS-C C3) — provider + timer plumbing
 * over the shared `RefreshScheduler` core (which runs UNMOCKED here,
 * with its in-memory `setTimeout` adapter under fake timers).
 *
 * The cadence/circuit math (`computeNextFireAt`, `canAttempt`) and every
 * store are mocked: this isolates the desktop module's own job — feed
 * the core active-workspace entries, fire the runner on cadence, and
 * tear everything down on stop. The math is covered at the core level;
 * the scheduler core's truth table lives in the oracle suite.
 */

import type { LiveWorkflow } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startDesktopLiveRunner, stopDesktopLiveRunner } from '../../../../src/main/live/live-refresh-scheduler';

const h = vi.hoisted(() => ({
  // core/live
  computeNextFireAt: vi.fn(),
  canAttempt: vi.fn(),
  initialCircuitSnapshot: vi.fn(),
  isWorkflowEffective: vi.fn(),
  isLiveVariableEffective: vi.fn(),
  // stores
  getActiveWorkspaceId: vi.fn(),
  onWorkspaceStoreChange: vi.fn(),
  getLiveWorkflows: vi.fn(),
  getLiveWorkflowInWorkspace: vi.fn(),
  onLiveWorkflowStoreChange: vi.fn(),
  getLiveVariables: vi.fn(),
  getLiveVariablesForWorkflow: vi.fn(),
  getLiveVariablesForWorkflowInWorkspace: vi.fn(),
  onLiveVariableStoreChange: vi.fn(),
  listCachesForWorkflow: vi.fn(),
  markProbeStartForRun: vi.fn(),
  onLiveCacheStoreChange: vi.fn(),
  getActiveEnvironmentId: vi.fn(),
  onEnvironmentStoreChange: vi.fn(),
  getRequest: vi.fn(),
  isRequestStoreHydrated: vi.fn(),
  onRequestStoreChange: vi.fn(),
  // lifted scheduling gate + host-neutral definitional-freshness module
  // (the latter is exhaustively covered by the extension suite; here it
  // is stubbed so the desktop scheduler test stays on its own plumbing).
  canScheduleWorkflow: vi.fn(),
  startDefinitionalFreshness: vi.fn(),
  stopDefinitionalFreshness: vi.fn(),
  // runner
  runDesktopWorkflowRefresh: vi.fn(),
  // status
  recomputeDesktopLiveStatus: vi.fn(),
}));

vi.mock('@openheaders/core/live', () => ({
  computeNextFireAt: h.computeNextFireAt,
  canAttempt: h.canAttempt,
  initialCircuitSnapshot: h.initialCircuitSnapshot,
  isWorkflowEffective: h.isWorkflowEffective,
  isLiveVariableEffective: h.isLiveVariableEffective,
}));
vi.mock('@openheaders/core/utils', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: h.getActiveWorkspaceId,
  onWorkspaceStoreChange: h.onWorkspaceStoreChange,
}));
vi.mock('@openheaders/oracle/live/live-workflow-store', () => ({
  getLiveWorkflows: h.getLiveWorkflows,
  getLiveWorkflowInWorkspace: h.getLiveWorkflowInWorkspace,
  onLiveWorkflowStoreChange: h.onLiveWorkflowStoreChange,
}));
vi.mock('@openheaders/oracle/live/live-variable-store', () => ({
  getLiveVariables: h.getLiveVariables,
  getLiveVariablesForWorkflow: h.getLiveVariablesForWorkflow,
  getLiveVariablesForWorkflowInWorkspace: h.getLiveVariablesForWorkflowInWorkspace,
  onLiveVariableStoreChange: h.onLiveVariableStoreChange,
}));
vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  listCachesForWorkflow: h.listCachesForWorkflow,
  markProbeStartForRun: h.markProbeStartForRun,
  onLiveCacheStoreChange: h.onLiveCacheStoreChange,
}));
vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: h.getActiveEnvironmentId,
  onEnvironmentStoreChange: h.onEnvironmentStoreChange,
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: h.getRequest,
  isRequestStoreHydrated: h.isRequestStoreHydrated,
  onRequestStoreChange: h.onRequestStoreChange,
}));
vi.mock('@openheaders/oracle/live/scheduling-gate', () => ({
  canScheduleWorkflow: h.canScheduleWorkflow,
}));
vi.mock('@openheaders/oracle/live/definitional-freshness', () => ({
  startDefinitionalFreshness: h.startDefinitionalFreshness,
  stopDefinitionalFreshness: h.stopDefinitionalFreshness,
}));
vi.mock('../../../../src/main/live/chain-runner', () => ({
  runDesktopWorkflowRefresh: h.runDesktopWorkflowRefresh,
}));
vi.mock('../../../../src/main/live/live-status', () => ({
  recomputeDesktopLiveStatus: h.recomputeDesktopLiveStatus,
}));

const WF: LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wf-1',
  path: 'live/wf-1',
  name: 'WF',
  steps: [],
  refresh: { kind: 'interval', seconds: 60 },
  enabled: true,
  published: true,
};
// A live-variable binding stand-in; only ever flows through mocked store
// reads, so its exact shape is immaterial to these scheduler tests.
const LV = { uid: 'lv-1', name: 'TOKEN', workflowUid: 'wf-1', enabled: true, published: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(0);
  // Deterministic reconcile jitter — the core spreads same-wave arms by
  // random(0..250ms); pin it to 0 so cadence assertions stay exact.
  vi.spyOn(Math, 'random').mockReturnValue(0);

  // Effective + schedulable by default; cache empty; cadence 1s out.
  h.isWorkflowEffective.mockReturnValue(true);
  h.isLiveVariableEffective.mockReturnValue(true);
  h.canScheduleWorkflow.mockReturnValue(true);
  h.canAttempt.mockReturnValue(true);
  h.initialCircuitSnapshot.mockReturnValue({});
  h.computeNextFireAt.mockImplementation((_wf: unknown, _cache: unknown, now: number) => now + 1000);

  h.getActiveWorkspaceId.mockReturnValue('ws-1');
  h.getLiveWorkflows.mockReturnValue([WF]);
  h.getLiveWorkflowInWorkspace.mockReturnValue(WF);
  h.getLiveVariables.mockReturnValue([LV]);
  h.getLiveVariablesForWorkflow.mockReturnValue([LV]);
  h.getLiveVariablesForWorkflowInWorkspace.mockReturnValue([LV]);
  h.listCachesForWorkflow.mockResolvedValue([]);
  h.markProbeStartForRun.mockResolvedValue(undefined);
  h.getActiveEnvironmentId.mockReturnValue(null);
  h.isRequestStoreHydrated.mockReturnValue(false);
  for (const on of [
    h.onWorkspaceStoreChange,
    h.onLiveWorkflowStoreChange,
    h.onLiveVariableStoreChange,
    h.onLiveCacheStoreChange,
    h.onEnvironmentStoreChange,
    h.onRequestStoreChange,
  ]) {
    on.mockReturnValue(() => {});
  }
  h.runDesktopWorkflowRefresh.mockResolvedValue({ ok: true, skippedStepIds: [] });
  h.recomputeDesktopLiveStatus.mockResolvedValue(undefined);
});

afterEach(() => {
  stopDesktopLiveRunner();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('startDesktopLiveRunner', () => {
  it('subscribes to every store-change source exactly once', () => {
    startDesktopLiveRunner();
    expect(h.onWorkspaceStoreChange).toHaveBeenCalledTimes(1);
    expect(h.onLiveWorkflowStoreChange).toHaveBeenCalledTimes(1);
    expect(h.onLiveVariableStoreChange).toHaveBeenCalledTimes(1);
    expect(h.onLiveCacheStoreChange).toHaveBeenCalledTimes(1);
    expect(h.onEnvironmentStoreChange).toHaveBeenCalledTimes(1);
    expect(h.onRequestStoreChange).toHaveBeenCalledTimes(1);
  });

  it('arms a timer that fires the runner for the active workspace entry on cadence', async () => {
    startDesktopLiveRunner();
    await vi.advanceTimersByTimeAsync(0); // settle the initial reconcile
    expect(h.runDesktopWorkflowRefresh).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000); // reach the cadence target
    expect(h.runDesktopWorkflowRefresh).toHaveBeenCalledTimes(1);
    expect(h.runDesktopWorkflowRefresh).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      workflow: WF,
      environmentId: null,
    });
  });

  it('recomputes the live status pill on each reconcile pass', async () => {
    startDesktopLiveRunner();
    await vi.advanceTimersByTimeAsync(0); // settle the initial reconcile
    expect(h.recomputeDesktopLiveStatus).toHaveBeenCalledTimes(1);

    // A store-change event drives a debounced reconcile → second recompute.
    const onCache = h.onLiveCacheStoreChange.mock.calls[0]?.[0] as () => void;
    onCache();
    await vi.advanceTimersByTimeAsync(50);
    expect(h.recomputeDesktopLiveStatus).toHaveBeenCalledTimes(2);
  });

  it('does not schedule an ineffective workflow', async () => {
    h.canScheduleWorkflow.mockReturnValue(false);
    startDesktopLiveRunner();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.runDesktopWorkflowRefresh).not.toHaveBeenCalled();
  });
});

describe('stopDesktopLiveRunner', () => {
  it('tears down timers + subscriptions so no further fire happens', async () => {
    const unsub = vi.fn();
    h.onWorkspaceStoreChange.mockReturnValue(unsub);
    startDesktopLiveRunner();
    await vi.advanceTimersByTimeAsync(0);

    stopDesktopLiveRunner();
    expect(unsub).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.runDesktopWorkflowRefresh).not.toHaveBeenCalled();
  });
});
