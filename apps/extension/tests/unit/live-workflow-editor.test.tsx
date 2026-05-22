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

import type { LiveWorkflow, Request } from '@openheaders/core/types';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from 'antd';
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

vi.mock('@openheaders/ui/shared/hooks/useLiveWorkflows', () => ({
  useLiveWorkflows: () => ({
    workflows: [workflowFixture],
    isReady: true,
    createWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    refreshNow: vi.fn(),
  }),
}));
vi.mock('@openheaders/ui/shared/hooks/useLiveVariables', () => ({
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
let requestsState: { requests: Request[]; collectionTrees: unknown[]; isReady: boolean } = {
  requests: [makeRequest()],
  collectionTrees: [],
  isReady: true,
};

vi.mock('@openheaders/ui/shared/hooks/useRequests', () => ({
  useRequests: () => requestsState,
}));
vi.mock('@openheaders/ui/shared/hooks/useEnvironments', () => ({
  useEnvironments: () => ({ activeEnvironmentId: null, environments: [], isReady: true }),
}));
vi.mock('@openheaders/ui/shared/hooks/useLiveCache', () => ({
  useLiveWorkflowCache: () => ({ runs: [], isReady: true, reload: vi.fn() }),
}));

// Importing after vi.mock so the mocked hook modules resolve first.
const { default: LiveWorkflowEditor } = await import('@openheaders/ui/workbench/components/live/LiveWorkflowEditor');
const { AwarenessIdentityProvider } = await import('@openheaders/ui/shared/awareness');
const { resolveWorkbenchIdentity } = await import('@/host/surface-identity-resolvers');
const testIdentity = resolveWorkbenchIdentity();

afterEach(() => {
  cleanup();
  requestsState = { requests: [makeRequest()], collectionTrees: [], isReady: true };
});

function renderEditor() {
  return render(
    <App>
      <AwarenessIdentityProvider value={testIdentity}>
        <LiveWorkflowEditor mode="edit" workflowUid={workflowFixture.uid} />
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
    requestsState = { requests: [], collectionTrees: [], isReady: true };
    const { container } = renderEditor();
    expect(container.querySelector('.ant-select-status-error')).not.toBeNull();
  });

  it('does not flag the step while the request store is still loading', () => {
    // Empty requests but NOT ready — a cold store must not false-flag.
    requestsState = { requests: [], collectionTrees: [], isReady: false };
    const { container } = renderEditor();
    expect(container.querySelector('.ant-select-status-error')).toBeNull();
  });
});
