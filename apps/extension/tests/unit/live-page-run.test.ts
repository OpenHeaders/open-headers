/**
 * The worker's side of a workflow run that lives in the workbench page
 * (the workflow runs plan, Laws — "The run lives with its session"): a
 * `call` step through the worker's own adapter and rate limit, sent only
 * once the page noted its leave, and the run's one commit.
 */

import type { LiveWorkflowRunOutcomeWire, LiveWorkflowStepSignalWire } from '@openheaders/core/bridge';
import type { ExecutionPolicyResult } from '@openheaders/core/live';
import type { CallWorkflowStep, LiveWorkflow, Request, WorkflowStep } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const executeForLiveChainMock = vi.fn();
const putWorkflowRunCacheMock = vi.fn();
const recordRefreshErrorMock = vi.fn();
const recordManualBypassFailureForRunMock = vi.fn();
const publishLiveVariablesProducedByRunMock = vi.fn();
const resolveTemplateMock = vi.fn();
const state = {
  signals: [] as LiveWorkflowStepSignalWire[],
  workflow: null as LiveWorkflow | null,
  credentialStepIds: new Set<string>(),
  settled: [] as string[],
};

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@utils/bridge', () => ({
  broadcast: (type: string, payload: LiveWorkflowStepSignalWire) => {
    if (type === 'liveWorkflowStepSignal') state.signals.push(payload);
  },
}));

vi.mock('@/background/modules/request-executor', () => ({
  executeForLiveChain: (...args: unknown[]) => executeForLiveChainMock(...args),
}));

vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequestInWorkspace: (uid: string, _workspaceId: string) => makeRequest(uid),
  getGraphqlRequestInWorkspace: () => null,
}));

vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  putWorkflowRunCache: (...args: unknown[]) => putWorkflowRunCacheMock(...args),
  recordRefreshError: (...args: unknown[]) => recordRefreshErrorMock(...args),
  recordManualBypassFailureForRun: (...args: unknown[]) => recordManualBypassFailureForRunMock(...args),
}));

vi.mock('@openheaders/oracle/live/live-variable-store', () => ({
  publishLiveVariablesProducedByRun: (...args: unknown[]) => publishLiveVariablesProducedByRunMock(...args),
}));

vi.mock('@openheaders/oracle/live/live-workflow-store', () => ({
  getLiveWorkflowInWorkspace: () => state.workflow,
}));

vi.mock('@openheaders/oracle/live/request-exec/chain-template-resolver', () => ({
  createChainTemplateResolver:
    () =>
    (...args: unknown[]) =>
      resolveTemplateMock(...args),
}));

vi.mock('@openheaders/oracle/live/execution-policy-resolver', () => ({
  deriveExecutionPolicyForWorkflow: (): ExecutionPolicyResult => ({
    policy: 'idempotent',
    reasons: [],
    credentialStepIds: state.credentialStepIds,
  }),
}));

// The press rule's second half, as the real one runs it: the commit, then nothing more on a throw.
vi.mock('@/background/modules/live-refresh-scheduler', () => ({
  __setLiveRefreshAdapter: vi.fn(),
  settleLiveWorkflowRunByUser: async (
    workspaceId: string,
    workflowUid: string,
    environmentId: string | null,
    commit: () => Promise<void>,
  ) => {
    state.settled.push(`${workspaceId} ${workflowUid} ${environmentId ?? 'none'}`);
    await commit();
  },
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
}));

const WS = 'ws-devices';
const REFUSED = 'Connection refused by 127.0.0.1.';
const REBOOT_BODY = '{"commandId":"cmd-7"}';

function makeRequest(uid: string): Request {
  return {
    schemaVersion: 5,
    uid,
    path: `requests/devices-coldevc1/${uid}`,
    name: uid,
    method: 'POST',
    url: `https://api.openheaders.io/devices/dev-1/${uid}`,
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
  };
}

function answer(body: string, error: string | null = null) {
  return {
    status: error === null ? 200 : 0,
    statusText: error === null ? 'OK' : '',
    url: 'https://api.openheaders.io/',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body,
    bodyTruncated: false,
    bodyBytes: new TextEncoder().encode(body).byteLength,
    durationMs: 10,
    error,
    scripts: null,
  };
}

const rebootStep: CallWorkflowStep = {
  uid: 'stpreboo',
  id: 'reboot',
  requestUid: 'reqreboo',
  captures: [{ uid: 'capcmdid', name: 'commandId', extractor: { kind: 'json-path', path: '$.commandId' } }],
};

const workflow: LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wfdevice',
  path: 'live-workflows/reboot-and-watch-wfdevice',
  name: 'Reboot and watch',
  steps: [
    { uid: 'stplistn', id: 'probe', action: 'listen', sessionRequestUid: 'mqttprob', timeoutMs: 10_000, captures: [] },
    rebootStep,
  ],
  refresh: { kind: 'manual' },
  enabled: true,
  published: true,
};

function callOf(callId: string, over: { step?: CallWorkflowStep; resend?: boolean } = {}) {
  return {
    callId,
    workspaceId: WS,
    workflowUid: workflow.uid,
    environmentId: null,
    step: rebootStep,
    stepCaptures: { probe: {} },
    resend: false,
    ...over,
  };
}

function commitOf(outcome: LiveWorkflowRunOutcomeWire, bypass = false) {
  return { workspaceId: WS, workflowUid: workflow.uid, environmentId: null, bypass, outcome };
}

const passed: LiveWorkflowRunOutcomeWire = {
  kind: 'passed',
  stepCaptures: { probe: {}, reboot: { commandId: 'cmd-7' }, status: { state: 'rebooting' } },
  stepResponseBytes: { reboot: 21 },
  stepAttempts: { probe: 1, reboot: 1, status: 1 },
  skippedStepIds: [],
  completedAt: 1_753_000_000_500,
};

let pageRun: typeof import('@/background/modules/live-page-run');
let adapterModule: typeof import('@/background/modules/live-chain-adapter');

const settleTick = (): Promise<void> => vi.advanceTimersByTimeAsync(0).then(() => undefined);

beforeEach(async () => {
  vi.resetModules();
  executeForLiveChainMock.mockReset();
  putWorkflowRunCacheMock.mockReset();
  recordRefreshErrorMock.mockReset();
  recordManualBypassFailureForRunMock.mockReset();
  publishLiveVariablesProducedByRunMock.mockReset();
  resolveTemplateMock.mockReset();
  state.signals = [];
  state.workflow = workflow;
  state.credentialStepIds = new Set();
  state.settled = [];
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(1_753_000_000_000);
  pageRun = await import('@/background/modules/live-page-run');
  adapterModule = await import('@/background/modules/live-chain-adapter');
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('a call step of a run that lives in the page', () => {
  it('goes to the wire only once the page noted its leave, and answers with the executor’s response', async () => {
    executeForLiveChainMock.mockResolvedValue(answer(REBOOT_BODY));

    const calling = pageRun.callPageRunStep(callOf('call-1'));
    await settleTick();
    expect(state.signals).toEqual([{ callId: 'call-1', signal: 'leaving' }]);
    expect(executeForLiveChainMock).not.toHaveBeenCalled();

    expect(pageRun.ackPageRunStepLeave('call-1')).toBe(true);

    expect(await calling).toMatchObject({
      success: true,
      response: { status: 200, body: REBOOT_BODY, snapshot: { status: 200, durationMs: 10 } },
    });
    expect(executeForLiveChainMock).toHaveBeenCalledTimes(1);
    const [request, options] = executeForLiveChainMock.mock.calls[0];
    expect(request.uid).toBe('reqreboo');
    expect(options).toMatchObject({ workspaceId: WS, environmentId: null, workflowUid: 'wfdevice', stepId: 'reboot' });
    expect(options.stepCaptures).toEqual(new Map([['probe', new Map()]]));
  });

  it('tells the page it is held while another call to the origin is in flight', async () => {
    executeForLiveChainMock.mockResolvedValue(answer(REBOOT_BODY));

    const first = pageRun.callPageRunStep(callOf('call-1'));
    await settleTick();
    const second = pageRun.callPageRunStep(callOf('call-2'));
    await settleTick();
    expect(state.signals).toEqual([
      { callId: 'call-1', signal: 'leaving' },
      { callId: 'call-2', signal: 'held' },
    ]);

    pageRun.ackPageRunStepLeave('call-1');
    await first;
    await settleTick();
    expect(state.signals.at(-1)).toEqual({ callId: 'call-2', signal: 'leaving' });
    pageRun.ackPageRunStepLeave('call-2');
    expect((await second).success).toBe(true);
  });

  it('is given up unsent when the page never notes the leave, and the origin is free again', async () => {
    executeForLiveChainMock.mockResolvedValue(answer(REBOOT_BODY));

    const calling = pageRun.callPageRunStep(callOf('call-1'));
    await vi.advanceTimersByTimeAsync(pageRun.LEAVE_ACK_DEADLINE_MS);

    expect(await calling).toEqual({
      success: false,
      error: 'The page that runs this workflow did not answer, so the call was not sent.',
    });
    expect(executeForLiveChainMock).not.toHaveBeenCalled();
    expect(pageRun.ackPageRunStepLeave('call-1')).toBe(false);

    const next = pageRun.callPageRunStep(callOf('call-2'));
    await settleTick();
    expect(state.signals.at(-1)).toEqual({ callId: 'call-2', signal: 'leaving' });
    pageRun.ackPageRunStepLeave('call-2');
    expect((await next).success).toBe(true);
  });

  it('answers a failed exchange with the executor’s own record of it', async () => {
    executeForLiveChainMock.mockResolvedValue(answer('', REFUSED));

    const calling = pageRun.callPageRunStep(callOf('call-1'));
    await settleTick();
    pageRun.ackPageRunStepLeave('call-1');

    expect(await calling).toMatchObject({ success: false, error: REFUSED, snapshot: { status: 0, error: REFUSED } });
  });

  it('refuses a step the schema does not take as a call, and sends nothing', async () => {
    expect(await pageRun.callPageRunStep(callOf('call-1', { step: { ...rebootStep, requestUid: '' } }))).toEqual({
      success: false,
      error: 'The step handed over is not a valid call step.',
    });
    expect(state.signals).toEqual([]);
    expect(executeForLiveChainMock).not.toHaveBeenCalled();
  });

  it('answers false to a leave nobody waits on', () => {
    expect(pageRun.ackPageRunStepLeave('call-gone')).toBe(false);
  });
});

describe('the one commit of a run that lived in the page', () => {
  it('writes a passed run’s captures at once and publishes what it produced', async () => {
    await pageRun.settlePageRun(commitOf(passed));

    expect(state.settled).toEqual([`${WS} wfdevice none`]);
    expect(putWorkflowRunCacheMock).toHaveBeenCalledWith(
      {
        workflowUid: 'wfdevice',
        environmentId: null,
        stepCaptures: passed.stepCaptures,
        stepResponseBytes: { reboot: 21 },
        extractedAt: 1_753_000_000_500,
        expiresAt: null,
        skippedStepIds: [],
      },
      WS,
    );
    expect(publishLiveVariablesProducedByRunMock).toHaveBeenCalledWith(WS, 'wfdevice', passed.stepCaptures);
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
  });

  it('records a failed run’s step and sentence with its health, writes no capture, and throws as a worker run does', async () => {
    const failed: LiveWorkflowRunOutcomeWire = {
      kind: 'failed',
      failedStepId: 'status',
      failedPhase: 'expect',
      failedReason: 'No message matched devices/dev-1/status within 10 s.',
    };

    const settling = pageRun.settlePageRun(commitOf(failed));
    await expect(settling).rejects.toBeInstanceOf(adapterModule.ChainRefreshError);
    await expect(settling).rejects.toMatchObject({ failedStepId: 'status', failedPhase: 'expect' });

    expect(recordRefreshErrorMock).toHaveBeenCalledWith(
      {
        workflowUid: 'wfdevice',
        environmentId: null,
        message: 'No message matched devices/dev-1/status within 10 s.',
        failedStepId: 'status',
        extractorOk: true,
        refreshHealth: 'source-failing',
      },
      WS,
    );
    expect(putWorkflowRunCacheMock).not.toHaveBeenCalled();
    expect(publishLiveVariablesProducedByRunMock).not.toHaveBeenCalled();
  });

  it('reads a 401 on the failing step as the credential failing', async () => {
    const failed: LiveWorkflowRunOutcomeWire = {
      kind: 'failed',
      failedStepId: 'reboot',
      failedPhase: 'extract',
      failedReason: 'Capture "commandId" (json-path): no match',
      failedStepStatus: 401,
    };

    await expect(pageRun.settlePageRun(commitOf(failed))).rejects.toBeInstanceOf(adapterModule.ChainRefreshError);

    expect(recordRefreshErrorMock.mock.calls[0][0]).toMatchObject({
      failedStepId: 'reboot',
      extractorOk: false,
      refreshHealth: 'auth-failing',
    });
  });

  it('leaves the circuit alone for a press that overrode it', async () => {
    const failed: LiveWorkflowRunOutcomeWire = {
      kind: 'failed',
      failedStepId: 'probe',
      failedPhase: 'listen',
      failedReason: 'Connection refused by 127.0.0.1:19998.',
    };

    await expect(pageRun.settlePageRun(commitOf(failed, true))).rejects.toBeInstanceOf(adapterModule.ChainRefreshError);

    expect(recordManualBypassFailureForRunMock).toHaveBeenCalledWith(
      {
        workflowUid: 'wfdevice',
        environmentId: null,
        message: 'Connection refused by 127.0.0.1:19998.',
        failedStepId: 'probe',
        extractorOk: true,
      },
      WS,
    );
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
  });

  it('records a run the page refused with no health, and names the phase', async () => {
    const reason = 'Step "probe" names a session request that is not an MQTT request in this workspace.';

    const settling = pageRun.settlePageRun(commitOf({ kind: 'refused', stepId: 'probe', reason }));
    await expect(settling).rejects.toMatchObject({
      message: reason,
      failedStepId: 'probe',
      failedPhase: 'unsupported',
    });

    expect(recordRefreshErrorMock).toHaveBeenCalledWith(
      { workflowUid: 'wfdevice', environmentId: null, message: reason, failedStepId: 'probe', extractorOk: true },
      WS,
    );
  });

  it('names the workflow and the workspace when the workspace no longer holds it', async () => {
    state.workflow = null;

    await expect(pageRun.settlePageRun(commitOf(passed))).rejects.toThrow(
      `Workflow wfdevice not found in workspace ${WS}`,
    );
    expect(putWorkflowRunCacheMock).not.toHaveBeenCalled();
  });
});

describe('a run in the worker', () => {
  it('resolves a criterion that reads a capture, where it was refused before its first step', async () => {
    executeForLiveChainMock.mockResolvedValue(answer(REBOOT_BODY));
    resolveTemplateMock.mockResolvedValue('cmd-7');
    const checked: WorkflowStep = {
      uid: 'stpcheck',
      id: 'check',
      requestUid: 'reqcheck',
      captures: [],
      successCriteria: [
        {
          kind: 'equals',
          uid: 'critcmd0',
          extractor: { kind: 'json-path', path: '$.commandId' },
          value: '{{step.reboot.commandId}}',
        },
      ],
    };

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: WS,
      workflow: { ...workflow, steps: [rebootStep, checked] },
      environmentId: null,
    });

    expect(resolveTemplateMock).toHaveBeenCalledTimes(1);
    expect(resolveTemplateMock.mock.calls[0][0]).toBe('{{step.reboot.commandId}}');
    expect(executeForLiveChainMock).toHaveBeenCalledTimes(2);
    expect(putWorkflowRunCacheMock).toHaveBeenCalledTimes(1);
  });
});
