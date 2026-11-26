/**
 * A workflow run that lives in the workbench page (the workflow runs
 * plan, Laws — "The run lives with its session"), against a worker and a
 * session that answer as the real ones do: which press runs here, what
 * crosses to the worker and in what order, what the page's own Run view
 * is fed, and what is refused before the run.
 */

import type {
  BridgeRpcRequest,
  BridgeRpcResponse,
  HostBridge,
  LiveWorkflowRunEventWire,
  LiveWorkflowStepSignalWire,
} from '@openheaders/core/bridge';
import {
  initialCircuitSnapshot,
  type RunSession,
  type SessionHost,
  type SessionMessage,
  type SessionOpening,
  type StepResponse,
} from '@openheaders/core/live';
import type {
  ExecutedRequestSnapshot,
  LiveWorkflow,
  MqttRequest,
  WorkflowRunCache,
  WorkflowStep,
} from '@openheaders/core/types';
import type { WorkflowRunScope } from '@openheaders/ui/workbench/components/live/workflow-run-scope';
import { beforeEach, describe, expect, it } from 'vitest';
import { createWorkflowRunBridge } from '@/host/workflow-page-run';

const WS = 'ws-devices';
const REFUSED = 'Connection refused by 127.0.0.1.';
const STATUS_BODY = '{"state":"rebooting","commandId":"cmd-7"}';

const probe: MqttRequest = {
  schemaVersion: 5,
  uid: 'mqttprob',
  path: 'requests/devices-coldevc1/probe-mqtt-mqttprob',
  name: 'Probe MQTT',
  url: 'ws://127.0.0.1:3000/net/mqtt',
  protocolVersion: '3.1.1',
  topic: '',
  payload: '',
  topics: [{ uid: 'rowdevc1', topicFilter: 'devices/dev-1/#' }],
  savedMessages: [],
  userProperties: [],
};

const listenStep: WorkflowStep = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttprob',
  timeoutMs: 10_000,
  captures: [],
};

const rebootStep: WorkflowStep = {
  uid: 'stpreboo',
  id: 'reboot',
  requestUid: 'reqreboo',
  captures: [{ uid: 'capcmdid', name: 'commandId', extractor: { kind: 'json-path', path: '$.commandId' } }],
};

const expectStep: WorkflowStep = {
  uid: 'stpstats',
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: 'devices/dev-1/status',
  match: [
    {
      kind: 'equals',
      uid: 'critcmd0',
      extractor: { kind: 'json-path', path: '$.commandId' },
      value: '{{step.reboot.commandId}}',
    },
  ],
  timeoutMs: 5_000,
  captures: [{ uid: 'capstate', name: 'state', extractor: { kind: 'json-path', path: '$.state' } }],
};

function makeWorkflow(steps: WorkflowStep[], uid = 'wfdevice'): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid,
    path: `live-workflows/reboot-and-watch-${uid}`,
    name: 'Reboot and watch',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
  };
}

const scenario = makeWorkflow([listenStep, rebootStep, expectStep]);
const httpOnly = makeWorkflow([rebootStep], 'wfhttp01');

function snapshotOf(body: string, error: string | null = null): ExecutedRequestSnapshot {
  return {
    status: error === null ? 200 : 0,
    statusText: error === null ? 'OK' : '',
    url: 'https://api.openheaders.io/devices/dev-1/reboot',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body,
    bodyTruncated: false,
    bodyBytes: new TextEncoder().encode(body).byteLength,
    durationMs: 12,
    error,
    scripts: null,
  };
}

function responseOf(body: string): StepResponse {
  const snapshot = snapshotOf(body);
  return {
    status: snapshot.status,
    statusText: snapshot.statusText,
    url: snapshot.url,
    headers: snapshot.headers,
    body,
    bodyBytes: snapshot.bodyBytes,
    snapshot,
  };
}

const row: WorkflowRunCache = {
  workflowUid: 'wfdevice',
  environmentId: null,
  stepCaptures: {},
  stepResponseBytes: {},
  extractedAt: 0,
  expiresAt: null,
  consecutiveFailures: 0,
  lastExtractorOk: true,
  circuit: initialCircuitSnapshot(),
};

/** What happened, in order, across the page, the worker and the session. */
let log: string[];

/** A session that answers as the port asks: positions rise, a message lands through the sink handed over at open. */
function fakeSessions() {
  let next = 0;
  let sink: SessionOpening | null = null;
  const session: RunSession = {
    position() {
      log.push('position');
      return next;
    },
    matchesAddress: (address, message) => message.address === address,
    send: async () => ({ ok: false, reason: 'not sent in this suite' }),
    endInput: async () => {},
    end: async () => {
      log.push('session ended');
      return {};
    },
  };
  const host: SessionHost = {
    async open(step, opening) {
      log.push(`open ${step.id}`);
      sink = opening;
      return { ok: true, session };
    },
  };
  const deliver = (address: string, body: string): void => {
    const message: SessionMessage = { position: next, at: Date.now(), address, body, fields: [], stored: false };
    next += 1;
    sink?.onMessage(message);
  };
  return { host, deliver };
}

interface WorkerScript {
  begin?: BridgeRpcResponse<'beginLiveWorkflowRun'>;
  /** The rate limit holds the call before it leaves. */
  held?: boolean;
  /** Runs once the page noted the leave, as the wire would. */
  onSent?: () => void;
  answer?: BridgeRpcResponse<'callLiveWorkflowStep'>;
  /** The call waits here, in flight, until released. */
  holdInFlight?: Promise<void>;
}

/** The worker's bridge as the page sees it: the doors answer as `live-page-run.ts` and the adapter do. */
function fakeWorker(script: WorkerScript = {}) {
  const signalHandlers = new Set<(frame: LiveWorkflowStepSignalWire) => void>();
  const acks = new Map<string, () => void>();
  const calls: BridgeRpcRequest<'callLiveWorkflowStep'>[] = [];
  const commits: BridgeRpcRequest<'commitLiveWorkflowRun'>[] = [];
  const signal = (frame: LiveWorkflowStepSignalWire): void => {
    log.push(`signal ${frame.signal}`);
    for (const handler of signalHandlers) handler(frame);
  };

  const answers = {
    refreshLiveWorkflowNow: async (): Promise<BridgeRpcResponse<'refreshLiveWorkflowNow'>> => {
      log.push('worker ran it');
      return { success: true, run: row };
    },
    beginLiveWorkflowRun: async (): Promise<BridgeRpcResponse<'beginLiveWorkflowRun'>> => {
      log.push('begin');
      return script.begin ?? { success: true, workflow: scenario, bypass: false };
    },
    callLiveWorkflowStep: async (
      payload: BridgeRpcRequest<'callLiveWorkflowStep'>,
    ): Promise<BridgeRpcResponse<'callLiveWorkflowStep'>> => {
      log.push(`call ${payload.step.id}`);
      calls.push(payload);
      if (script.held === true) signal({ callId: payload.callId, signal: 'held' });
      const noted = new Promise<void>((resolve) => acks.set(payload.callId, resolve));
      signal({ callId: payload.callId, signal: 'leaving' });
      await noted;
      script.onSent?.();
      await script.holdInFlight;
      return script.answer ?? { success: true, response: responseOf('{"commandId":"cmd-7"}') };
    },
    ackLiveWorkflowStepLeave: async (
      payload: BridgeRpcRequest<'ackLiveWorkflowStepLeave'>,
    ): Promise<BridgeRpcResponse<'ackLiveWorkflowStepLeave'>> => {
      log.push('ack');
      const noted = acks.get(payload.callId);
      noted?.();
      return { success: noted !== undefined };
    },
    commitLiveWorkflowRun: async (
      payload: BridgeRpcRequest<'commitLiveWorkflowRun'>,
    ): Promise<BridgeRpcResponse<'commitLiveWorkflowRun'>> => {
      log.push(`commit ${payload.outcome.kind}`);
      commits.push(payload);
      if (payload.outcome.kind === 'passed') return { success: true, run: row };
      return {
        success: false,
        error: payload.outcome.kind === 'failed' ? payload.outcome.failedReason : payload.outcome.reason,
      };
    },
    getLiveWorkflowRunProduct: async (): Promise<BridgeRpcResponse<'getLiveWorkflowRunProduct'>> => ({
      product: null,
    }),
  };

  const bridge: HostBridge = {
    call: ((type: string, payload: never) => {
      const answer = Object.entries(answers).find(([name]) => name === type)?.[1];
      if (answer === undefined) return Promise.reject(new Error(`no answer scripted for ${type}`));
      return answer(payload);
    }) as HostBridge['call'],
    broadcast: () => {},
    subscribe: ((type: string, handler: (frame: LiveWorkflowStepSignalWire) => void) => {
      if (type !== 'liveWorkflowStepSignal') return () => {};
      signalHandlers.add(handler);
      return () => signalHandlers.delete(handler);
    }) as HostBridge['subscribe'],
    presence: (() => () => {}) as HostBridge['presence'],
  };
  return { bridge, calls, commits };
}

function makeScope(over: Partial<WorkflowRunScope> = {}): WorkflowRunScope {
  return {
    workspaceId: WS,
    workflows: [scenario, httpOnly],
    mqttRequests: [probe],
    mqttSession: async () => {
      throw new Error('no session scope is asked of this suite');
    },
    templates: (run) => (template) => ({
      result: template.replace('{{step.reboot.commandId}}', run.stepCaptures.get('reboot')?.get('commandId') ?? ''),
      errors: [],
    }),
    ...over,
  };
}

function pageOver(worker: ReturnType<typeof fakeWorker>, sessions: SessionHost, scope: WorkflowRunScope | null) {
  const { bridge, endOpenSessions } = createWorkflowRunBridge({
    base: worker.bridge,
    getScope: () => scope,
    sessionsFor: () => sessions,
    runsScripts: false,
  });
  const frames: LiveWorkflowRunEventWire[] = [];
  bridge.subscribe('liveWorkflowRunEvent', (frame) => frames.push(frame));
  const press = (workflowUid: string, workspaceId: string = WS) =>
    bridge.call('refreshLiveWorkflowNow', { workflowUid, environmentId: null, workspaceId, runId: 'run-1' });
  return { bridge, endOpenSessions, frames, press };
}

beforeEach(() => {
  log = [];
});

describe('which press runs in the page', () => {
  it('leaves a workflow with no session step to the worker, untouched', async () => {
    const page = pageOver(fakeWorker(), fakeSessions().host, makeScope());

    expect(await page.press('wfhttp01')).toEqual({ success: true, run: row });
    expect(log).toEqual(['worker ran it']);
    expect(page.frames).toEqual([]);
  });

  it('leaves a press for another workspace, and a press with no scope published, to the worker', async () => {
    const other = pageOver(fakeWorker(), fakeSessions().host, makeScope());
    await other.press('wfdevice', 'ws-other');
    const unpublished = pageOver(fakeWorker(), fakeSessions().host, null);
    await unpublished.press('wfdevice');

    expect(log).toEqual(['worker ran it', 'worker ran it']);
  });
});

describe('a run that holds a session, in the page', () => {
  it('opens the session here, sends the call through the worker once its leave is noted, and commits once', async () => {
    const sessions = fakeSessions();
    const worker = fakeWorker({ onSent: () => sessions.deliver('devices/dev-1/status', STATUS_BODY) });
    const page = pageOver(worker, sessions.host, makeScope());

    expect(await page.press('wfdevice')).toEqual({ success: true, run: row });

    // The window's position is read between the worker's "leaving" and the page's answer to it.
    const leaving = log.indexOf('signal leaving');
    expect(log.slice(leaving, leaving + 3)).toEqual(['signal leaving', 'position', 'ack']);
    expect(log.filter((entry) => entry !== 'position')).toEqual([
      'begin',
      'open probe',
      'call reboot',
      'signal leaving',
      'ack',
      'session ended',
      'commit passed',
    ]);
    expect(worker.calls[0]).toMatchObject({
      workspaceId: WS,
      workflowUid: 'wfdevice',
      environmentId: null,
      step: rebootStep,
      stepCaptures: { probe: {} },
      resend: false,
    });
    expect(worker.commits).toEqual([
      {
        workflowUid: 'wfdevice',
        environmentId: null,
        workspaceId: WS,
        bypass: false,
        outcome: {
          kind: 'passed',
          stepCaptures: { probe: {}, reboot: { commandId: 'cmd-7' }, status: { state: 'rebooting' } },
          stepResponseBytes: { reboot: 21 },
          stepAttempts: { probe: 1, reboot: 1, status: 1 },
          skippedStepIds: [],
          completedAt: expect.any(Number),
        },
      },
    ]);
  });

  it('feeds its own Run view directly, under the caller’s run id, and holds each step’s product', async () => {
    const sessions = fakeSessions();
    const worker = fakeWorker({ onSent: () => sessions.deliver('devices/dev-1/status', STATUS_BODY) });
    const page = pageOver(worker, sessions.host, makeScope());

    await page.press('wfdevice');

    expect(new Set(page.frames.map((frame) => frame.runId))).toEqual(new Set(['run-1']));
    expect(page.frames.map((frame) => frame.fact.type)).toEqual([
      'begin',
      'step-start',
      'step-settle',
      'step-start',
      'step-settle',
      'step-start',
      'step-settle',
      'end',
    ]);
    expect(page.frames.at(-1)).toMatchObject({ workspaceId: WS, workflowUid: 'wfdevice', fact: { ok: true } });
    expect(await page.bridge.call('getLiveWorkflowRunProduct', { runId: 'run-1', stepId: 'reboot' })).toMatchObject({
      product: { kind: 'response', snapshot: { status: 200, durationMs: 12 } },
    });
    expect(await page.bridge.call('getLiveWorkflowRunProduct', { runId: 'run-1', stepId: 'status' })).toMatchObject({
      product: { kind: 'message', message: { address: 'devices/dev-1/status', body: STATUS_BODY } },
    });
    expect(await page.bridge.call('getLiveWorkflowRunProduct', { runId: 'run-else', stepId: 'reboot' })).toEqual({
      product: null,
    });
  });

  it('says a call is held on the rate limit, and that it left', async () => {
    const sessions = fakeSessions();
    const worker = fakeWorker({
      held: true,
      onSent: () => sessions.deliver('devices/dev-1/status', STATUS_BODY),
    });
    const page = pageOver(worker, sessions.host, makeScope());

    await page.press('wfdevice');

    const holds = page.frames.map((frame) => frame.fact).filter((fact) => fact.type === 'step-hold');
    expect(holds).toMatchObject([
      { stepId: 'reboot', held: true },
      { stepId: 'reboot', held: false },
    ]);
  });

  it('fails at a call the worker could not send, keeps the executor’s record, and commits the failure', async () => {
    const worker = fakeWorker({ answer: { success: false, error: REFUSED, snapshot: snapshotOf('', REFUSED) } });
    const page = pageOver(worker, fakeSessions().host, makeScope());

    expect(await page.press('wfdevice')).toEqual({ success: false, error: REFUSED });

    expect(worker.commits[0].outcome).toEqual({
      kind: 'failed',
      failedStepId: 'reboot',
      failedPhase: 'fetch',
      failedReason: REFUSED,
    });
    expect(log.at(-2)).toBe('session ended');
    expect(await page.bridge.call('getLiveWorkflowRunProduct', { runId: 'run-1', stepId: 'reboot' })).toMatchObject({
      product: { kind: 'response', snapshot: { status: 0, error: REFUSED } },
    });
  });

  it('ends the session it holds open when the page goes', async () => {
    let release: () => void = () => {};
    const worker = fakeWorker({ holdInFlight: new Promise<void>((resolve) => (release = resolve)) });
    const page = pageOver(worker, fakeSessions().host, makeScope());
    const pressing = page.press('wfdevice');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(log).not.toContain('session ended');

    page.endOpenSessions();

    expect(log).toContain('session ended');
    release();
    await pressing;
  });
});

describe('what the page refuses before a run', () => {
  it('runs none of it when the press rule refuses the press', async () => {
    const worker = fakeWorker({ begin: { success: false, error: "You're offline." } });
    const page = pageOver(worker, fakeSessions().host, makeScope());

    expect(await page.press('wfdevice')).toEqual({ success: false, error: "You're offline." });
    expect(log).toEqual(['begin']);
    expect(page.frames).toEqual([]);
  });

  it('refuses a listen on a request the workspace does not hold, by the check’s sentence, and commits the refusal', async () => {
    const worker = fakeWorker();
    const page = pageOver(worker, fakeSessions().host, makeScope({ mqttRequests: [] }));
    const reason = 'Step "probe" names a session request that is not an MQTT request in this workspace.';

    expect(await page.press('wfdevice')).toEqual({ success: false, error: reason });

    expect(log).toEqual(['begin', 'commit refused']);
    expect(worker.commits[0].outcome).toEqual({ kind: 'refused', stepId: 'probe', reason });
    expect(page.frames.map((frame) => frame.fact)).toMatchObject([
      { type: 'begin' },
      { type: 'step-settle', stepId: 'probe', settlement: { state: 'cannot-run', reason } },
      { type: 'step-settle', stepId: 'reboot', settlement: { state: 'not-run' } },
      { type: 'step-settle', stepId: 'status', settlement: { state: 'not-run' } },
      { type: 'end', ok: false },
    ]);
  });

  it('refuses a listen on a raw TCP broker, naming where it runs', async () => {
    const worker = fakeWorker();
    const tcp: MqttRequest = { ...probe, url: 'mqtt://broker.openheaders.io:1883' };
    const page = pageOver(worker, fakeSessions().host, makeScope({ mqttRequests: [tcp] }));

    await page.press('wfdevice');

    expect(worker.commits[0].outcome).toEqual({
      kind: 'refused',
      stepId: 'probe',
      reason:
        'Step "probe" cannot run here: "Probe MQTT" opens a raw TCP socket (mqtt:// or mqtts://), which a browser page cannot; the desktop app can run it.',
    });
    expect(log).toEqual(['begin', 'commit refused']);
  });

  it('refuses a listen that runs its request’s scripts, until the page has a runtime for them', async () => {
    const scripted = makeWorkflow([{ ...listenStep, runScripts: true }, rebootStep, expectStep]);
    const worker = fakeWorker({ begin: { success: true, workflow: scripted, bypass: false } });
    const page = pageOver(worker, fakeSessions().host, makeScope({ workflows: [scripted] }));

    await page.press('wfdevice');

    expect(worker.commits[0].outcome).toEqual({
      kind: 'refused',
      stepId: 'probe',
      reason: 'Step "probe" cannot run here: this host runs no script on a run\'s session.',
    });
  });
});
