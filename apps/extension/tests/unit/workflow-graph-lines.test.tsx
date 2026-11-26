/**
 * The lines of a workflow's graph in its view (the workflows redesign,
 * Connections): each dependency's label and capture chips, the capsule
 * of a step with a run condition over two parents, what a run makes of
 * each line as its frames arrive, the selected step's lines, and the
 * remove gesture — on a workflow where `reboot` waits on `login` and
 * `lookup`, and `verify` follows it.
 */

import type { LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import type { WorkflowRunFact } from '@openheaders/core/live';
import type { LiveWorkflow, Request } from '@openheaders/core/types';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  // The response views reach Monaco, which probes this at import time;
  // jsdom does not ship it, and an import outruns any top-level statement.
  if (typeof document.queryCommandSupported !== 'function') {
    document.queryCommandSupported = (() => false) as typeof document.queryCommandSupported;
  }
  return {
    onFrame: null as ((frame: LiveWorkflowRunEventWire) => void) | null,
  };
});

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
      call: async () => ({ product: null }),
    },
  };
});

vi.mock('@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => 'ws-line-pins',
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useEnvironments', () => ({
  useEnvironments: () => ({ activeEnvironmentId: null, environments: [], isReady: true }),
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useRequests', () => ({
  useRequests: () => ({
    requests: [
      makeRequest('reqtoken', 'Login', 'https://api.openheaders.io/token'),
      makeRequest('reqlooku', 'Find device', 'https://api.openheaders.io/devices?owner=John%20Doe'),
      makeRequest(
        'reqreboo',
        'Reboot',
        'https://api.openheaders.io/devices/{{step.lookup.deviceId}}/reboot?t={{step.login.token}}',
      ),
      makeRequest('reqverif', 'Verify', 'https://api.openheaders.io/devices/dev-1'),
    ],
    graphqlRequests: [],
    mqttRequests: [],
    collectionTrees: [],
    isReady: true,
  }),
}));

import {
  __resetWorkflowRunStoreForTests,
  installWorkflowRunStore,
} from '@openheaders/ui/workbench/data/workflow-run-store';
import { SavedWorkflowView } from '../helpers/workflow-view-harness';

beforeAll(() => {
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

function makeRequest(uid: string, name: string, url: string): Request {
  return {
    schemaVersion: 5,
    uid,
    path: `requests/my-requests-colline1/${uid}`,
    name,
    method: 'GET',
    url,
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
  };
}

const workflow: LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wfline01',
  path: 'live-workflows/device-reboot-wfline01',
  name: 'Device reboot',
  enabled: true,
  refresh: { kind: 'manual' },
  steps: [
    {
      uid: 'stplogin',
      id: 'login',
      requestUid: 'reqtoken',
      captures: [{ uid: 'captoken', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
    },
    {
      uid: 'stplooku',
      id: 'lookup',
      requestUid: 'reqlooku',
      dependsOn: [],
      captures: [{ uid: 'capdevid', name: 'deviceId', extractor: { kind: 'json-path', path: '$.id' } }],
    },
    {
      uid: 'stpreboo',
      id: 'reboot',
      requestUid: 'reqreboo',
      dependsOn: ['login', 'lookup'],
      runIf: {
        all: [
          { uid: 'gatlogin', kind: 'status', stepId: 'login', match: '2xx' },
          { uid: 'gatlooku', kind: 'capture-exists', stepId: 'lookup', captureName: 'deviceId' },
        ],
      },
      captures: [],
    },
    { uid: 'stpverif', id: 'verify', requestUid: 'reqverif', dependsOn: ['reboot'], captures: [] },
  ],
};

const BEGIN: WorkflowRunFact = {
  type: 'begin',
  at: 100,
  steps: workflow.steps.map(({ id, uid }) => ({ id, uid })),
};

const start = (stepId: string): WorkflowRunFact => ({ type: 'step-start', at: 101, stepId, maxAttempts: 1 });

const passed = (stepId: string, captureNames: string[] = []): WorkflowRunFact => ({
  type: 'step-settle',
  at: 111,
  stepId,
  settlement: {
    state: 'passed',
    status: 200,
    durationMs: 10,
    responseBytes: 44,
    attempts: 1,
    maxAttempts: 1,
    captureNames,
  },
  hasProduct: false,
});

let seq = 0;

async function feed(fact: WorkflowRunFact, runId = 'run-1'): Promise<void> {
  await act(async () => {
    h.onFrame?.({
      workspaceId: 'ws-line-pins',
      workflowUid: 'wfline01',
      environmentId: null,
      runId,
      seq: seq++,
      fact,
    });
  });
}

const label = (from: string, to: string): HTMLElement => screen.getByTestId(`wf-graph-edge-label-${from}-${to}`);
const lineTruth = (from: string, to: string): string | null =>
  screen.getByTestId(`wf-graph-edge-${from}-${to}`).getAttribute('data-truth');
const labelTruth = (from: string, to: string): string | null => label(from, to).getAttribute('data-truth');
const capsuleArrowTruth = (stepId: string): string | null =>
  screen.getByTestId(`wf-graph-capsule-arrow-${stepId}`).getAttribute('data-truth');

beforeEach(() => {
  seq = 0;
  installWorkflowRunStore();
});

afterEach(() => {
  cleanup();
  __resetWorkflowRunStoreForTests();
});

describe('the lines of a workflow’s graph', () => {
  it('each line says its condition, and names the captures its child reads', () => {
    render(<SavedWorkflowView workflow={workflow} />);

    expect(label('login', 'reboot').textContent).toBe('if 2xxtoken');
    expect(label('login', 'reboot').getAttribute('title')).toBe('if 2xx · token');
    expect(label('lookup', 'reboot').getAttribute('title')).toBe('if deviceId exists · deviceId');
    expect(label('reboot', 'verify').textContent).toBe('always');
  });

  it('a step with a run condition over two parents has the capsule; a step with one parent has none', () => {
    render(<SavedWorkflowView workflow={workflow} />);

    expect(screen.getByTestId('wf-graph-capsule-reboot').textContent).toBe('ALL');
    expect(screen.queryByTestId('wf-graph-capsule-verify')).toBeNull();
    expect(screen.queryByTestId('wf-graph-capsule-login')).toBeNull();
  });

  it('before a run nothing is taken; a run takes the lines into each step it reaches', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    expect(lineTruth('login', 'reboot')).toBe('unknown');
    expect(labelTruth('login', 'reboot')).toBe('unknown');
    expect(capsuleArrowTruth('reboot')).toBe('unknown');

    await feed(BEGIN);
    await feed(start('login'));
    await feed(passed('login', ['token']));
    await feed(start('lookup'));
    await feed(passed('lookup', ['deviceId']));
    expect(lineTruth('login', 'reboot')).toBe('unknown');

    await feed(start('reboot'));
    expect(lineTruth('login', 'reboot')).toBe('taken');
    expect(labelTruth('lookup', 'reboot')).toBe('true');
    expect(capsuleArrowTruth('reboot')).toBe('taken');
    expect(lineTruth('reboot', 'verify')).toBe('unknown');

    await feed(passed('reboot'));
    await feed(start('verify'));
    expect(lineTruth('reboot', 'verify')).toBe('taken');
  });

  it('a skipped step: the line whose clause failed is not taken, the other reached the capsule, its arrow did not', async () => {
    render(<SavedWorkflowView workflow={workflow} />);

    await feed(BEGIN);
    await feed(start('login'));
    await feed(passed('login', ['token']));
    await feed(start('lookup'));
    await feed(passed('lookup', ['deviceId']));
    await feed({
      type: 'step-settle',
      at: 112,
      stepId: 'reboot',
      settlement: { state: 'skipped', unmet: ['gatlogin'] },
      hasProduct: false,
    });

    expect(lineTruth('login', 'reboot')).toBe('not-taken');
    expect(labelTruth('login', 'reboot')).toBe('false');
    expect(lineTruth('lookup', 'reboot')).toBe('taken');
    expect(labelTruth('lookup', 'reboot')).toBe('true');
    expect(capsuleArrowTruth('reboot')).toBe('not-taken');
  });

  it('the selected step’s lines, in and out, wear the accent', () => {
    render(<SavedWorkflowView workflow={workflow} />);
    const lit = (from: string, to: string): string | null =>
      screen.getByTestId(`wf-graph-edge-${from}-${to}`).getAttribute('data-highlight');
    expect(lit('login', 'reboot')).toBeNull();

    fireEvent.click(screen.getByTestId('wf-graph-node-reboot'));

    expect(lit('login', 'reboot')).toBe('true');
    expect(lit('lookup', 'reboot')).toBe('true');
    expect(lit('reboot', 'verify')).toBe('true');
  });

  it('a press on a line’s label selects it, and the × beside it removes the dependency', () => {
    render(<SavedWorkflowView workflow={workflow} />);
    expect(screen.queryByTestId('wf-graph-edge-remove-lookup-reboot')).toBeNull();

    fireEvent.click(label('lookup', 'reboot'));
    expect(screen.getByTestId('wf-graph-edge-lookup-reboot').getAttribute('data-selected')).toBe('true');

    fireEvent.click(screen.getByTestId('wf-graph-edge-remove-lookup-reboot'));
    expect(screen.queryByTestId('wf-graph-edge-lookup-reboot')).toBeNull();
    // One parent left: the capsule goes with the second line.
    expect(screen.queryByTestId('wf-graph-capsule-reboot')).toBeNull();
    expect(screen.getByTestId('wf-graph-edge-login-reboot')).toBeTruthy();
  });

  it('the connect ring is in the page for each step of a graph that can be edited', () => {
    render(<SavedWorkflowView workflow={workflow} />);
    for (const id of ['login', 'lookup', 'reboot', 'verify']) {
      expect(screen.getByTestId(`wf-graph-connect-${id}`)).toBeTruthy();
    }
  });
});
