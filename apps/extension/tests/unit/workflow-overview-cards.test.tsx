// @vitest-environment jsdom
/**
 * The last two cards of a workflow's own panel (the workflows redesign,
 * Workflow panel): Environments — how the last run left each
 * environment, the active one first — and Settings — when the workflow
 * runs, by hand or on a schedule of one of three kinds.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type { Environment, RefreshPolicy } from '@openheaders/core/types';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type React from 'react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  activeEnvironmentId: 'envstage' as string | null,
}));

function makeEnvironment(uid: string, name: string): Environment {
  return { schemaVersion: 5, uid, path: `environments/${name.toLowerCase()}-${uid}`, name, variables: [] };
}

vi.mock('@openheaders/ui/shared/hooks/readers/useEnvironments', () => ({
  useEnvironments: () => ({
    activeEnvironmentId: h.activeEnvironmentId,
    environments: [makeEnvironment('envstage', 'Staging'), makeEnvironment('envprod0', 'Production')],
    isReady: true,
  }),
}));

import WorkflowEnvironmentsCard from '@openheaders/ui/workbench/components/live/WorkflowEnvironmentsCard';
import WorkflowSettingsCard from '@openheaders/ui/workbench/components/live/WorkflowSettingsCard';

// The antd dropdown measures itself via rc-resize-observer; jsdom
// doesn't ship a ResizeObserver.
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

afterEach(() => {
  cleanup();
  h.activeEnvironmentId = 'envstage';
});

const MINUTE = 60_000;

function makeRun(overrides: Partial<LiveWorkflowRunSnapshot> = {}): LiveWorkflowRunSnapshot {
  return {
    workflowUid: 'wfcards1',
    environmentId: 'envstage',
    stepCaptures: {},
    extractedAt: Date.now() - 3 * MINUTE,
    expiresAt: null,
    stepResponseBytes: {},
    consecutiveFailures: 0,
    lastExtractorOk: true,
    circuit: {
      state: 'closed',
      consecutiveFailures: 0,
      consecutiveOpenings: 0,
      nextAttemptAt: null,
      halfOpenAttempts: 0,
      lastSuccessAt: null,
      lastErrorAt: null,
    },
    ...overrides,
  };
}

const MANUAL: RefreshPolicy = { kind: 'manual' };

describe('the Environments card', () => {
  it('lists the active environment first, then the others newest first, each with when it last ran', () => {
    render(
      <WorkflowEnvironmentsCard
        runs={[
          makeRun({ environmentId: null, extractedAt: Date.now() - 90 * MINUTE }),
          makeRun({ environmentId: 'envprod0', extractedAt: Date.now() - 10 * MINUTE }),
          makeRun(),
        ]}
        refresh={MANUAL}
        boundCount={2}
        verdictOnly={false}
      />,
    );

    const card = screen.getByTestId('wf-run-status-strip');
    const rows = Array.from(card.querySelectorAll('[data-testid^="wf-env-"].oh-wf-card-row'));
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'wf-env-envstage',
      'wf-env-envprod0',
      'wf-env-none',
    ]);
    expect(rows[0].textContent).toBe('Staging (active)last 3m ago · runs manually');
    expect(rows[0].getAttribute('data-active')).toBe('true');
    expect(rows[1].textContent).toBe('Productionlast 10m ago · runs manually');
    expect(rows[2].textContent).toBe('No environmentlast 1h 30m ago · runs manually');
    expect(screen.getByTestId('wf-env-bound').textContent).toBe('bound: 2 variables');
  });

  it('shows the active environment before its first run, beside one that has run', () => {
    h.activeEnvironmentId = 'envprod0';
    render(<WorkflowEnvironmentsCard runs={[makeRun()]} refresh={MANUAL} boundCount={1} verdictOnly={false} />);

    expect(screen.getByTestId('wf-env-envprod0').textContent).toBe(
      'Production (active)never run for this env — press Run to populate',
    );
    expect(screen.getByTestId('wf-env-envstage').textContent).toBe('Staginglast 3m ago · runs manually');
  });

  it('says when a scheduled workflow runs again, a paused circuit, the last error with its step, and a stale value', () => {
    const now = Date.now();
    render(
      <WorkflowEnvironmentsCard
        runs={[
          makeRun({
            expiresAt: now + 2 * MINUTE + 30_000,
            consecutiveFailures: 3,
            lastErrorMessage: 'HTTP 401',
            lastErrorStepId: 'login',
            definitionallyStale: true,
            circuit: {
              state: 'open',
              consecutiveFailures: 3,
              consecutiveOpenings: 1,
              nextAttemptAt: now + 12 * MINUTE - 5_000,
              halfOpenAttempts: 0,
              lastSuccessAt: null,
              lastErrorAt: now - MINUTE,
            },
          }),
        ]}
        refresh={{ kind: 'interval', seconds: 300 }}
        boundCount={1}
        verdictOnly={false}
      />,
    );

    expect(screen.getByTestId('wf-env-envstage').textContent).toBe(
      'Staging (active)last 3m ago · runs again in 2m · paused · next attempt in 12m · HTTP 401 (login) · needs re-run',
    );
  });

  it('a workflow that gives a verdict says nothing of bindings, and its never-run line names no live variable', () => {
    render(<WorkflowEnvironmentsCard runs={[]} refresh={MANUAL} boundCount={0} verdictOnly />);

    expect(screen.queryByTestId('wf-env-bound')).toBeNull();
    expect(screen.getByTestId('wf-env-envstage').textContent).toBe('Staging (active)not run yet — press Run');
  });
});

const CAPTURES = [{ stepId: 'login', captureName: 'expires', label: 'login · expires' }];

const SettingsHarness: React.FC<{
  initial: RefreshPolicy;
  holdsSession?: boolean;
  onRefresh?: (next: RefreshPolicy) => void;
}> = ({ initial, holdsSession = false, onRefresh }) => {
  const [refresh, setRefresh] = useState(initial);
  const [enabled, setEnabled] = useState(true);
  return (
    <WorkflowSettingsCard
      refresh={refresh}
      onRefreshChange={(next) => {
        setRefresh(next);
        onRefresh?.(next);
      }}
      enabled={enabled}
      onEnabledChange={setEnabled}
      availableCaptures={CAPTURES}
      holdsSession={holdsSession}
    />
  );
};

function pick(testId: string, option: string): void {
  const combobox = within(screen.getByTestId(testId)).getByRole('combobox');
  fireEvent.mouseDown(combobox);
  fireEvent.click(combobox);
  fireEvent.click(screen.getByText(option, { selector: '.ant-select-item-option-content' }));
}

describe('the Settings card', () => {
  it('a workflow run by hand shows Runs alone, with both switches', () => {
    render(<SettingsHarness initial={MANUAL} />);

    const card = screen.getByTestId('wf-panel-policy');
    expect(within(card).getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByTestId('wf-settings-runs').textContent).toContain('Manual only');
    expect(screen.queryByTestId('wf-settings-schedule')).toBeNull();
    expect(within(card).getByRole('switch', { name: 'Workflow enabled' }).getAttribute('aria-checked')).toBe('true');
    expect(within(card).getByRole('switch', { name: 'Run independent steps in parallel' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByTestId('wf-form-session-verdict')).toBeNull();
  });

  it('On a schedule starts at a fixed interval of five minutes and offers the three kinds', () => {
    const onRefresh = vi.fn();
    render(<SettingsHarness initial={MANUAL} onRefresh={onRefresh} />);

    pick('wf-settings-runs', 'On a schedule');

    expect(onRefresh).toHaveBeenLastCalledWith({ kind: 'interval', seconds: 300 });
    expect(screen.getByTestId('wf-settings-schedule').textContent).toContain('Fixed interval');
    expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Fixed interval' }).value).toBe('5 min');

    pick('wf-settings-schedule', 'Expires in N seconds (relative)');

    expect(onRefresh).toHaveBeenLastCalledWith({
      kind: 'expires-in',
      stepId: 'login',
      captureName: 'expires',
      leadSeconds: 30,
    });
    expect(screen.getByTestId('wf-settings-capture').textContent).toContain('login · expires');
    expect(screen.getByTestId('wf-panel-policy').textContent).toContain('The workflow runs `lead` seconds before');
  });

  it('Manual only takes a scheduled workflow back to a run by hand', () => {
    const onRefresh = vi.fn();
    render(
      <SettingsHarness
        initial={{ kind: 'expires-at', stepId: 'login', captureName: 'expires', leadSeconds: 30 }}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByTestId('wf-settings-runs').textContent).toContain('On a schedule');
    pick('wf-settings-runs', 'Manual only');

    expect(onRefresh).toHaveBeenLastCalledWith({ kind: 'manual' });
    expect(screen.queryByTestId('wf-settings-schedule')).toBeNull();
  });

  it('a workflow that holds a session step has Runs fixed, says why at its head, and what it gives at its foot', () => {
    render(<SettingsHarness initial={MANUAL} holdsSession />);

    expect(within(screen.getByTestId('wf-settings-runs')).getByRole('combobox')).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'About Runs' })).toBeTruthy();
    expect(screen.getByTestId('wf-form-session-verdict').textContent).toBe(
      'A workflow with session steps gives a verdict; its captures are not exposed as live variables.',
    );
  });
});
