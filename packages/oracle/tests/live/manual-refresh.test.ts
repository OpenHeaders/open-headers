/**
 * The manual-refresh rule — what a person's press passes that a
 * scheduled fire does not, and what every host's door gets from it: the
 * bypass decision, the probe-start, the offline refusal, the hooks, and
 * the workspace held resident for the run.
 */

import { type CircuitSnapshot, initialCircuitSnapshot } from '@openheaders/core/live';
import type { LiveWorkflow, WorkflowRunCache } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  workflow: null as LiveWorkflow | null,
  rows: [] as WorkflowRunCache[],
  calls: [] as string[],
};

vi.mock('../../src/sync/service', () => ({
  getOrCreateWorkspaceService: (workspaceId: string) => {
    state.calls.push(`acquire ${workspaceId}`);
    return { hydrated: Promise.resolve() };
  },
  releaseWorkspaceService: (workspaceId: string) => {
    state.calls.push(`release ${workspaceId}`);
  },
}));

vi.mock('../../src/live/live-workflow-store', () => ({
  getLiveWorkflowInWorkspace: () => state.workflow,
}));

vi.mock('../../src/live/live-cache-store', () => ({
  listCachesForWorkflow: async () => state.rows,
  markProbeStartForRun: async (workflowUid: string, environmentId: string | null) => {
    state.calls.push(`probe-start ${workflowUid} ${environmentId ?? 'none'}`);
    return null;
  },
}));

import {
  beginManualRefresh,
  type ManualRefreshHost,
  type ManualRefreshRun,
  refreshWorkflowByUser,
  settleManualRefresh,
} from '../../src/live/manual-refresh';

const WS = 'ws-1';
const NOW = 1_800_000_000_000;

const workflow: LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wftoken01',
  path: 'live-workflows/wftoken01',
  name: 'Token',
  enabled: true,
  steps: [],
  refresh: { kind: 'manual' },
};

function row(circuit: CircuitSnapshot, environmentId: string | null = null): WorkflowRunCache {
  return {
    workflowUid: workflow.uid,
    environmentId,
    stepCaptures: {},
    stepResponseBytes: {},
    extractedAt: 0,
    expiresAt: null,
    consecutiveFailures: circuit.consecutiveFailures,
    lastExtractorOk: true,
    circuit,
  };
}

function openCircuit(nextAttemptAt: number): CircuitSnapshot {
  return { ...initialCircuitSnapshot(), state: 'open', consecutiveFailures: 3, consecutiveOpenings: 1, nextAttemptAt };
}

function makeHost(over: Partial<ManualRefreshHost> = {}): { host: ManualRefreshHost; runs: ManualRefreshRun[] } {
  const runs: ManualRefreshRun[] = [];
  const host: ManualRefreshHost = {
    run: async (args) => {
      state.calls.push('run');
      runs.push(args);
    },
    onFired: () => state.calls.push('fired'),
    onSucceeded: () => state.calls.push('succeeded'),
    onFailed: (error) => state.calls.push(`failed ${error.message}`),
    ...over,
  };
  return { host, runs };
}

const target = { workspaceId: WS, workflowUid: workflow.uid, environmentId: null };

beforeEach(() => {
  state.workflow = workflow;
  state.rows = [];
  state.calls = [];
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe('refreshWorkflowByUser', () => {
  it('runs a workflow that has never run, with no bypass, the workspace held for the run', async () => {
    const { host, runs } = makeHost();
    await refreshWorkflowByUser(target, host);
    expect(runs).toEqual([{ workspaceId: WS, workflow, environmentId: null, bypass: false }]);
    expect(state.calls).toEqual([`acquire ${WS}`, 'fired', 'run', 'succeeded', `release ${WS}`]);
  });

  it('hands the caller’s run id to the runner', async () => {
    const { host, runs } = makeHost();
    await refreshWorkflowByUser({ ...target, runId: 'run-7' }, host);
    expect(runs[0]?.runId).toBe('run-7');
  });

  it('runs a disabled workflow no live variable reads — the scheduling gate is not asked', async () => {
    state.workflow = { ...workflow, enabled: false };
    const { host, runs } = makeHost();
    await refreshWorkflowByUser(target, host);
    expect(runs).toHaveLength(1);
  });

  it('bypasses an open circuit inside its backoff and marks no probe', async () => {
    state.rows = [row(openCircuit(NOW + 60_000))];
    const { host, runs } = makeHost();
    await refreshWorkflowByUser(target, host);
    expect(runs[0]?.bypass).toBe(true);
    expect(state.calls).not.toContain(`probe-start ${workflow.uid} none`);
  });

  it('marks the probe start on an open circuit past its backoff, before the run, with no bypass', async () => {
    state.rows = [row(openCircuit(NOW - 1))];
    const { host, runs } = makeHost();
    await refreshWorkflowByUser(target, host);
    expect(runs[0]?.bypass).toBe(false);
    expect(state.calls).toEqual([
      `acquire ${WS}`,
      'fired',
      `probe-start ${workflow.uid} none`,
      'run',
      'succeeded',
      `release ${WS}`,
    ]);
  });

  it('reads the circuit of the pressed environment’s row alone', async () => {
    state.rows = [row(openCircuit(NOW + 60_000), 'envstage1'), row(initialCircuitSnapshot(), null)];
    const { host, runs } = makeHost();
    await refreshWorkflowByUser(target, host);
    expect(runs[0]?.bypass).toBe(false);
  });

  it('refuses a press with no network before anything is fired or run', async () => {
    const { host, runs } = makeHost({ isOnline: () => false });
    await expect(refreshWorkflowByUser(target, host)).rejects.toThrow(/You're offline/);
    expect(runs).toHaveLength(0);
    expect(state.calls).toEqual([`acquire ${WS}`, `release ${WS}`]);
  });

  it('names the workflow and the workspace when the workspace does not hold it', async () => {
    state.workflow = null;
    const { host } = makeHost();
    await expect(refreshWorkflowByUser(target, host)).rejects.toThrow(
      `Workflow ${workflow.uid} not found in workspace ${WS}`,
    );
    expect(state.calls).toEqual([`acquire ${WS}`, `release ${WS}`]);
  });

  it('hands a failed run’s error to the hook with the row the run left, and to the caller unchanged', async () => {
    class ChainRefreshError extends Error {}
    const failure = new ChainRefreshError('getaddrinfo ENOTFOUND auth.openheaders.io');
    const after = row({ ...initialCircuitSnapshot(), consecutiveFailures: 1, lastErrorAt: NOW });
    const seen: Array<WorkflowRunCache | null> = [];
    const { host } = makeHost({
      run: async () => {
        state.rows = [after];
        throw failure;
      },
      onFailed: (error, cache) => {
        state.calls.push(`failed ${error.message}`);
        seen.push(cache);
      },
    });
    await expect(refreshWorkflowByUser(target, host)).rejects.toBe(failure);
    expect(seen).toEqual([after]);
    expect(state.calls).toEqual([
      `acquire ${WS}`,
      'fired',
      'failed getaddrinfo ENOTFOUND auth.openheaders.io',
      `release ${WS}`,
    ]);
  });

  it('runs with no hooks and no online signal — a host that injects the runner alone', async () => {
    const run = vi.fn(async () => undefined);
    await refreshWorkflowByUser(target, { run });
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('the rule in two halves, around a run in another realm', () => {
  it('answers the workflow and the bypass decision, the workspace held for the half alone', async () => {
    state.rows = [row(openCircuit(NOW + 60_000))];
    const { host } = makeHost();
    expect(await beginManualRefresh(target, host)).toEqual({ workflow, bypass: true });
    expect(state.calls).toEqual([`acquire ${WS}`, 'fired', `release ${WS}`]);
  });

  it('marks the probe start in the first half on an open circuit past its backoff', async () => {
    state.rows = [row(openCircuit(NOW - 1))];
    const { host } = makeHost();
    expect((await beginManualRefresh(target, host)).bypass).toBe(false);
    expect(state.calls).toEqual([`acquire ${WS}`, 'fired', `probe-start ${workflow.uid} none`, `release ${WS}`]);
  });

  it('refuses a press with no network in the first half', async () => {
    const { host } = makeHost({ isOnline: () => false });
    await expect(beginManualRefresh(target, host)).rejects.toThrow(/You're offline/);
    expect(state.calls).toEqual([`acquire ${WS}`, `release ${WS}`]);
  });

  it('commits a run that passed and tells the hook, the workspace held for the write', async () => {
    const { host } = makeHost();
    await settleManualRefresh(target, host, async () => {
      state.calls.push('commit');
    });
    expect(state.calls).toEqual([`acquire ${WS}`, 'commit', 'succeeded', `release ${WS}`]);
  });

  it('hands a failed run’s error to the hook with the row its commit left, and to the caller unchanged', async () => {
    const failure = new Error('No message matched devices/dev-1/status within 10 s.');
    const after = row({ ...initialCircuitSnapshot(), consecutiveFailures: 1, lastErrorAt: NOW });
    const seen: Array<WorkflowRunCache | null> = [];
    const { host } = makeHost({ onFailed: (_error, cache) => seen.push(cache) });
    await expect(
      settleManualRefresh(target, host, async () => {
        state.rows = [after];
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(seen).toEqual([after]);
    expect(state.calls).toEqual([`acquire ${WS}`, `release ${WS}`]);
  });
});
