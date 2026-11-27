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
import { getHostStorage, type HostStorage, setHostStorage, wsKeys } from '@openheaders/core/storage';
import type { GraphqlRequest, LiveWorkflow, MqttRequest, Request } from '@openheaders/core/types';
import type { StepRequestOpeners } from '@openheaders/ui/workbench/components/live/step-facts';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import * as v from 'valibot';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

// Motion off: jsdom never ends an animation, and a popover that closed would stay drawn.
function renderEditor(requestOpeners?: StepRequestOpeners) {
  return render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <AwarenessIdentityProvider value={testIdentity}>
          <LiveWorkflowEditor mode="edit" workflowUid={workflowState.uid} requestOpeners={requestOpeners} />
        </AwarenessIdentityProvider>
      </App>
    </ConfigProvider>,
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

/** The header's Run. */
function runButton(): HTMLElement {
  return screen.getByTestId('wf-run');
}

/** Add a call with nothing picked: the graph's "+ Step", then the picker's Call. */
function addCallStep(): void {
  fireEvent.click(screen.getByTestId('wf-graph-add-step'));
  fireEvent.click(screen.getByTestId('wf-step-picker-kind-call'));
}

/**
 * Run with a graph pane that has a size and reports it as it is
 * observed, as a browser's does — jsdom's own observer never reports, and
 * what is drawn over the pane waits for its size.
 */
function withSizedPane(run: () => void): void {
  class ReportingResizeObserver implements ResizeObserver {
    private readonly report: ResizeObserverCallback;
    constructor(report: ResizeObserverCallback) {
      this.report = report;
    }
    observe(): void {
      this.report([], this);
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ReportingResizeObserver);
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600));
  try {
    run();
  } finally {
    rect.mockRestore();
    vi.unstubAllGlobals();
  }
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

  it('takes no edit: the call step and Run are off, and no step can be added', () => {
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
    expect(runButton()).toHaveProperty('disabled', true);
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

    addCallStep();

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
    addCallStep();

    const card = container.querySelector('[data-step-card="step2"]');
    const remove = card?.querySelector<HTMLButtonElement>('button.ant-btn-dangerous');
    if (!remove) throw new Error('the open step has no delete button');
    fireEvent.click(remove);

    expect(container.querySelector('[data-step-card]')).toBeNull();
    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();
  });
});

// ── Undo and redo ─────────────────────────────────────────────────
//
// The workflow runs plan, Decisions log, S31: one history of the draft a
// tab, two buttons in the graph's row of controls, and a shortcut that
// acts in the view but not in a field that takes typing.

describe('LiveWorkflowEditor — undo and redo', () => {
  const editorTree = () => (
    <App>
      <AwarenessIdentityProvider value={testIdentity}>
        <LiveWorkflowEditor mode="edit" workflowUid={workflowState.uid} />
      </AwarenessIdentityProvider>
    </App>
  );
  const undoButton = (): HTMLElement => screen.getByTestId('wf-graph-undo');
  const redoButton = (): HTMLElement => screen.getByTestId('wf-graph-redo');
  const saveButton = (): HTMLElement => screen.getByRole('button', { name: /Save/ });
  const addStep = addCallStep;

  it('both buttons are off until there is an edit to take back', () => {
    renderEditor();

    expect(undoButton()).toHaveProperty('disabled', true);
    expect(redoButton()).toHaveProperty('disabled', true);
  });

  it('a step added is taken back and brought back, and the step open before is open again', () => {
    const { container } = renderEditor();
    addStep();
    expect(undoButton()).toHaveProperty('disabled', false);

    fireEvent.click(undoButton());
    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();
    expect(container.querySelector('[data-step-card]')).toBeNull();
    expect(undoButton()).toHaveProperty('disabled', true);

    fireEvent.click(redoButton());
    expect(screen.getByTestId('wf-graph-node-step2')).toBeTruthy();
    expect(container.querySelector('[data-step-card="step2"]')).not.toBeNull();
    expect(redoButton()).toHaveProperty('disabled', true);
  });

  it('an undo back to what is saved reads as saved by itself', () => {
    renderEditor();
    expect(saveButton()).toHaveProperty('disabled', true);

    addStep();
    expect(saveButton()).toHaveProperty('disabled', false);

    fireEvent.click(undoButton());
    expect(saveButton()).toHaveProperty('disabled', true);
  });

  it('an edit of the panel is in the same history as one of the graph', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('switch', { name: 'Workflow enabled' }));
    addStep();

    fireEvent.click(undoButton());
    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Workflow enabled' }).getAttribute('aria-checked')).toBe('false');

    fireEvent.click(undoButton());
    expect(screen.getByRole('switch', { name: 'Workflow enabled' }).getAttribute('aria-checked')).toBe('true');
  });

  it('the shortcut takes an edit back and brings it back, with either platform’s redo', () => {
    renderEditor();
    addStep();
    const pane = screen.getByTestId('wf-graph-pane');

    fireEvent.keyDown(pane, { key: 'z', code: 'KeyZ', metaKey: true });
    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();

    fireEvent.keyDown(pane, { key: 'z', code: 'KeyZ', metaKey: true, shiftKey: true });
    expect(screen.getByTestId('wf-graph-node-step2')).toBeTruthy();

    fireEvent.keyDown(pane, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();

    fireEvent.keyDown(pane, { key: 'y', code: 'KeyY', ctrlKey: true });
    expect(screen.getByTestId('wf-graph-node-step2')).toBeTruthy();
  });

  it('in a field that takes typing the shortcut is the field’s own', () => {
    const { container } = renderEditor();
    const description = container.querySelector<HTMLInputElement>('input.oh-wf-step-description');
    if (description === null) throw new Error('the workflow has no description field');

    fireEvent.change(description, { target: { value: 'Reboots the device' } });
    fireEvent.keyDown(description, { key: 'z', code: 'KeyZ', metaKey: true });
    expect(description.value).toBe('Reboots the device');
    expect(undoButton()).toHaveProperty('disabled', false);

    fireEvent.keyDown(screen.getByTestId('wf-graph-pane'), { key: 'z', code: 'KeyZ', metaKey: true });
    expect(description.value).toBe('');
  });

  it('a save keeps the history: its echo holds what the draft holds', async () => {
    const view = render(editorTree());
    fireEvent.click(screen.getByRole('switch', { name: 'Workflow enabled' }));
    expect(saveButton()).toHaveProperty('disabled', false);

    workflowState = { ...workflowFixture, enabled: false };
    view.rerender(editorTree());

    await waitFor(() => expect(saveButton()).toHaveProperty('disabled', true));
    expect(undoButton()).toHaveProperty('disabled', false);
    fireEvent.click(undoButton());
    expect(screen.getByRole('switch', { name: 'Workflow enabled' }).getAttribute('aria-checked')).toBe('true');
    expect(saveButton()).toHaveProperty('disabled', false);
  });

  it('a change taken from outside empties the history', async () => {
    const view = render(editorTree());
    addStep();
    fireEvent.click(undoButton());
    expect(redoButton()).toHaveProperty('disabled', false);

    workflowState = { ...workflowFixture, enabled: false };
    view.rerender(editorTree());

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Workflow enabled' }).getAttribute('aria-checked')).toBe('false'),
    );
    expect(undoButton()).toHaveProperty('disabled', true);
    expect(redoButton()).toHaveProperty('disabled', true);
  });

  it('a draft never saved has its history too', () => {
    render(
      <App>
        <AwarenessIdentityProvider value={testIdentity}>
          <LiveWorkflowEditor mode="create" onCreated={vi.fn()} />
        </AwarenessIdentityProvider>
      </App>,
    );
    expect(undoButton()).toHaveProperty('disabled', true);

    addStep();
    fireEvent.click(undoButton());

    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();
    expect(redoButton()).toHaveProperty('disabled', false);
  });

  it('a workflow that needs a newer version has it for its one edit', () => {
    workflowState = needsUpdateFixture;
    renderEditor();
    fireEvent.click(screen.getByRole('switch', { name: 'Workflow enabled' }));

    fireEvent.click(undoButton());

    expect(screen.getByRole('switch', { name: 'Workflow enabled' }).getAttribute('aria-checked')).toBe('true');
  });
});

// ── The minimap and the start mark ────────────────────────────────
//
// The workflow runs plan, Decisions log, S31: from two steps up the
// whole graph sits small in the graph's corner, a rectangle a step in
// its state's colour, and a press there moves the view; a step that
// waits on no other wears a bar on its top edge.

describe('LiveWorkflowEditor — the minimap and the start mark', () => {
  const addStep = addCallStep;

  it('a workflow of one step has no minimap; the second step brings it', () => {
    renderEditor();
    expect(screen.queryByTestId('wf-graph-minimap')).toBeNull();

    addStep();

    expect(screen.getByTestId('wf-graph-minimap')).toBeTruthy();
    expect(screen.getByTestId('wf-graph-minimap-node-only').getAttribute('data-run-state')).toBe('idle');
    expect(screen.getByTestId('wf-graph-minimap-node-step2').getAttribute('data-run-state')).toBe('idle');
  });

  it('a step of the minimap wears the state its node wears', () => {
    workflowState = needsUpdateFixture;
    renderEditor();

    for (const stepId of ['probe', 'reboot', 'status']) {
      expect(screen.getByTestId(`wf-graph-minimap-node-${stepId}`).getAttribute('data-run-state')).toBe(
        screen.getByTestId(`wf-graph-run-${stepId}`).getAttribute('data-run-state'),
      );
    }
    expect(screen.getByTestId('wf-graph-minimap-node-probe').getAttribute('data-run-state')).toBe('cannot-run');
  });

  it('a press on the minimap puts the pressed point of the graph at the middle of the pane', () => {
    Element.prototype.setPointerCapture = vi.fn();
    renderEditor();
    addStep();
    const minimap = screen.getByTestId('wf-graph-minimap');
    const drawing = minimap.querySelector('svg');
    const pane = screen.getByTestId('wf-graph-pane');
    const canvas = pane.firstElementChild;
    if (drawing === null || !(canvas instanceof HTMLElement)) throw new Error('the graph did not mount');
    // Two steps, one under the other: a graph 256 wide and 284 tall, in a drawing 112 by 71.
    vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(new DOMRect(1000, 500, 112, 71));
    vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600));

    // The drawing's middle is the graph's middle.
    fireEvent.pointerDown(minimap, { button: 0, pointerId: 1, clientX: 1056, clientY: 535.5 });
    expect(canvas.style.transform).toBe('translate(272px, 158px) scale(1)');

    // Held and moved to the drawing's top edge: the graph's top is at the pane's middle.
    fireEvent.pointerMove(minimap, { pointerId: 1, clientX: 1056, clientY: 500 });
    expect(canvas.style.transform).toBe('translate(272px, 300px) scale(1)');

    // Let go: a move no longer pans.
    fireEvent.pointerUp(minimap, { pointerId: 1 });
    fireEvent.pointerMove(minimap, { pointerId: 1, clientX: 1056, clientY: 571 });
    expect(canvas.style.transform).toBe('translate(272px, 300px) scale(1)');
  });

  it('the minimap outlines what the pane shows, from the graph’s first mount', () => {
    withSizedPane(() => {
      workflowState = needsUpdateFixture;
      renderEditor();

      const view = screen.getByTestId('wf-graph-minimap-view');
      expect(Number(view.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(view.getAttribute('height'))).toBeGreaterThan(0);
    });
  });

  it('the minimap grows under the pointer and returns when it leaves', () => {
    renderEditor();
    addStep();
    const minimap = screen.getByTestId('wf-graph-minimap');
    expect(minimap.style.width).toBe('120px');
    expect(minimap.style.height).toBe('80px');

    fireEvent.pointerEnter(minimap);
    expect(minimap.style.width).toBe('240px');
    expect(minimap.style.height).toBe('160px');

    fireEvent.pointerLeave(minimap);
    expect(minimap.style.width).toBe('120px');
  });

  it('a step that waits on no other wears the start bar; a step that waits on one does not', () => {
    renderEditor();
    addStep();

    expect(screen.getByTestId('wf-graph-start-only')).toBeTruthy();
    expect(screen.queryByTestId('wf-graph-start-step2')).toBeNull();
  });

  it('the legend is in the row of controls, and names the minimap once there is one', async () => {
    renderEditor();
    const row = screen.getByTestId('wf-graph-zoom-in').parentElement?.parentElement;
    expect(row?.contains(screen.getByTestId('wf-graph-legend-toggle'))).toBe(true);

    addStep();
    fireEvent.mouseEnter(screen.getByTestId('wf-graph-legend-toggle'));

    expect((await screen.findByTestId('wf-graph-legend')).textContent).toContain('drag map');
  });
});

// ── The step picker ───────────────────────────────────────────────
//
// The workflow runs plan, Decisions log, S31: every "add a step" door
// opens a search over the step kinds and the saved requests; a request
// taken is a call on it — a listen, for one that opens a session.

describe('LiveWorkflowEditor — the step picker', () => {
  afterEach(() => {
    unregisterCapability('workflowSessionAuthoring');
  });

  const openPicker = (): void => {
    fireEvent.click(screen.getByTestId('wf-graph-add-step'));
  };
  const search = (): HTMLElement => screen.getByTestId('wf-step-picker-search');
  const rows = (): Array<string | null> =>
    Array.from(screen.getByTestId('wf-step-picker').querySelectorAll('.oh-wf-picker-row')).map((row) =>
      row.getAttribute('data-testid'),
    );

  it('"+ Step" opens the picker over a call and the saved requests, and adds no step by itself', () => {
    renderEditor();
    openPicker();

    expect(rows()).toEqual(['wf-step-picker-kind-call', 'wf-step-picker-request-reqtestfxt']);
    expect(screen.getByTestId('wf-step-picker-kind-call').textContent).toBe('Call');
    expect(screen.getByTestId('wf-step-picker-request-reqtestfxt').textContent).toBe('GETFixture request');
    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();
  });

  it('where session steps are authored it offers the four kinds, and the requests a listen opens', () => {
    registerCapability('workflowSessionAuthoring', () => true);
    requestsState = { ...requestsState, mqttRequests: [mqttRequest] };
    renderEditor();
    openPicker();

    expect(rows()).toEqual([
      'wf-step-picker-kind-call',
      'wf-step-picker-kind-listen',
      'wf-step-picker-kind-send',
      'wf-step-picker-kind-expect',
      'wf-step-picker-request-reqtestfxt',
      'wf-step-picker-request-mqttreq1',
    ]);
    expect(screen.getByTestId('wf-step-picker-kind-expect').textContent).toBe('Wait');
  });

  it('lists no request a listen opens where session steps are not authored', () => {
    requestsState = { ...requestsState, mqttRequests: [mqttRequest] };
    renderEditor();
    openPicker();

    expect(rows()).toEqual(['wf-step-picker-kind-call', 'wf-step-picker-request-reqtestfxt']);
  });

  it('a request taken is a call on it, named after it, and open in the panel', () => {
    const { container } = renderEditor();
    openPicker();

    fireEvent.click(screen.getByTestId('wf-step-picker-request-reqtestfxt'));

    expect(screen.queryByTestId('wf-step-picker')).toBeNull();
    expect(screen.getByTestId('wf-graph-node-fixture-request').getAttribute('data-selected')).toBe('true');
    expect(container.querySelector('[data-step-card="fixture-request"]')?.getAttribute('data-step-action')).toBe(
      'call',
    );
    expect(screen.getByTestId('wf-graph-node-fixture-request').textContent).toContain('Fixture request');
  });

  it('a session request taken is a listen on it', () => {
    registerCapability('workflowSessionAuthoring', () => true);
    requestsState = { ...requestsState, mqttRequests: [mqttRequest] };
    const { container } = renderEditor();
    openPicker();

    fireEvent.click(screen.getByTestId('wf-step-picker-request-mqttreq1'));

    expect(container.querySelector('[data-step-card="probe-mqtt"]')?.getAttribute('data-step-action')).toBe('listen');
    expect(screen.getByTestId('wf-step-1-session-request').textContent).toContain('Probe MQTT');
  });

  it('a search narrows the rows whatever the case, and Enter takes the first', () => {
    renderEditor();
    openPicker();

    fireEvent.change(search(), { target: { value: 'FIXTURE' } });
    expect(rows()).toEqual(['wf-step-picker-request-reqtestfxt']);
    expect(screen.getByTestId('wf-step-picker-request-reqtestfxt').getAttribute('data-first')).toBe('true');

    fireEvent.keyDown(search(), { key: 'Enter', code: 'Enter', keyCode: 13 });

    expect(screen.getByTestId('wf-graph-node-fixture-request')).toBeTruthy();
  });

  it('opened again while the last one still fades, it is a picker of its own: its search empty and focused', () => {
    // Motion on: a picker that closed is still in the page, as it is in a browser until its fade ends.
    render(
      <App>
        <AwarenessIdentityProvider value={testIdentity}>
          <LiveWorkflowEditor mode="edit" workflowUid={workflowState.uid} />
        </AwarenessIdentityProvider>
      </App>,
    );
    openPicker();
    fireEvent.change(search(), { target: { value: 'fixture' } });
    fireEvent.keyDown(search(), { key: 'Enter', code: 'Enter', keyCode: 13 });
    expect(screen.getByTestId('wf-graph-node-fixture-request')).toBeTruthy();

    openPicker();

    expect(search()).toHaveProperty('value', '');
    expect(rows()).toEqual(['wf-step-picker-kind-call', 'wf-step-picker-request-reqtestfxt']);
    expect(document.activeElement).toBe(search());
  });

  it('with nothing typed Enter takes a call', () => {
    renderEditor();
    openPicker();

    fireEvent.keyDown(search(), { key: 'Enter', code: 'Enter', keyCode: 13 });

    expect(screen.getByTestId('wf-graph-node-step2')).toBeTruthy();
  });

  it('a search that matches nothing says so, and Enter takes nothing', () => {
    renderEditor();
    openPicker();

    fireEvent.change(search(), { target: { value: 'no such thing' } });
    expect(rows()).toEqual([]);
    expect(screen.getByTestId('wf-step-picker-empty').textContent).toBe('No match');

    fireEvent.keyDown(search(), { key: 'Enter', code: 'Enter', keyCode: 13 });
    expect(screen.getAllByTestId(/^wf-graph-node-/)).toHaveLength(1);
  });

  it('Esc closes it with no step added', () => {
    renderEditor();
    openPicker();

    fireEvent.keyDown(search(), { key: 'Escape', code: 'Escape' });

    expect(screen.queryByTestId('wf-step-picker')).toBeNull();
    expect(screen.getAllByTestId(/^wf-graph-node-/)).toHaveLength(1);
  });

  it('a key typed in its search is no gesture of the graph: ⌫ removes no step, and the shortcut undoes nothing', () => {
    renderEditor();
    addCallStep();
    openPicker();

    fireEvent.keyDown(search(), { key: 'Backspace', code: 'Backspace' });
    fireEvent.keyDown(screen.getByTestId('wf-step-picker-kind-call'), { key: 'z', code: 'KeyZ', metaKey: true });

    expect(screen.getByTestId('wf-graph-node-step2')).toBeTruthy();
  });

  it('the Steps card’s Add step opens the same picker', () => {
    renderEditor();

    fireEvent.click(screen.getByTestId('wf-steps-add'));
    expect(rows()).toEqual(['wf-step-picker-kind-call', 'wf-step-picker-request-reqtestfxt']);
    fireEvent.click(screen.getByTestId('wf-step-picker-kind-call'));

    expect(screen.getByTestId('wf-panel').textContent).toContain('Step 2 of 2');
  });

  it('the canvas menu’s Add step opens the picker where the menu was', () => {
    renderEditor();

    fireEvent.contextMenu(screen.getByTestId('wf-graph-pane'), { clientX: 120, clientY: 90 });
    fireEvent.click(screen.getByTestId('wf-graph-menu-add-step'));

    expect(screen.queryByTestId('wf-graph-context-menu')).toBeNull();
    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();
    fireEvent.click(screen.getByTestId('wf-step-picker-kind-call'));
    expect(screen.getByTestId('wf-graph-node-step2').getAttribute('data-selected')).toBe('true');
  });

  it('a step added is one undo', () => {
    renderEditor();
    openPicker();
    fireEvent.click(screen.getByTestId('wf-step-picker-request-reqtestfxt'));

    fireEvent.click(screen.getByTestId('wf-graph-undo'));

    expect(screen.queryByTestId('wf-graph-node-fixture-request')).toBeNull();
    expect(screen.getByTestId('wf-graph-undo')).toHaveProperty('disabled', true);
  });
});

// ── The bar of the selected step, and a node's menu ───────────────
//
// The workflow runs plan, Decisions log, S31: Duplicate, Add step
// after, Open request and Delete in a bar by the selected node and in a
// node's right-click menu; a read-only workflow keeps Open request
// alone.

describe('LiveWorkflowEditor — the bar of the selected step', () => {
  const BAR = [
    'wf-graph-bar-duplicate-step',
    'wf-graph-bar-add-step-after',
    'wf-graph-bar-open-request',
    'wf-graph-bar-delete-step',
  ];
  const makeOpeners = (): StepRequestOpeners => ({ http: vi.fn(), graphql: vi.fn(), mqtt: vi.fn() });
  const barButtons = (): Array<string | null> =>
    Array.from(screen.getByTestId('wf-graph-bar').querySelectorAll('button')).map((button) =>
      button.getAttribute('data-testid'),
    );
  const menuRows = (): Array<string | null> =>
    Array.from(screen.getByTestId('wf-graph-context-menu').querySelectorAll('button')).map((button) =>
      button.getAttribute('data-testid'),
    );
  const renderReadOnly = (openers?: StepRequestOpeners) => {
    workflowState = needsUpdateFixture;
    requestsState = { ...requestsState, requests: [makeRequest({ uid: 'reqfixt1' })] };
    return renderEditor(openers);
  };

  it('shows by the selected node with its four actions, each named, and goes with the selection', () => {
    withSizedPane(() => {
      renderEditor(makeOpeners());
      expect(screen.queryByTestId('wf-graph-bar')).toBeNull();

      openStep('only');
      expect(barButtons()).toEqual(BAR);
      expect(BAR.map((id) => screen.getByTestId(id).getAttribute('aria-label'))).toEqual([
        'Duplicate',
        'Add step after',
        'Open request',
        'Delete step',
      ]);

      closeStep();
      expect(screen.queryByTestId('wf-graph-bar')).toBeNull();
    });
  });

  it('sits under a node at the pane’s top, at its left, clear of the connect ring and of the node’s middle', () => {
    withSizedPane(() => {
      renderEditor(makeOpeners());
      openStep('only');

      // One step in a pane 800 wide: its node at 296, 24, its middle at 400. The bar is 98
      // wide, ends 18 short of the middle, and starts 12 under the node.
      const bar = screen.getByTestId('wf-graph-bar');
      expect(bar.style.left).toBe('284px');
      expect(bar.style.top).toBe('118px');
    });
  });

  it('the last step cannot be deleted, and a step that names no saved request has Open request off', () => {
    withSizedPane(() => {
      renderEditor(makeOpeners());
      openStep('only');
      expect(screen.getByTestId('wf-graph-bar-delete-step')).toHaveProperty('disabled', true);
      expect(screen.getByTestId('wf-graph-bar-open-request')).toHaveProperty('disabled', false);

      addCallStep();
      expect(screen.getByTestId('wf-graph-node-step2').getAttribute('data-selected')).toBe('true');
      expect(screen.getByTestId('wf-graph-bar-delete-step')).toHaveProperty('disabled', false);
      expect(screen.getByTestId('wf-graph-bar-open-request')).toHaveProperty('disabled', true);
    });
  });

  it('Duplicate copies the step and opens the copy; one undo takes the copy back', () => {
    withSizedPane(() => {
      const { container } = renderEditor(makeOpeners());
      openStep('only');

      fireEvent.click(screen.getByTestId('wf-graph-bar-duplicate-step'));
      expect(container.querySelector('[data-step-card="only-copy"]')).not.toBeNull();
      expect(screen.getByTestId('wf-graph-node-only-copy').getAttribute('data-selected')).toBe('true');

      fireEvent.click(screen.getByTestId('wf-graph-undo'));
      expect(screen.queryByTestId('wf-graph-node-only-copy')).toBeNull();
    });
  });

  it('Delete removes the step and its bar; one undo brings the step back', () => {
    withSizedPane(() => {
      renderEditor(makeOpeners());
      addCallStep();

      fireEvent.click(screen.getByTestId('wf-graph-bar-delete-step'));
      expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();
      expect(screen.queryByTestId('wf-graph-bar')).toBeNull();

      fireEvent.click(screen.getByTestId('wf-graph-undo'));
      expect(screen.getByTestId('wf-graph-node-step2')).toBeTruthy();
    });
  });

  it('Open request opens the tab of the request the step names', () => {
    withSizedPane(() => {
      const openers = makeOpeners();
      renderEditor(openers);
      openStep('only');

      fireEvent.click(screen.getByTestId('wf-graph-bar-open-request'));

      expect(openers.http).toHaveBeenCalledWith('reqtestfxt', 'Fixture request', 'GET');
    });
  });

  it('Add step after opens the picker, and the step taken waits on the selected one alone', () => {
    withSizedPane(() => {
      renderEditor(makeOpeners());
      addCallStep();
      openStep('only');

      fireEvent.click(screen.getByTestId('wf-graph-bar-add-step-after'));
      expect(screen.queryByTestId('wf-graph-node-step3')).toBeNull();
      fireEvent.click(screen.getByTestId('wf-step-picker-kind-call'));

      expect(screen.getByTestId('wf-graph-node-step3').getAttribute('data-selected')).toBe('true');
      expect(screen.getByTestId('wf-graph-edge-only-step3')).toBeTruthy();
      expect(screen.queryByTestId('wf-graph-edge-step2-step3')).toBeNull();
    });
  });

  it('a surface that opens no request’s tab has no Open request', () => {
    withSizedPane(() => {
      renderEditor();
      openStep('only');

      expect(barButtons()).toEqual(BAR.filter((id) => id !== 'wf-graph-bar-open-request'));
    });
  });

  it('a read-only workflow keeps Open request alone, and a step with nothing to open has no bar', () => {
    withSizedPane(() => {
      const openers = makeOpeners();
      renderReadOnly(openers);

      openStep('reboot');
      expect(barButtons()).toEqual(['wf-graph-bar-open-request']);
      fireEvent.click(screen.getByTestId('wf-graph-bar-open-request'));
      expect(openers.http).toHaveBeenCalledWith('reqfixt1', 'Fixture request', 'GET');

      openStep('probe');
      expect(screen.queryByTestId('wf-graph-bar')).toBeNull();
    });
  });

  it('a right-click on a node selects it and offers the bar’s four', () => {
    const openers = makeOpeners();
    renderEditor(openers);

    fireEvent.contextMenu(screen.getByTestId('wf-graph-node-only'));

    expect(screen.getByTestId('wf-graph-node-only').getAttribute('data-selected')).toBe('true');
    expect(menuRows()).toEqual([
      'wf-graph-menu-duplicate-step',
      'wf-graph-menu-add-step-after',
      'wf-graph-menu-open-request',
      'wf-graph-menu-delete-step',
    ]);
    expect(screen.getByTestId('wf-graph-context-menu').textContent).toBe(
      'DuplicateAdd step afterOpen requestDelete step⌫',
    );

    fireEvent.click(screen.getByTestId('wf-graph-menu-duplicate-step'));
    expect(screen.queryByTestId('wf-graph-context-menu')).toBeNull();
    expect(screen.getByTestId('wf-graph-node-only-copy').getAttribute('data-selected')).toBe('true');
  });

  it('the menu’s Add step after opens the picker at the bar, and the step taken waits on that node', () => {
    withSizedPane(() => {
      renderEditor(makeOpeners());
      addCallStep();

      fireEvent.contextMenu(screen.getByTestId('wf-graph-node-only'));
      fireEvent.click(screen.getByTestId('wf-graph-menu-add-step-after'));
      fireEvent.click(screen.getByTestId('wf-step-picker-kind-call'));

      expect(screen.getByTestId('wf-graph-edge-only-step3')).toBeTruthy();
      expect(screen.queryByTestId('wf-graph-edge-step2-step3')).toBeNull();
    });
  });

  it('a menu opens toward the pane’s middle: from its far half it hangs from that side, and the pane cuts none', () => {
    withSizedPane(() => {
      renderEditor();
      const pane = screen.getByTestId('wf-graph-pane');
      const edges = (): string[] => {
        const { style } = screen.getByTestId('wf-graph-context-menu');
        return [style.left, style.top, style.right, style.bottom];
      };

      // The pane is 800 by 600.
      fireEvent.contextMenu(pane, { clientX: 120, clientY: 90 });
      expect(edges()).toEqual(['120px', '90px', '', '']);

      fireEvent.contextMenu(pane, { clientX: 700, clientY: 500 });
      expect(edges()).toEqual(['', '', '100px', '100px']);
    });
  });

  it('on a read-only workflow a node’s menu holds Open request alone, and a step with nothing to open has none', () => {
    const openers = makeOpeners();
    renderReadOnly(openers);

    fireEvent.contextMenu(screen.getByTestId('wf-graph-node-reboot'));
    expect(menuRows()).toEqual(['wf-graph-menu-open-request']);
    fireEvent.click(screen.getByTestId('wf-graph-menu-open-request'));
    expect(openers.http).toHaveBeenCalledWith('reqfixt1', 'Fixture request', 'GET');

    fireEvent.contextMenu(screen.getByTestId('wf-graph-node-probe'));
    expect(screen.queryByTestId('wf-graph-context-menu')).toBeNull();
  });
});

// ── Moving the nodes ──────────────────────────────────────────────
//
// The workflow runs plan, Decisions log, S31: a node is dragged by its
// body and snaps to 8; the first move keeps every node where it stands
// and a step added after lands under its parent; Auto-arrange returns
// to the computed layout. A move is an entry of the draft's history,
// and its place is this device's, never the workflow's.

describe('LiveWorkflowEditor — moving the nodes', () => {
  const node = (stepId: string): HTMLElement => screen.getByTestId(`wf-graph-node-${stepId}`);
  const placeOf = (stepId: string): [string, string] => [node(stepId).style.left, node(stepId).style.top];
  const arrangeButton = (): HTMLElement => screen.getByTestId('wf-graph-auto-arrange');
  const undoButton = (): HTMLElement => screen.getByTestId('wf-graph-undo');
  const redoButton = (): HTMLElement => screen.getByTestId('wf-graph-redo');
  const saveButton = (): HTMLElement => screen.getByRole('button', { name: /Save/ });

  /** A press on a node's body, the pointer moved by `dx`, `dy`, and let go — with the click a browser sends after. */
  const dragNode = (stepId: string, dx: number, dy: number): void => {
    const el = node(stepId);
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 100 + dx, clientY: 100 + dy });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
    fireEvent.click(el);
  };

  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
  });

  it('a node dragged by its body follows the pointer, snapped to 8, and its line follows', () => {
    renderEditor();
    addCallStep();
    // Two steps, one under the other.
    expect(placeOf('only')).toEqual(['24px', '24px']);
    expect(placeOf('step2')).toEqual(['24px', '178px']);

    const step2 = node('step2');
    fireEvent.pointerDown(step2, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(step2, { pointerId: 1, buttons: 1, clientX: 400, clientY: 100 });

    // 324, 178 on the 8-unit grid.
    expect(placeOf('step2')).toEqual(['328px', '176px']);
    expect(step2.getAttribute('data-moving')).toBe('true');
    // Out of its parent's lower edge, across 36 above the step, into its top: square turns.
    expect(screen.getByTestId('wf-graph-edge-only-step2').getAttribute('d')).toBe(
      'M 128 106 L 128 130 Q 128 140 138 140 L 422 140 Q 432 140 432 150 L 432 170',
    );

    fireEvent.pointerUp(step2, { pointerId: 1, clientX: 400, clientY: 100 });
    expect(placeOf('step2')).toEqual(['328px', '176px']);
    expect(step2.getAttribute('data-moving')).toBeNull();
    expect(placeOf('only')).toEqual(['24px', '24px']);
  });

  it('a press that does not move selects; a press that moves leaves the selection as it was', () => {
    renderEditor();
    addCallStep();
    expect(node('step2').getAttribute('data-selected')).toBe('true');

    // Inside a click's give: no move, and the click selects.
    const only = node('only');
    fireEvent.pointerDown(only, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(only, { pointerId: 1, buttons: 1, clientX: 102, clientY: 101 });
    fireEvent.pointerUp(only, { pointerId: 1, clientX: 102, clientY: 101 });
    fireEvent.click(only);
    expect(placeOf('only')).toEqual(['24px', '24px']);
    expect(only.getAttribute('data-selected')).toBe('true');
    expect(arrangeButton()).toHaveProperty('disabled', true);

    dragNode('step2', 300, 0);
    expect(placeOf('step2')).toEqual(['328px', '176px']);
    expect(node('step2').getAttribute('data-selected')).toBeNull();
    expect(only.getAttribute('data-selected')).toBe('true');

    // The next press of the moved node is a click again.
    fireEvent.click(node('step2'));
    expect(node('step2').getAttribute('data-selected')).toBe('true');
  });

  it('a press whose release was lost ends at the next move with no button held: the node goes back, nothing is kept', () => {
    renderEditor();
    const only = node('only');
    fireEvent.pointerDown(only, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(only, { pointerId: 1, buttons: 1, clientX: 300, clientY: 100 });
    expect(only.getAttribute('data-moving')).toBe('true');

    // The pointer comes back over the node with nothing held.
    fireEvent.pointerMove(only, { pointerId: 1, buttons: 0, clientX: 320, clientY: 140 });
    expect(only.getAttribute('data-moving')).toBeNull();
    expect(placeOf('only')).toEqual(['24px', '24px']);

    fireEvent.pointerMove(only, { pointerId: 1, buttons: 0, clientX: 500, clientY: 300 });
    expect(placeOf('only')).toEqual(['24px', '24px']);
    expect(undoButton()).toHaveProperty('disabled', true);
    expect(arrangeButton()).toHaveProperty('disabled', true);
  });

  it('a move leaves the workflow as saved as it was, and is one entry of the draft’s history', () => {
    renderEditor();
    expect(saveButton()).toHaveProperty('disabled', true);

    dragNode('only', 100, 50);
    expect(placeOf('only')).toEqual(['128px', '72px']);
    expect(saveButton()).toHaveProperty('disabled', true);
    expect(undoButton()).toHaveProperty('disabled', false);

    fireEvent.click(undoButton());
    expect(placeOf('only')).toEqual(['24px', '24px']);
    expect(undoButton()).toHaveProperty('disabled', true);

    fireEvent.click(redoButton());
    expect(placeOf('only')).toEqual(['128px', '72px']);
    expect(saveButton()).toHaveProperty('disabled', true);
  });

  it('a move and an edit are taken back in the order they were made', () => {
    renderEditor();
    dragNode('only', 100, 50);
    addCallStep();
    dragNode('step2', 0, 100);
    // Added under its parent at 128, 226; moved 100 down, on the grid.
    expect(placeOf('step2')).toEqual(['128px', '328px']);

    fireEvent.click(undoButton());
    expect(placeOf('step2')).toEqual(['128px', '226px']);

    fireEvent.click(undoButton());
    expect(screen.queryByTestId('wf-graph-node-step2')).toBeNull();
    expect(placeOf('only')).toEqual(['128px', '72px']);

    fireEvent.click(undoButton());
    expect(placeOf('only')).toEqual(['24px', '24px']);
  });

  it('the first move keeps every node where it stands; a step added then lands under its parent', () => {
    renderEditor();
    addCallStep();
    addCallStep();
    expect(placeOf('step3')).toEqual(['24px', '332px']);

    dragNode('step2', 300, 0);
    expect(placeOf('only')).toEqual(['24px', '24px']);
    expect(placeOf('step3')).toEqual(['24px', '332px']);

    // Added last: it waits on the step before it, and lands a layer's gap under that one.
    addCallStep();
    expect(placeOf('step4')).toEqual(['24px', '486px']);
    expect(placeOf('step2')).toEqual(['328px', '176px']);
  });

  it('Auto-arrange is off until a node is moved, returns the computed layout, and is one undo', () => {
    renderEditor();
    addCallStep();
    expect(arrangeButton()).toHaveProperty('disabled', true);
    expect(arrangeButton().getAttribute('aria-label')).toBe('Auto-arrange');

    dragNode('step2', 300, 0);
    expect(arrangeButton()).toHaveProperty('disabled', false);

    fireEvent.click(arrangeButton());
    expect(placeOf('step2')).toEqual(['24px', '178px']);
    expect(arrangeButton()).toHaveProperty('disabled', true);

    fireEvent.click(undoButton());
    expect(placeOf('step2')).toEqual(['328px', '176px']);
    expect(arrangeButton()).toHaveProperty('disabled', false);
  });

  it('the minimap draws a moved step where it stands, off the origin too', () => {
    renderEditor();
    addCallStep();

    dragNode('step2', -200, 0);

    // 24 − 200 on the grid; the map's box starts a pad left of it.
    expect(placeOf('step2')).toEqual(['-176px', '176px']);
    expect(screen.getByTestId('wf-graph-minimap-node-step2').getAttribute('x')).toBe('-176');
    expect(screen.getByTestId('wf-graph-minimap').querySelector('svg')?.getAttribute('viewBox')).toBe('-200 0 456 282');
  });

  it('a workflow that takes no edit takes no move, and has no Auto-arrange', () => {
    workflowState = needsUpdateFixture;
    renderEditor();
    const before = placeOf('reboot');

    dragNode('reboot', 300, 0);

    expect(placeOf('reboot')).toEqual(before);
    expect(screen.queryByTestId('wf-graph-auto-arrange')).toBeNull();
  });

  it('a draft never saved is arranged too', () => {
    render(
      <App>
        <AwarenessIdentityProvider value={testIdentity}>
          <LiveWorkflowEditor mode="create" onCreated={vi.fn()} />
        </AwarenessIdentityProvider>
      </App>,
    );

    dragNode('step1', 100, 50);

    expect(placeOf('step1')).toEqual(['128px', '72px']);
    fireEvent.click(undoButton());
    expect(placeOf('step1')).toEqual(['24px', '24px']);
  });

  describe('on the device', () => {
    const slot = wsKeys('ws-places').workflowNodePlaces;
    let kept: Map<string, unknown>;
    let installed: HostStorage | null;

    beforeEach(() => {
      kept = new Map();
      installed = getHostStorage();
      setHostStorage({
        get: async (spec) => kept.get(spec.key) as never,
        getMany: async () => ({}) as never,
        set: async (spec, value) => {
          kept.set(spec.key, value);
        },
        setMany: async () => undefined,
        remove: async () => undefined,
        getValidated: async () => null,
        getValidatedArray: async () => [],
        subscribe: () => () => undefined,
      });
    });

    afterEach(() => {
      if (installed !== null) setHostStorage(installed);
    });

    const renderScoped = () =>
      render(
        <ConfigProvider theme={{ token: { motion: false } }}>
          <App>
            <AwarenessIdentityProvider value={testIdentity}>
              <EditingScopeWorkspaceProvider workspaceId="ws-places">
                <LiveWorkflowEditor mode="edit" workflowUid={workflowState.uid} />
              </EditingScopeWorkspaceProvider>
            </AwarenessIdentityProvider>
          </App>
        </ConfigProvider>,
      );

    it('the places kept for the workflow are drawn as its editor mounts, and are no undo', async () => {
      kept.set(slot.key, { [workflowFixture.uid]: { stponly0: { x: 400, y: 80 } } });

      renderScoped();

      await waitFor(() => expect(placeOf('only')).toEqual(['400px', '80px']));
      expect(undoButton()).toHaveProperty('disabled', true);
      expect(arrangeButton()).toHaveProperty('disabled', false);
    });

    it('a move, its undo and Auto-arrange are each written there, by step uid', async () => {
      renderScoped();
      // The read that comes before any write.
      await act(async () => {});

      dragNode('only', 100, 50);
      await waitFor(() =>
        expect(kept.get(slot.key)).toEqual({ [workflowFixture.uid]: { stponly0: { x: 128, y: 72 } } }),
      );

      fireEvent.click(undoButton());
      await waitFor(() => expect(kept.get(slot.key)).toEqual({}));

      fireEvent.click(redoButton());
      await waitFor(() =>
        expect(kept.get(slot.key)).toEqual({ [workflowFixture.uid]: { stponly0: { x: 128, y: 72 } } }),
      );

      fireEvent.click(arrangeButton());
      await waitFor(() => expect(kept.get(slot.key)).toEqual({}));
    });
  });
});

describe('LiveWorkflowEditor — a run in the view', () => {
  it('a saved workflow with no run says so in its panel', () => {
    renderEditor();

    expect(screen.getByTestId('wf-run-empty').textContent).toBe('No run in this session yet. Press Run to start one.');
  });

  it('the header’s button is named Run, and its press carries an id of its own for the run', async () => {
    renderEditor();
    expect(screen.getByRole('button', { name: (name) => name.endsWith('Run') })).toBe(runButton());
    fireEvent.click(runButton());

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

// ── The header as the screen's toolbar ────────────────────────────
//
// The workflows redesign, Screen layout: after the name, one phrase for
// the run the view shows; then when the workflow runs, in a word that
// opens the workflow's panel at that setting; then Run.

describe('LiveWorkflowEditor — the header is the toolbar', () => {
  it('says when the workflow runs in a word, and a press of it shows the workflow at that setting', () => {
    renderEditor();
    const schedule = screen.getByTestId('wf-header-schedule');
    expect(schedule.textContent).toBe('Manual');

    openStep('only');
    expect(screen.queryByTestId('wf-panel-policy')).toBeNull();
    fireEvent.click(schedule);

    expect(screen.getByTestId('wf-panel-policy')).toBeTruthy();
    expect(screen.getByTestId('wf-graph-node-only').getAttribute('data-selected')).not.toBe('true');
  });

  it('a press of that word from History returns the panel to its Overview, at the setting', async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('wf-panel-tab-history'));
    expect(screen.queryByTestId('wf-panel-policy')).toBeNull();

    fireEvent.click(screen.getByTestId('wf-header-schedule'));

    await waitFor(() => expect(screen.getByTestId('wf-panel-policy')).toBeTruthy());
    expect(screen.getByTestId('wf-panel-tab-overview').getAttribute('aria-selected')).toBe('true');
  });

  it('says nothing of a run before one was seen', () => {
    renderEditor();

    expect(screen.queryByTestId('wf-header-status')).toBeNull();
  });

  it('a draft never saved has Run in view, off, with an (i) that says a save comes first', async () => {
    render(
      <App>
        <AwarenessIdentityProvider value={testIdentity}>
          <LiveWorkflowEditor mode="create" onCreated={vi.fn()} />
        </AwarenessIdentityProvider>
      </App>,
    );

    expect(runButton()).toHaveProperty('disabled', true);
    expect(screen.getByTestId('wf-header-schedule').textContent).toBe('Manual');
    fireEvent.click(screen.getByRole('button', { name: 'About Run' }));
    expect(await screen.findByText('Save the workflow to run it.')).toBeTruthy();
  });

  it('a draft never saved has run nowhere: its panel has its settings, no environments and no History', () => {
    render(
      <App>
        <AwarenessIdentityProvider value={testIdentity}>
          <LiveWorkflowEditor mode="create" onCreated={vi.fn()} />
        </AwarenessIdentityProvider>
      </App>,
    );

    expect(screen.getByTestId('wf-panel-policy')).toBeTruthy();
    expect(screen.queryByTestId('wf-run-status-strip')).toBeNull();
    expect(screen.queryByTestId('wf-panel-tab-history')).toBeNull();
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

  function renderUnavailable() {
    registerCapability('workflowRunUnavailable', () => true);
    return renderEditor();
  }

  afterEach(() => unregisterCapability('workflowRunUnavailable'));

  it('Run is in view, off, and a press starts no run', () => {
    renderUnavailable();

    expect(runButton()).toHaveProperty('disabled', true);
    fireEvent.click(runButton());
    expect(refreshNowMock).not.toHaveBeenCalled();
  });

  it('an (i) beside Run says where a workflow runs', async () => {
    renderUnavailable();
    fireEvent.click(screen.getByRole('button', { name: 'About Run' }));

    expect(await screen.findByText(SENTENCE)).toBeTruthy();
  });

  it('the workflow’s panel shows no run and has no History', () => {
    renderUnavailable();

    expect(screen.getByTestId('wf-graph-node-only')).toBeTruthy();
    expect(screen.queryByTestId('wf-run-empty')).toBeNull();
    expect(screen.getByTestId('wf-panel').textContent).not.toContain('Last run');
    expect(screen.queryByTestId('wf-panel-tab-history')).toBeNull();
  });

  it('with nothing declared there is no (i) and Run is on', () => {
    renderEditor();

    expect(screen.queryByRole('button', { name: 'About Run' })).toBeNull();
    expect(runButton()).toHaveProperty('disabled', false);
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
    expect(screen.queryByRole('button', { name: 'About Run' })).toBeNull();
    expect(runButton()).toHaveProperty('disabled', false);
    fireEvent.click(runButton());
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

  it('its environments speak of a run, not of live variables', () => {
    const { container } = renderWorkflow(sessionFixture);

    expect(container.textContent).toContain('not run yet — press Run');
    expect(container.textContent).not.toContain('bound:');
  });

  it('a workflow of calls keeps its binding count and its never-run line, on the active environment’s row', () => {
    const { container } = renderEditor();

    expect(container.textContent).toContain('never run for this env — press Run to populate');
    expect(container.textContent).toContain('bound:');
    expect(screen.getByTestId('wf-env-none').textContent).toBe(
      'No environment (active)never run for this env — press Run to populate',
    );
    expect(screen.getByTestId('wf-env-bound').textContent).toBe('bound: 0 variables');
  });

  it('a save with a step that has nothing picked names the step and stores nothing', async () => {
    renderWorkflow(sessionFixture);

    addCallStep();
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
    fireEvent.click(screen.getByRole('button', { name: 'About Runs' }));
    expect(await screen.findByText('A workflow with session steps runs when you press Run.')).toBeTruthy();
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
    expect(runButton()).toHaveProperty('disabled', true);
    expect(screen.getByTestId('wf-run-row-probe').getAttribute('data-run-state')).toBe('cannot-run');
  });

  it('where the host runs no session step, Run is off with an (i) that names the surface that runs it', async () => {
    const { container } = renderWorkflow(sessionFixture);

    expect(container.querySelector('[data-workflow-needs-update]')).toBeNull();
    expect(runButton()).toHaveProperty('disabled', true);
    fireEvent.click(runButton());
    expect(refreshNowMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'About Run' }));
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
    expect(runButton()).toHaveProperty('disabled', true);
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
