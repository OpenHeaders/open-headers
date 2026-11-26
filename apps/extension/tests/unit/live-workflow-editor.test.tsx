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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

// AntD Collapse (used inside WorkflowStepEditor) and several other
// AntD primitives rely on ResizeObserver via rc-resize-observer. jsdom
// doesn't ship one.
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

function renderEditor() {
  return render(
    <App>
      <AwarenessIdentityProvider value={testIdentity}>
        <LiveWorkflowEditor mode="edit" workflowUid={workflowState.uid} />
      </AwarenessIdentityProvider>
    </App>,
  );
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
    expect(container.querySelector('.ant-select-status-error')).toBeNull();
  });

  it('flags the step when its backing request was deleted', () => {
    // Request gone from the store, registry hydrated (`isReady`).
    requestsState = { requests: [], graphqlRequests: [], mqttRequests: [], collectionTrees: [], isReady: true };
    const { container } = renderEditor();
    expect(container.querySelector('.ant-select-status-error')).not.toBeNull();
  });

  it('does not flag the step while the request store is still loading', () => {
    // Empty requests but NOT ready — a cold store must not false-flag.
    requestsState = { requests: [], graphqlRequests: [], mqttRequests: [], collectionTrees: [], isReady: false };
    const { container } = renderEditor();
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

  function renderNeedsUpdate() {
    workflowState = needsUpdateFixture;
    requestsState = { ...requestsState, requests: [makeRequest({ uid: 'reqfixt1' })] };
    return renderEditor();
  }

  it('says so once, above the form', () => {
    renderNeedsUpdate();
    expect(screen.getAllByText(BANNER)).toHaveLength(1);
  });

  it('shows no banner on a workflow whose every step it knows', () => {
    renderEditor();
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it('shows each unknown step with the sentence and its raw action, and no request to pick', () => {
    const { container } = renderNeedsUpdate();

    const cards = Array.from(container.querySelectorAll('[data-step-needs-update]'));
    expect(cards.map((card) => card.getAttribute('data-step-card'))).toEqual(['probe', 'status']);
    for (const card of cards) {
      expect(card.textContent).toContain(STEP);
      expect(card.querySelector('.ant-select')).toBeNull();
      expect(card.querySelector('input')).toBeNull();
    }
    expect(cards[0].textContent).toContain('watch');
    expect(cards[1].textContent).toContain('verify');
  });

  it('takes no edit: the call step, the add-step button and Refresh are off', () => {
    const { container } = renderNeedsUpdate();

    const callCard = container.querySelector('[data-step-card="reboot"]');
    const controls = Array.from(callCard?.querySelectorAll('input, button') ?? []);
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect(control).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Step$/ })).toHaveProperty('disabled', true);
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

  it('draws the unknown steps in the preview with no edit gesture', () => {
    const { container } = renderNeedsUpdate();
    fireEvent.click(screen.getByText('Preview'));

    const nodes = Array.from(container.querySelectorAll('[data-needs-update]'));
    expect(nodes.map((node) => node.textContent)).toEqual([`probe${STEP}watch`, `status${STEP}verify`]);
    expect(screen.queryByRole('button', { name: /Step$/ })).toBeNull();
  });
});

describe('LiveWorkflowEditor — the Run view', () => {
  it('is the third view of a saved workflow and opens on the empty state', () => {
    renderEditor();
    fireEvent.click(screen.getByText('Run'));

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
    fireEvent.click(screen.getByText('Run'));

    expect(screen.getByTestId('wf-run-row-probe').getAttribute('data-run-state')).toBe('cannot-run');
    expect(screen.getByTestId('wf-run-row-reboot').getAttribute('data-run-state')).toBe('not-run');
    expect(screen.getByTestId('wf-run-row-status').getAttribute('data-run-state')).toBe('cannot-run');
  });
});

// ── A surface that runs no workflow ───────────────────────────────
//
// The workflow runs plan, Decisions log, S5: until the served tab runs
// its own chain it declares so, and every other surface — the cases
// above, with nothing declared — stays as it was.

describe('LiveWorkflowEditor — on a surface that runs no workflow', () => {
  const SENTENCE =
    'Workflows do not run in a browser tab yet. Use the desktop app or the browser extension to run one.';
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

  it('the workflow tab offers no Run view', () => {
    renderUnavailable();

    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.queryByText('Run')).toBeNull();
  });

  it('with nothing declared there is no (i) and Refresh is on', () => {
    renderEditor();

    expect(screen.queryByRole('button', { name: 'About Refresh' })).toBeNull();
    expect(refreshButton()).toHaveProperty('disabled', false);
  });
});

// ── A host that runs session steps ────────────────────────────────
//
// The workflow runs plan, Decisions log, S10: the desktop app declares
// that it runs `listen`, `send` and `expect`. There a workflow of known
// actions runs on a press and shows its run; its steps are still not
// edited. Every other surface — the cases above, with nothing declared —
// stays as it was.

describe('LiveWorkflowEditor — on a host that runs session steps', () => {
  const NEEDS_UPDATE = 'This workflow has steps that need a newer version of OpenHeaders. Update to edit or run it.';
  const RUNS_HERE = 'This workflow has session steps. It runs here; its steps cannot be edited in this version.';

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
    requestsState = { ...requestsState, requests: [makeRequest({ uid: 'reqfixt1' })] };
    return renderEditor();
  }

  afterEach(() => unregisterCapability('workflowSessionSteps'));

  it('a session-step workflow runs on a press, and the banner says it runs here', async () => {
    registerCapability('workflowSessionSteps', () => true);
    renderWorkflow(sessionFixture);

    expect(screen.getAllByText(RUNS_HERE)).toHaveLength(1);
    expect(screen.queryByText(NEEDS_UPDATE)).toBeNull();
    const refresh = screen.getByRole('button', { name: /Refresh/ });
    expect(refresh).toHaveProperty('disabled', false);
    fireEvent.click(refresh);
    await waitFor(() => expect(refreshNowMock).toHaveBeenCalledTimes(1));
  });

  it('its Run view opens on the empty state, not on a refusal', () => {
    registerCapability('workflowSessionSteps', () => true);
    renderWorkflow(sessionFixture);
    fireEvent.click(screen.getByText('Run'));

    expect(screen.getByTestId('wf-run-empty')).toBeTruthy();
  });

  it('its steps still take no edit', () => {
    registerCapability('workflowSessionSteps', () => true);
    const { container } = renderWorkflow(sessionFixture);

    const controls = Array.from(
      container.querySelector('[data-step-card="reboot"]')?.querySelectorAll('input, button') ?? [],
    );
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect(control).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Step$/ })).toHaveProperty('disabled', true);
  });

  it('a workflow with an action no build knows is still not run', () => {
    registerCapability('workflowSessionSteps', () => true);
    renderWorkflow(needsUpdateFixture);

    expect(screen.getAllByText(NEEDS_UPDATE)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Refresh/ })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByText('Run'));
    expect(screen.getByTestId('wf-run-row-probe').getAttribute('data-run-state')).toBe('cannot-run');
  });

  it('with nothing declared a session-step workflow needs a newer version', () => {
    renderWorkflow(sessionFixture);

    expect(screen.getAllByText(NEEDS_UPDATE)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Refresh/ })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByText('Run'));
    expect(screen.getByTestId('wf-run-row-probe').getAttribute('data-run-state')).toBe('cannot-run');
    expect(screen.getByTestId('wf-run-row-status').getAttribute('data-run-state')).toBe('cannot-run');
  });
});
