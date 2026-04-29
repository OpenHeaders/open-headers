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

import type { V5 } from '@openheaders/core/types';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// EditorHeader (rendered inside LiveWorkflowEditor) reads `keyboard.save`
// via useShortcutLabel; the registry is populated by importing the
// schema barrel for its side effects.
import '@/workbench/settings/schema';

// AntD Collapse (used inside WorkflowStepEditor) and several other
// AntD primitives rely on ResizeObserver via rc-resize-observer. jsdom
// doesn't ship one.
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

// ── Hook mocks ────────────────────────────────────────────────────
// Each mock provides the minimum slice LiveWorkflowEditor reads. The
// module paths match the `@hooks/*` alias configured in the extension
// package's vite / tsconfig.
const workflowFixture: V5.LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wftestfxt',
  path: 'live-workflows/test-fixture-wftestfxt',
  name: 'test fixture',
  enabled: true,
  refresh: { kind: 'manual' },
  steps: [
    {
      id: 'only',
      requestUid: 'reqtestfxt',
      captures: [{ name: 'v', extractor: { kind: 'whole-body' } }],
    },
  ],
};

vi.mock('@hooks/useLiveWorkflows', () => ({
  useLiveWorkflows: () => ({
    workflows: [workflowFixture],
    isReady: true,
    createWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    refreshNow: vi.fn(),
  }),
}));
vi.mock('@hooks/useLiveVariables', () => ({
  useLiveVariables: () => ({ variables: [], isReady: true }),
}));
vi.mock('@hooks/useRequests', () => ({
  useRequests: () => ({ requests: [], isReady: true }),
}));
vi.mock('@hooks/useEnvironments', () => ({
  useEnvironments: () => ({ activeEnvironmentId: null, environments: [], isReady: true }),
}));
vi.mock('@hooks/useLiveCache', () => ({
  useLiveWorkflowCache: () => ({ runs: [], isReady: true, reload: vi.fn() }),
}));

// Importing after vi.mock so the mocked hook modules resolve first.
const { default: LiveWorkflowEditor } = await import('@/workbench/components/live/LiveWorkflowEditor');

afterEach(() => {
  cleanup();
});

describe('LiveWorkflowEditor — show-but-disable', () => {
  it('renders the "Run independent steps in parallel" Switch as disabled + unchecked', () => {
    render(
      <App>
        <LiveWorkflowEditor mode="edit" workflowUid={workflowFixture.uid} />
      </App>,
    );

    const parallelSwitch = screen.getByRole('switch', { name: /Run independent steps in parallel/i });
    // AntD Switch disables both the native button and the ARIA state.
    expect(parallelSwitch).toHaveProperty('disabled', true);
    expect(parallelSwitch.getAttribute('aria-checked')).toBe('false');
  });
});
