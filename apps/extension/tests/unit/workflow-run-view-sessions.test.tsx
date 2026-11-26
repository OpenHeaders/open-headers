/**
 * The Run view's session rows and message pane (the workflow runs plan,
 * The Run view — the row vocabulary) on the reboot scenario: listen on
 * the probe session, call the reboot endpoint, expect the device's
 * status. Fed by `liveWorkflowRunEvent` frames, as a host that runs
 * session steps sends them.
 */

import type { LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import type { SessionMessage, StepProduct, WorkflowRunFact } from '@openheaders/core/live';
import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import type { LiveWorkflow, MqttRequest, Request } from '@openheaders/core/types';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  onFrame: null as ((frame: LiveWorkflowRunEventWire) => void) | null,
  call: vi.fn(),
}));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: {
      ...actual.hostBridge,
      subscribe: (type: string, listener: (frame: LiveWorkflowRunEventWire) => void) => {
        if (type === 'liveWorkflowRunEvent') h.onFrame = listener;
        return () => undefined;
      },
      call: (...args: unknown[]) => h.call(...args),
    },
  };
});

// The viewer mounts the code editor, which jsdom cannot host — the
// pane's own job here is which message a step opens to.
vi.mock('@openheaders/ui/workbench/components/shared/TimelineMessageViewer', () => ({
  default: ({ text }: { text: string }) => <pre data-testid="wf-run-message-body">{text}</pre>,
  useTimelineViewerModes: () => ({
    modeOf: () => ({ format: null, view: 'pretty' }),
    setMode: () => undefined,
    actionsOf: () => ({ current: null }),
  }),
}));

const STATUS_TOPIC = 'devices/dev-1/status';

const PROBE: MqttRequest = {
  schemaVersion: 5,
  uid: 'mqttreq1',
  path: 'requests/devices-col1/probe-mqttreq1',
  name: 'Probe MQTT',
  url: 'ws://127.0.0.1:3000/net/mqtt',
  topic: '',
  payload: '',
  topics: [{ uid: 'row00001', topicFilter: 'devices/dev-1/#' }],
  savedMessages: [],
  userProperties: [],
};

const REBOOT: Request = {
  schemaVersion: 5,
  uid: 'reqrebot',
  path: 'requests/devices-col1/reboot-reqrebot',
  name: 'Reboot dev-1',
  method: 'POST',
  url: 'https://api.openheaders.io/devices/dev-1/reboot',
  headers: [],
  params: [],
  body: { type: 'none' },
  auth: { type: 'none' },
};

vi.mock('@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => 'ws-devices',
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useEnvironments', () => ({
  useEnvironments: () => ({ activeEnvironmentId: null, environments: [], isReady: true }),
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useRequests', () => ({
  useRequests: () => ({
    requests: [REBOOT],
    graphqlRequests: [],
    mqttRequests: [PROBE],
    collectionTrees: [],
    isReady: true,
  }),
}));

import WorkflowRunBody from '@openheaders/ui/workbench/components/live/WorkflowRunBody';
import {
  __resetWorkflowRunStoreForTests,
  installWorkflowRunStore,
} from '@openheaders/ui/workbench/data/workflow-run-store';

beforeAll(async () => {
  // The message view loads when a step is first opened; load it once here
  // so a test waits for a render, not for the import.
  await import('@openheaders/ui/workbench/components/live/WorkflowRunMessage');
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

const workflow: LiveWorkflow = v.parse(LiveWorkflowSchema, {
  schemaVersion: 5,
  uid: 'wfdevice',
  path: 'live-workflows/reboot-wfdevice',
  name: 'Reboot dev-1 is acknowledged',
  enabled: true,
  refresh: { kind: 'manual' },
  steps: [
    { uid: 'stplistn', id: 'probe', action: 'listen', sessionRequestUid: 'mqttreq1', timeoutMs: 10_000, captures: [] },
    { uid: 'stpcall0', id: 'reboot', requestUid: 'reqrebot', captures: [] },
    {
      uid: 'stpexpct',
      id: 'status',
      action: 'expect',
      on: 'probe',
      after: 'reboot',
      address: STATUS_TOPIC,
      match: [
        { kind: 'equals', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' },
      ],
      timeoutMs: 10_000,
      captures: [],
    },
  ],
});

function message(position: number, body: string, stored = false): SessionMessage {
  return {
    position,
    at: 2_000 + position,
    address: STATUS_TOPIC,
    body,
    fields: [
      { key: 'topic', value: STATUS_TOPIC },
      { key: 'qos', value: '0' },
      { key: 'retain', value: String(stored) },
    ],
    stored,
  };
}

const REBOOTING = message(7, '{"state":"rebooting","command":"reboot"}');
const MATCHED: StepProduct = {
  kind: 'message',
  message: REBOOTING,
  window: [
    { message: message(5, '{"state":"online"}', true), outcome: 'stored' },
    { message: REBOOTING, outcome: 'matched' },
  ],
};

const BEGIN: WorkflowRunFact = {
  type: 'begin',
  at: 100,
  steps: [
    { id: 'probe', uid: 'stplistn' },
    { id: 'reboot', uid: 'stpcall0' },
    { id: 'status', uid: 'stpexpct' },
  ],
};
const start = (stepId: string): Extract<WorkflowRunFact, { type: 'step-start' }> => ({
  type: 'step-start',
  at: 101,
  stepId,
  maxAttempts: 1,
});
const PROBE_READY: WorkflowRunFact = {
  type: 'step-settle',
  at: 141,
  stepId: 'probe',
  settlement: {
    state: 'ready',
    readyMs: 41,
    captureNames: [],
    facts: { identityGenerated: true, cleanStart: true, resumed: false, granted: 1 },
  },
  hasProduct: false,
};
const REBOOT_PASSED: WorkflowRunFact = {
  type: 'step-settle',
  at: 160,
  stepId: 'reboot',
  settlement: {
    state: 'passed',
    status: 200,
    durationMs: 18,
    responseBytes: 20,
    attempts: 1,
    maxAttempts: 1,
    captureNames: [],
  },
  hasProduct: false,
};
const STATUS_MATCHED: WorkflowRunFact = {
  type: 'step-settle',
  at: 472,
  stepId: 'status',
  settlement: { state: 'matched', afterMs: 312, captureNames: [] },
  hasProduct: true,
};

let seq = 0;

async function feed(fact: WorkflowRunFact): Promise<void> {
  await act(async () => {
    h.onFrame?.({
      workspaceId: 'ws-devices',
      workflowUid: 'wfdevice',
      environmentId: null,
      runId: 'run-1',
      seq: seq++,
      fact,
    });
  });
}

const rowText = (stepId: string): string => screen.getByTestId(`wf-run-row-${stepId}`).textContent ?? '';

beforeEach(() => {
  seq = 0;
  h.call.mockReset();
  h.call.mockImplementation(async (type: string) => {
    if (type !== 'getLiveWorkflowRunProduct') throw new Error(`unexpected call ${type}`);
    return { product: MATCHED };
  });
  installWorkflowRunStore();
});

afterEach(() => {
  cleanup();
  __resetWorkflowRunStoreForTests();
});

describe('the Run view on a run with session steps', () => {
  it('names each row by its action and what it acts on', async () => {
    render(<WorkflowRunBody workflow={workflow} needsUpdate={false} />);
    await feed(BEGIN);

    expect(rowText('probe')).toBe('ListenprobeMQTTProbe MQTTWaiting');
    expect(rowText('reboot')).toBe('CallrebootPOSTReboot dev-1Waiting');
    expect(rowText('status')).toBe(`Expectstatus${STATUS_TOPIC}Waiting`);
  });

  it('a listen connects, then reads ready and open with how its session opened', async () => {
    render(<WorkflowRunBody workflow={workflow} needsUpdate={false} />);
    await feed(BEGIN);
    await feed(start('probe'));
    expect(rowText('probe')).toContain('Connecting…');

    await feed(PROBE_READY);
    expect(rowText('probe')).toContain('Ready in 41 ms · open');
    expect(rowText('probe')).toContain('Client ID generated · Clean start · 1 subscription granted');
  });

  it('a call the rate limit holds says so until it leaves', async () => {
    render(<WorkflowRunBody workflow={workflow} needsUpdate={false} />);
    await feed(BEGIN);
    await feed(start('reboot'));
    await feed({ type: 'step-hold', at: 102, stepId: 'reboot', held: true });
    expect(rowText('reboot')).toContain('Waiting on the rate limit');

    await feed({ type: 'step-hold', at: 19_102, stepId: 'reboot', held: false });
    expect(rowText('reboot')).toContain('Sending…');
    expect(rowText('reboot')).not.toContain('rate limit');
  });

  it('an expect says what it waits for and how far into its deadline it is', async () => {
    render(<WorkflowRunBody workflow={workflow} needsUpdate={false} />);
    await feed(BEGIN);
    await feed({
      ...start('status'),
      awaiting: { address: STATUS_TOPIC, since: Date.now() - 3_200, timeoutMs: 10_000 },
    });

    expect(rowText('status')).toMatch(/Waiting for devices\/dev-1\/status · 3\.\d s of 10\.0 s$/);
  });

  it('the listen reads closed once the run ends, and the run passed', async () => {
    render(<WorkflowRunBody workflow={workflow} needsUpdate={false} />);
    for (const fact of [BEGIN, start('probe'), PROBE_READY, start('reboot'), REBOOT_PASSED, STATUS_MATCHED]) {
      await feed(fact);
    }
    await feed({ type: 'end', at: 843, ok: true, durationMs: 742, sessions: [{ stepId: 'probe', openForMs: 742 }] });

    expect(rowText('probe')).toContain('Ready in 41 ms · closed after 742 ms');
    // Long facts wrap inside a narrow pane; they are never cut at its edge.
    expect(screen.getByTestId('wf-run-facts-probe').style.whiteSpace).toBe('');
    expect(rowText('status')).toContain('Matched after 312 ms');
    expect(screen.getByTestId('wf-run-view').getAttribute('data-run-verdict')).toBe('passed');
  });

  it('an expect opens to its window, on the message that matched', async () => {
    render(<WorkflowRunBody workflow={workflow} needsUpdate={false} />);
    await feed(BEGIN);
    await feed(STATUS_MATCHED);
    fireEvent.click(screen.getByTestId('wf-run-row-status'));

    const pane = await screen.findByTestId('wf-run-message');
    expect(pane.textContent).toContain('Messages on the address since "reboot" started');
    expect(screen.getByTestId('wf-run-message-row-0').getAttribute('data-note')).toBe('stored');
    expect(screen.getByTestId('wf-run-message-row-1').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('wf-run-message-body').textContent).toBe('{"state":"rebooting","command":"reboot"}');
    expect(screen.getByTestId('wf-run-message-fields').textContent).toBe(`topic${STATUS_TOPIC}qos0retainfalse`);

    fireEvent.click(screen.getByTestId('wf-run-message-row-0'));
    expect(screen.getByTestId('wf-run-message-body').textContent).toBe('{"state":"online"}');
  });
});
