/**
 * Coverage for {@link LiveWorkflowEditor} — the tab-body editor for one
 * Live Workflow. This file is scoped to the show-but-disable catalog's
 * "Run independent steps in parallel" toggle. It's the only catalog
 * entry that lives at workflow scope (the step-scope entries are
 * covered by `workflow-step-editor.test.tsx`, the gate-scope ones by
 * `step-gate-editor.test.tsx`).
 *
 * The editor reads five hooks + `App.useApp()`. We stub the minimum
 * surface each contributes: one workflow fixture via `useLiveWorkflows`,
 * empty lists for the other hooks, and a no-op message API.
 *
 * Queries go through `screen.getByRole('switch', { name })` — the Switch
 * is semantically a switch (AntD adds `role="switch"`), and the disabled
 * state is exposed via `aria-disabled` + the native `disabled` property.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import type { GraphqlRequest, LiveWorkflow, MqttRequest, Request } from '@openheaders/core/types';
import type { StepRequestOpeners } from '@openheaders/ui/workbench/components/live/step-facts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import * as v from 'valibot';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Monaco (transitively pulled in via EntityConflictDialog) calls
// `document.queryCommandSupported` at module-load time. The polyfill
// must run BEFORE any import that reaches Monaco — beforeAll is too
// late for top-level static imports.
if (typeof document.queryCommandSupported !== 'function') {
  document.queryCommandSupported = (() => false) as typeof document.queryCommandSupported;
}

// EditorHeader (rendered inside LiveWorkflowEditor) reads `keyboard.save`
// via useShortcutLabel; the registry is populated by importing the
// schema barrel for its side effects.
import '@openheaders/ui/workbench/settings/schema';

// AntD's pickers and several other of its primitives rely on
// ResizeObserver via rc-resize-observer. jsdom doesn't ship one.
beforeAll(() => {
  // Monaco (transitively pulled in via EntityConflictDialog) calls
  // `document.queryCommandSupported` at import time; jsdom doesn't
  // ship it.
  if (typeof document.queryCommandSupported !== 'function') {
    document.queryCommandSupported = (() => false) as typeof document.queryCommandSupported;
  }
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

// ── Hook mocks ────────────────────────────────────────────────────
// Each mock provides the minimum slice LiveWorkflowEditor reads. The
// module paths match the `@openheaders/ui/shared/hooks/*` export.
const workflowFixture: LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wftestfxt',
  path: 'live-workflows/test-fixture-wftestfxt',
  name: 'test fixture',
  enabled: true,
  refresh: { kind: 'manual' },
  steps: [
    {
      uid: 'stponly0',
      id: 'only',
      requestUid: 'reqtestfxt',
      captures: [{ uid: 'capvxxxx', name: 'v', extractor: { kind: 'whole-body' } }],
    },
  ],
};

// A workflow as a newer build wrote it — a `listen` with no captures, a
// call, an `expect` — reaching this build by sync.
const needsUpdateFixture: LiveWorkflow = v.parse(LiveWorkflowSchema, {
  ...workflowFixture,
  uid: 'wfdevice',
  name: 'Reboot',
  steps: [
    { uid: 'stplistn', id: 'probe', action: 'watch', session: 'mqttreq1' },
    { uid: 'stpcall0', id: 'reboot', requestUid: 'reqfixt1', captures: [] },
    { uid: 'stpexpct', id: 'status', action: 'verify', on: 'probe', after: 'reboot', captures: [] },
  ],
});

// Mutable so a suite can open a different workflow and watch the two
// write doors.
let workflowState: LiveWorkflow = workflowFixture;
const updateWorkflowMock = vi.fn(async (..._args: unknown[]) => ({ success: true }));
const refreshNowMock = vi.fn(async (..._args: unknown[]) => ({ success: true }));

vi.mock('@openheaders/ui/shared/hooks/readers/useLiveWorkflows', () => ({
  useLiveWorkflows: () => ({
    workflows: [workflowState],
    isReady: true,
    createWorkflow: vi.fn(),
    updateWorkflow: updateWorkflowMock,
    deleteWorkflow: vi.fn(),
    refreshNow: refreshNowMock,
  }),
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useLiveVariables', () => ({
  useLiveVariables: () => ({ variables: [], isReady: true }),
}));
function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: overrides.uid ?? 'reqtestfxt',
    path: `api-requests/fixture-${overrides.uid ?? 'reqtestfxt'}`,
    name: overrides.name ?? 'Fixture request',
    method: 'GET',
    url: 'https://openheaders.io/fixture',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    ...overrides,
  };
}

// Mutable so a test can simulate the fixture step's request being
// deleted. Defaults to the request the workflow fixture's step points
// at, so the non-deletion cases render with no validity error.
let requestsState: {
  requests: Request[];
  graphqlRequests: GraphqlRequest[];
  mqttRequests: MqttRequest[];
  collectionTrees: unknown[];
  isReady: boolean;
} = {
  requests: [makeRequest()],
  graphqlRequests: [],
  mqttRequests: [],
  collectionTrees: [],
  isReady: true,
};

vi.mock('@openheaders/ui/shared/hooks/readers/useRequests', () => ({
  useRequests: () => requestsState,
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useEnvironments', () => ({
  useEnvironments: () => ({ activeEnvironmentId: null, environments: [], isReady: true }),
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useLiveCache', () => ({
  useLiveWorkflowCache: () => ({ runs: [], isReady: true, reload: vi.fn() }),
}));

// Importing after vi.mock so the mocked hook modules resolve first.
const { default: LiveWorkflowEditor } = await import('@openheaders/ui/workbench/components/live/LiveWorkflowEditor');
const { AwarenessIdentityProvider } = await import('@openheaders/ui/shared/awareness');
const { resolveWorkbenchIdentity } = await import('@/host/surface-identity-resolvers');
const testIdentity = resolveWorkbenchIdentity();

afterEach(() => {
  cleanup();
  requestsState = {
    requests: [makeRequest()],
    graphqlRequests: [],
    mqttRequests: [],
    collectionTrees: [],
    isReady: true,
  };
  workflowState = workflowFixture;
  updateWorkflowMock.mockClear();
  refreshNowMock.mockClear();
});

function renderEditor(requestOpeners?: StepRequestOpeners) {
  return render(
    <App>
      <AwarenessIdentityProvider value={testIdentity}>
        <LiveWorkflowEditor mode="edit" workflowUid={workflowState.uid} requestOpeners={requestOpeners} />
      </AwarenessIdentityProvider>
    </App>,
  );
}

/** Open a step in the view's panel, as a click on its node does. */
function openStep(stepId: string): void {
  fireEvent.click(screen.getByTestId(`wf-graph-node-${stepId}`));
}

/** Close the open step: the panel shows the workflow again. */
function closeStep(): void {
  fireEvent.click(screen.getByTestId('wf-panel-close'));
}

describe('LiveWorkflowEditor — show-but-disable', () => {
  it('renders the "Run independent steps in parallel" Switch as disabled + unchecked', () => {
    renderEditor();

    const parallelSwitch = screen.getByRole('switch', { name: /Run independent steps in parallel/i });
    // AntD Switch disables both the native button and the ARIA state.
    expect(parallelSwitch).toHaveProperty('disabled', true);
    expect(parallelSwitch.getAttribute('aria-checked')).toBe('false');
  });
});

describe('LiveWorkflowEditor — deleted-request validity', () => {
  it('no validity error while the step request still exists', () => {
    const { container } = renderEditor();
    openStep('only');
    expect(container.querySelector('[data-step-card="only"]')).not.toBeNull();
    expect(container.querySelector('.ant-select-status-error')).toBeNull();
  });

  it('flags the step when its backing request was deleted', () => {
    // Request gone from the store, registry hydrated (`isReady`).
    requestsState = { requests: [], graphqlRequests: [], mqttRequests: [], collectionTrees: [], isReady: true };
    const { container } = renderEditor();
    openStep('only');
    expect(container.querySelector('.ant-select-status-error')).not.toBeNull();
  });

  it('does not flag the step while the request store is still loading', () => {
    // Empty requests but NOT ready — a cold store must not false-flag.
    requestsState = { requests: [], graphqlRequests: [], mqttRequests: [], collectionTrees: [], isReady: false };
    const { container } = renderEditor();
    openStep('only');
    expect(container.querySelector('[data-step-card="only"]')).not.toBeNull();
    expect(container.querySelector('.ant-select-status-error')).toBeNull();
  });
});

// ── A workflow with steps this build does not know ────────────────
//
// The workflow runs plan, Laws — "A workflow with a step this build
// does not know is read-only here": it is neither edited nor run, and
// it can still be switched off.

describe('LiveWorkflowEditor — a workflow that needs a newer version', () => {
  const BANNER = 'This workflow has steps that need a newer version of OpenHeaders. Update to edit or run it.';
  const STEP = 'This step needs a newer version of OpenHeaders.';

  function renderNeedsUpdate(requestOpeners?: StepRequestOpeners) {
    workflowState = needsUpdateFixture;
    requestsState = { ...requestsState, requests: [makeRequest({ uid: 'reqfixt1' })] };
    return renderEditor(requestOpeners);
  }

  it('says so once, above the view', () => {
    renderNeedsUpdate();
    expect(screen.getAllByText(BANNER)).toHaveLength(1);
  });

  it('shows no banner on a workflow whose every step it knows', () => {
    renderEditor();
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it('shows each unknown step with the sentence and its raw action, and no request to pick', () => {
    const { container } = renderNeedsUpdate();

    for (const [stepId, action] of [
      ['probe', 'watch'],
      ['status', 'verify'],
    ]) {
      openStep(stepId);
      const cards = Array.from(container.querySelectorAll('[data-step-card]'));
      expect(cards.map((card) => card.getAttribute('data-step-card'))).toEqual([stepId]);
      const [card] = cards;
      expect(card.hasAttribute('data-step-needs-update')).toBe(true);
      expect(card.textContent).toContain(STEP);
      expect(card.textContent).toContain(action);
      expect(card.querySelector('.ant-select')).toBeNull();
      expect(card.querySelector('input')).toBeNull();
    }
  });

  it('takes no edit: the call step and Refresh are off, and no step can be added', () => {
    const openers: StepRequestOpeners = { http: vi.fn(), graphql: vi.fn(), mqtt: vi.fn() };
    const { container } = renderNeedsUpdate(openers);
    openStep('reboot');

    // Every control that edits the step is off. What only moves about or
    // explains is not: the close, a row that opens another step, the
    // button that opens the step's request, an (i).
    const callCard = container.querySelector('[data-step-card="reboot"]');
    const controls = Array.from(
      callCard?.querySelectorAll(
        'input, button:not([data-testid="wf-panel-close"]):not(.oh-wf-mini-step)' +
          ':not([data-testid$="-open-request"]):not(.oh-info-trigger)',
      ) ?? [],
    );
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect(control).toHaveProperty('disabled', true);
    expect(screen.getByTestId('wf-panel-close')).toHaveProperty('disabled', false);
    for (const row of callCard?.querySelectorAll('.oh-wf-mini-step') ?? []) {
      expect(row).toHaveProperty('disabled', false);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Open request' }));
    expect(openers.http).toHaveBeenCalledWith('reqfixt1', 'Fixture request', 'GET');
    expect(screen.queryByRole('button', { name: /Step$/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Refresh/ })).toHaveProperty('disabled', true);
  });

  it('can still be switched off, and the save writes that alone', async () => {
    renderNeedsUpdate();

    const enabled = screen.getByRole('switch', { name: 'Workflow enabled' });
    expect(enabled).toHaveProperty('disabled', false);
    fireEvent.click(enabled);
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => expect(updateWorkflowMock).toHaveBeenCalledTimes(1));
    expect(updateWorkflowMock).toHaveBeenCalledWith('wfdevice', { enabled: false });
  });

  it('draws the unknown steps on the graph with no edit gesture, each marked as one that cannot run', () => {
    const { container } = renderNeedsUpdate();

    const nodes = Array.from(container.querySelectorAll('[data-needs-update]'));
    expect(nodes.map((node) => node.textContent)).toEqual([
      `probe${STEP}watchCannot run here`,
      `status${STEP}verifyCannot run here`,
    ]);
    expect(screen.getByTestId('wf-graph-run-probe').getAttribute('data-run-state')).toBe('cannot-run');
    expect(screen.getByTestId('wf-graph-run-reboot').getAttribute('data-run-state')).toBe('not-run');
    expect(screen.queryByTestId('wf-graph-connect-reboot')).toBeNull();
  });
});

describe('LiveWorkflowEditor — one view', () => {
  it('shows the graph beside the workflow, with no switch between views', () => {
    renderEditor();

    expect(screen.getByTestId('wf-graph-node-only')).toBeTruthy();
    expect(screen.getByTestId('wf-panel').textContent).toContain(
      'No step selected, so this shows the whole workflow. Click a step on the graph to open it.',
    );
    expect(screen.queryByText('Preview')).toBeNull();
    expect(screen.queryByText('Editor')).toBeNull();
  });

  it('a click on a node opens that step in the panel, and closing it shows the workflow again', () => {
    const { container } = renderEditor();
    expect(container.querySelector('[data-step-card]')).toBeNull();

    openStep('only');
    expect(container.querySelector('[data-step-card="only"]')).not.toBeNull();
    expect(screen.getByTestId('wf-panel').textContent).toContain('Step 1 of 1');
    expect(screen.getByTestId('wf-graph-node-only').getAttribute('data-selected')).toBe('true');
    expect(screen.queryByRole('switch', { name: /Run independent steps in parallel/i })).toBeNull();

    closeStep();
    expect(container.querySelector('[data-step-card]')).toBeNull();
    expect(screen.getByTestId('wf-graph-node-only').hasAttribute('data-selected')).toBe(false);
    expect(screen.getByRole('switch', { name: /Run independent steps in parallel/i })).toBeTruthy();
  });

  it('a click on the empty canvas deselects the step', () => {
    const { container } = renderEditor();
    openStep('only');

    fireEvent.click(screen.getByTestId('wf-graph-pane'));

    expect(container.querySelector('[data-step-card]')).toBeNull();
  });

  it('a step added on the graph opens in the panel', () => {
    const { container } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: /Step$/ }));

    expect(container.querySelector('[data-step-card="step2"]')).not.toBeNull();
    expect(screen.getByTestId('wf-panel').textContent).toContain('Step 2 of 2');
  });

  it('Duplicate puts a copy of the open step last and opens it', () => {
    const { container } = renderEditor();
    openStep('only');

    fireEvent.click(screen.getByTestId('wf-step-duplicate'));

    expect(container.querySelector('[data-step-card="only-copy"]')).not.toBeNull();
    expect(screen.getByTestId('wf-panel').textContent).toContain('Step 2 of 2');
    expect(screen.getByTestId('wf-graph-node-only-copy').getAttribute('data-selected')).toBe('true');
  });

  it('deleting the open step from its card closes it', () => {
    const { container } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Step$/ }));

    const card = container.querySelector('[data-step-card="step2"]');
    const remove = card?.querySelector<HTMLButtonElement>('button.ant-btn-dangerous');
    if (!remove) throw new Error('the open step has no delete button');
    fireEvent.click(remove);

    expect(container.querySelector('[data-step-card]')).toBeNull();
    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();
  });
});

describe('LiveWorkflowEditor — a run in the view', () => {
  it('a saved workflow with no run says so in its panel', () => {
    renderEditor();

    expect(screen.getByTestId('wf-run-empty').textContent).toBe(
      'No run in this session yet. Press Refresh to run this workflow.',
    );
  });

  it('the Refresh press carries an id of its own for the run', async () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));

    await waitFor(() => expect(refreshNowMock).toHaveBeenCalledTimes(1));
    expect(refreshNowMock).toHaveBeenCalledWith('wftestfxt', null, expect.stringMatching(/.+/));
  });

  it('a workflow that needs a newer version shows which steps cannot run', () => {
    workflowState = needsUpdateFixture;
    renderEditor();

    expect(screen.getByTestId('wf-run-row-probe').getAttribute('data-run-state')).toBe('cannot-run');
    expect(screen.getByTestId('wf-run-row-reboot').getAttribute('data-run-state')).toBe('not-run');
    expect(screen.getByTestId('wf-run-row-status').getAttribute('data-run-state')).toBe('cannot-run');
  });
});

// ── A surface that runs no workflow ───────────────────────────────
//
// The workflow runs plan, Decisions log, S5 and S15: a surface with no
// realm that runs a workflow — the web host's public view — declares
// so, and every other surface — the cases above, with nothing declared —
// stays as it was.

describe('LiveWorkflowEditor — on a surface that runs no workflow', () => {
  const SENTENCE = 'Workflows do not run in a public view.';
  const refreshButton = () =>
    screen.getByRole('button', { name: (name) => name.endsWith('Refresh') && !name.startsWith('About') });

  function renderUnavailable() {
    registerCapability('workflowRunUnavailable', () => true);
    return renderEditor();
  }

  afterEach(() => unregisterCapability('workflowRunUnavailable'));

  it('Refresh is off and a press starts no run', () => {
    renderUnavailable();

    expect(refreshButton()).toHaveProperty('disabled', true);
    fireEvent.click(refreshButton());
    expect(refreshNowMock).not.toHaveBeenCalled();
  });

  it('an (i) beside Refresh says where a workflow runs', async () => {
    renderUnavailable();
    fireEvent.click(screen.getByRole('button', { name: 'About Refresh' }));

    expect(await screen.findByText(SENTENCE)).toBeTruthy();
  });

  it('the workflow’s panel shows no run', () => {
    renderUnavailable();

    expect(screen.getByTestId('wf-graph-node-only')).toBeTruthy();
    expect(screen.queryByTestId('wf-run-empty')).toBeNull();
    expect(screen.getByTestId('wf-panel').textContent).not.toContain('Last run');
  });

  it('with nothing declared there is no (i) and Refresh is on', () => {
    renderEditor();

    expect(screen.queryByRole('button', { name: 'About Refresh' })).toBeNull();
    expect(refreshButton()).toHaveProperty('disabled', false);
  });
});

// ── A workflow that holds session steps ───────────────────────────
//
// The workflow runs plan, Decisions log, S10 and S16: a workflow whose
// steps are `listen`, `send` and `expect` is edited on every surface,
// and run where the host declares that it runs session steps. It gives
// a verdict: its refresh is manual and its captures are not exposed.
// Listen, Send and Expect are offered in a step's type selector only
// where the surface declares that it authors them.

describe('LiveWorkflowEditor — a workflow that holds session steps', () => {
  const NEEDS_UPDATE = 'This workflow has steps that need a newer version of OpenHeaders. Update to edit or run it.';
  const STEP_NEEDS_UPDATE = 'This step needs a newer version of OpenHeaders.';
  const RUNS_ELSEWHERE = 'A workflow with session steps runs in the Workbench tab.';
  const refreshButton = () =>
    screen.getByRole('button', { name: (name) => name.endsWith('Refresh') && !name.startsWith('About') });

  const mqttRequest: MqttRequest = {
    schemaVersion: 5,
    uid: 'mqttreq1',
    path: 'api-requests/probe-mqttreq1',
    name: 'Probe MQTT',
    url: 'ws://openheaders.io/mqtt',
    topic: '',
    payload: '',
    topics: [],
    savedMessages: [],
    userProperties: [],
  };

  const sessionFixture: LiveWorkflow = v.parse(LiveWorkflowSchema, {
    ...workflowFixture,
    uid: 'wfdevice',
    name: 'Reboot',
    steps: [
      {
        uid: 'stplistn',
        id: 'probe',
        action: 'listen',
        sessionRequestUid: 'mqttreq1',
        timeoutMs: 10_000,
        captures: [],
      },
      { uid: 'stpcall0', id: 'reboot', requestUid: 'reqfixt1', captures: [] },
      {
        uid: 'stpexpct',
        id: 'status',
        action: 'expect',
        on: 'probe',
        after: 'reboot',
        address: 'devices/dev-1/status',
        match: [
          { kind: 'equals', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' },
        ],
        timeoutMs: 10_000,
        captures: [],
      },
    ],
  });

  function renderWorkflow(workflow: LiveWorkflow) {
    workflowState = workflow;
    requestsState = { ...requestsState, requests: [makeRequest({ uid: 'reqfixt1' })], mqttRequests: [mqttRequest] };
    return renderEditor();
  }

  afterEach(() => {
    unregisterCapability('workflowSessionSteps');
    unregisterCapability('workflowSessionAuthoring');
  });

  it('runs on a press where the host runs session steps, under no banner', async () => {
    registerCapability('workflowSessionSteps', () => true);
    const { container } = renderWorkflow(sessionFixture);

    expect(container.querySelector('[data-workflow-needs-update]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'About Refresh' })).toBeNull();
    expect(refreshButton()).toHaveProperty('disabled', false);
    fireEvent.click(refreshButton());
    await waitFor(() => expect(refreshNowMock).toHaveBeenCalledTimes(1));
  });

  it('its panel shows no run yet, not a refusal', () => {
    registerCapability('workflowSessionSteps', () => true);
    renderWorkflow(sessionFixture);

    expect(screen.getByTestId('wf-run-empty')).toBeTruthy();
  });

  it('is edited: each step opens to the card of its action, and a step can be added', () => {
    const { container } = renderWorkflow(sessionFixture);

    for (const [stepId, action] of [
      ['probe', 'listen'],
      ['reboot', 'call'],
      ['status', 'expect'],
    ]) {
      openStep(stepId);
      const cards = Array.from(container.querySelectorAll('[data-step-card]'));
      expect(cards.map((card) => [card.getAttribute('data-step-card'), card.getAttribute('data-step-action')])).toEqual(
        [[stepId, action]],
      );
      expect(container.querySelector('[data-step-needs-update]')).toBeNull();
    }
    expect(screen.getByTestId<HTMLInputElement>('wf-step-2-address').value).toBe('devices/dev-1/status');
    expect(screen.getByTestId<HTMLInputElement>('wf-step-2-address').disabled).toBe(false);
    openStep('probe');
    expect(screen.getByTestId('wf-step-0-session-request').textContent).toContain('Probe MQTT');
    expect(screen.getByRole('button', { name: /Step$/ })).toHaveProperty('disabled', false);
  });

  it('an edit of a session step is saved with the whole workflow', async () => {
    renderWorkflow(sessionFixture);
    openStep('status');

    fireEvent.change(screen.getByTestId('wf-step-2-address'), { target: { value: 'devices/+/status' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => expect(updateWorkflowMock).toHaveBeenCalledTimes(1));
    const [, patch] = updateWorkflowMock.mock.calls[0] as [string, Pick<LiveWorkflow, 'steps' | 'refresh'>];
    expect(patch.steps[2]).toEqual({ ...sessionFixture.steps[2], address: 'devices/+/status' });
    expect(patch.steps[0]).toEqual(sessionFixture.steps[0]);
    expect(patch.refresh).toEqual({ kind: 'manual' });
  });

  it('a step’s id is typed in place: its field stays, and keeps the focus, as each letter lands', () => {
    const { container } = renderWorkflow(sessionFixture);
    openStep('probe');
    const idField = (): HTMLInputElement => {
      const input = container.querySelector<HTMLInputElement>('[data-field-path="steps.0.id"] input');
      if (input === null) throw new Error('the first step has no id field');
      return input;
    };

    const field = idField();
    field.focus();
    fireEvent.change(field, { target: { value: 'probe2' } });

    expect(idField()).toBe(field);
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe('probe2');
    // The renamed step stays open, and the rename follows into the step that is on it.
    expect(container.querySelector('[data-step-card="probe2"]')).not.toBeNull();
    openStep('status');
    expect(screen.getByTestId('wf-step-2-on').textContent).toContain('probe2');
  });

  it('its status strip speaks of a run, not of live variables', () => {
    const { container } = renderWorkflow(sessionFixture);

    expect(container.textContent).toContain('not run yet — press Refresh to run');
    expect(container.textContent).not.toContain('bound:');
  });

  it('a workflow of calls keeps the strip’s binding count and its never-run line', () => {
    const { container } = renderEditor();

    expect(container.textContent).toContain('never run for this env — click Refresh to populate');
    expect(container.textContent).toContain('bound:');
  });

  it('a save with a step that has nothing picked names the step and stores nothing', async () => {
    renderWorkflow(sessionFixture);

    fireEvent.click(screen.getByRole('button', { name: /Step$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(await screen.findByText('Step "step4" has nothing picked yet.')).toBeTruthy();
    expect(updateWorkflowMock).not.toHaveBeenCalled();
  });

  it('gives a verdict: its refresh is fixed at manual, and its captures offer no exposure', async () => {
    const captured: LiveWorkflow = {
      ...sessionFixture,
      steps: sessionFixture.steps.map((step) =>
        step.id === 'reboot'
          ? { ...step, captures: [{ uid: 'capcmd00', name: 'commandId', extractor: { kind: 'whole-body' } }] }
          : step,
      ),
    };
    const { container } = renderWorkflow(captured);

    const policy = within(screen.getByTestId('wf-panel-policy')).getAllByRole('combobox')[0];
    expect(policy).toHaveProperty('disabled', true);
    expect(screen.getByTestId('wf-form-session-verdict').textContent).toBe(
      'A workflow with session steps gives a verdict; its captures are not exposed as live variables.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'About Refresh policy' }));
    expect(await screen.findByText('A workflow with session steps runs when you press Refresh.')).toBeTruthy();
    openStep('reboot');
    const reboot = container.querySelector('[data-step-card="reboot"]');
    expect(reboot?.querySelector('[data-testid$="-capture-0-name"]')).toHaveProperty('value', 'commandId');
    expect(reboot?.querySelector('[data-testid$="-capture-1-name"]')).toBeNull();
    expect(screen.queryByRole('switch', { name: /Expose capture/ })).toBeNull();
  });

  it('a workflow of calls keeps its policy open and its exposure rows', () => {
    renderEditor();

    const policy = within(screen.getByTestId('wf-panel-policy')).getAllByRole('combobox')[0];
    expect(policy).toHaveProperty('disabled', false);
    expect(screen.queryByTestId('wf-form-session-verdict')).toBeNull();
    openStep('only');
    expect(screen.getByRole('switch', { name: 'Expose capture v as live variable' })).toBeTruthy();
  });

  it('a workflow with an action no build knows is still not run', () => {
    registerCapability('workflowSessionSteps', () => true);
    renderWorkflow(needsUpdateFixture);

    expect(screen.getAllByText(NEEDS_UPDATE)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Refresh/ })).toHaveProperty('disabled', true);
    expect(screen.getByTestId('wf-run-row-probe').getAttribute('data-run-state')).toBe('cannot-run');
  });

  it('where the host runs no session step, Refresh is off with an (i) that names the surface that runs it', async () => {
    const { container } = renderWorkflow(sessionFixture);

    expect(container.querySelector('[data-workflow-needs-update]')).toBeNull();
    expect(refreshButton()).toHaveProperty('disabled', true);
    fireEvent.click(refreshButton());
    expect(refreshNowMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'About Refresh' }));
    expect(await screen.findByText(RUNS_ELSEWHERE)).toBeTruthy();
  });

  it('there its panel shows no run yet, not a refusal', () => {
    renderWorkflow(sessionFixture);

    expect(screen.getByTestId('wf-run-empty')).toBeTruthy();
  });

  it('its node says its protocol and its kind, what it acts on, and what arms it or uses it', () => {
    const { container } = renderWorkflow(sessionFixture);

    expect(container.querySelector('[data-needs-update]')).toBeNull();
    expect(screen.getByTestId('wf-graph-node-probe').textContent).toBe('probeMQTTListenProbe MQTTused by status');
    expect(screen.getByTestId('wf-graph-node-status').textContent).toBe(
      'statusMQTTWaitdevices/dev-1/statuson probe · after reboot',
    );
    expect(screen.getByTestId('wf-graph-armed-status').textContent).toBe('on probe · after reboot');
    expect(screen.queryByTestId('wf-graph-armed-probe')).toBeNull();
  });

  it('a node no run has reached wears the empty ring and has no last line', () => {
    renderWorkflow(sessionFixture);

    expect(screen.getByTestId('wf-graph-run-probe').getAttribute('data-run-state')).toBe('idle');
    expect(screen.queryByTestId('wf-graph-result-probe')).toBeNull();
  });

  it('a session step’s captures are on its node, unexposed', () => {
    const capturing: LiveWorkflow = {
      ...sessionFixture,
      steps: sessionFixture.steps.map((step) =>
        step.id === 'status'
          ? { ...step, captures: [{ uid: 'capstate', name: 'state', extractor: { kind: 'whole-body' } }] }
          : step,
      ),
    };
    renderWorkflow(capturing);

    expect(screen.getByTestId('wf-graph-node-status').textContent).toBe(
      'statusMQTTWaitdevices/dev-1/statuson probe · after reboot · captures state',
    );
    expect(screen.getByTestId('wf-graph-node-status').querySelector('[data-lv-published]')).toBeNull();
  });

  it('a step of an action no build knows still needs a newer version, beside a session step that does not', () => {
    registerCapability('workflowSessionSteps', () => true);
    const mixed: LiveWorkflow = v.parse(LiveWorkflowSchema, {
      ...sessionFixture,
      steps: [sessionFixture.steps[0], { uid: 'stpclose', id: 'hangup', action: 'close', on: 'probe' }],
    });
    const { container } = renderWorkflow(mixed);

    expect(screen.getAllByText(NEEDS_UPDATE)).toHaveLength(1);
    expect(refreshButton()).toHaveProperty('disabled', true);
    expect(screen.getByTestId('wf-run-row-probe').getAttribute('data-run-state')).toBe('not-run');
    expect(screen.getByTestId('wf-run-row-hangup').getAttribute('data-run-state')).toBe('cannot-run');
    openStep('probe');
    expect(container.querySelector('[data-step-needs-update]')).toBeNull();
    openStep('hangup');
    const cards = Array.from(container.querySelectorAll('[data-step-needs-update]'));
    expect(cards.map((card) => card.getAttribute('data-step-card'))).toEqual(['hangup']);
    // Its head names it and its raw action; its one card says the sentence.
    expect(cards[0].textContent).toContain('hangupcloseStep 2 of 2');
    expect(cards[0].textContent).toContain(STEP_NEEDS_UPDATE);
  });

  it('a step’s type selector offers a call alone until the surface authors session steps', () => {
    renderEditor();
    openStep('only');

    const combobox = within(screen.getByTestId('wf-step-0-action')).getByRole('combobox');
    fireEvent.mouseDown(combobox);
    fireEvent.click(combobox);
    expect(screen.queryByText('Listen')).toBeNull();
  });

  it('where it does, picking Listen makes the step one and the workflow a verdict', () => {
    registerCapability('workflowSessionAuthoring', () => true);
    const { container } = renderEditor();
    openStep('only');

    const combobox = within(screen.getByTestId('wf-step-0-action')).getByRole('combobox');
    fireEvent.mouseDown(combobox);
    fireEvent.click(combobox);
    fireEvent.click(screen.getByText('Listen', { selector: '.ant-select-item-option-content' }));

    expect(container.querySelector('[data-step-card="only"]')?.getAttribute('data-step-action')).toBe('listen');
    expect(screen.getByTestId('wf-step-0-session-request').textContent).toContain('Select an MQTT request');
    closeStep();
    expect(screen.getByTestId('wf-form-session-verdict')).toBeTruthy();
    expect(within(screen.getByTestId('wf-panel-policy')).getAllByRole('combobox')[0]).toHaveProperty('disabled', true);
  });
});
