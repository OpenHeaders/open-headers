/**
 * Coverage for {@link WorkflowStepEditor} — Phase I extensions.
 *
 * The editor is big; these tests target the new surfaces:
 *   1. Show-but-disable catalog — step-type selector (Foreach + Composite
 *      options disabled).
 *   2. `Depends on` section presence + clear button emission.
 *   3. Priority row `Clear` emits `priorityFrom: undefined`.
 *   4. `Run condition` count badge reflects the gate's clause count.
 *   5. A call's Success criteria, Poll, Retry policy and Timeout cards —
 *      what each holds + edit/clear emission.
 *
 * Existing behavior (request select, captures, reorder) stays under the
 * legacy suite — this file is scoped to the new fields.
 *
 * Queries use Testing Library's semantic roles + ARIA state attributes
 * wherever AntD exposes them (role="button" + aria-disabled on Collapse
 * headers; aria-disabled on dropdown options). Where AntD has an a11y
 * gap (Select visible options lack role="option"), the pragmatic fallback
 * is text search + closest('[aria-disabled]') — still semantic
 * (aria-disabled is an ARIA state) without touching AntD's class names.
 */

import type { DraftCallStep, DraftKnownStep, StructuralError } from '@openheaders/core/live';
import type {
  Criterion,
  ExpectWorkflowStep,
  ListenWorkflowStep,
  MqttRequest,
  SendWorkflowStep,
  StepGate,
} from '@openheaders/core/types';
import type { StepMiniFacts } from '@openheaders/ui/workbench/components/live/StepMiniRow';
import type { StepMark } from '@openheaders/ui/workbench/components/live/step-mark';
import WorkflowStepEditor, {
  type StepDependencies,
} from '@openheaders/ui/workbench/components/live/WorkflowStepEditor';
import WorkflowStepHeader from '@openheaders/ui/workbench/components/live/WorkflowStepHeader';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// jsdom doesn't provide ResizeObserver, which Ant Design's Collapse
// (via rc-resize-observer) expects. Tests that render a Collapse need
// this shim; a minimal stub is enough — we don't assert on resize events.
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
});

function mkStep(overrides: Partial<DraftCallStep> = {}): DraftCallStep {
  return { uid: 'stprefrs', id: 'refresh', requestUid: 'reqrefrsh', captures: [], ...overrides };
}

/** Resolve an InputNumber's editable `<input>` from its testid — AntD may
 *  stamp the data attribute on the inner input or on a wrapper. */
function numberInput(testId: string): HTMLInputElement | null {
  const el = screen.getByTestId(testId);
  if (el.tagName === 'INPUT') return el as HTMLInputElement;
  return el.querySelector('input');
}

/** What a case may set: the fields' own props, and the two the panel's head takes beside them. */
type StepPanelOverrides = Partial<React.ComponentProps<typeof WorkflowStepEditor>> &
  Pick<React.ComponentProps<typeof WorkflowStepHeader>, 'sessionAuthoring' | 'onActionChange'>;

const IDLE: StepMark = { kind: 'idle', text: '', label: 'Not part of a successful run yet' };
const INTROSPECT: StepMiniFacts = { id: 'introspect', uid: 'stpintro', mark: IDLE, protocol: 'http' };

/** Where the step stands: it waits for `introspect`, and nothing waits for it. */
function dependenciesOf(overrides: Partial<StepDependencies> = {}): StepDependencies {
  return {
    parents: [INTROSPECT],
    dependents: [],
    addable: [],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onGoToStep: vi.fn(),
    ...overrides,
  };
}

/** A step as its panel shows it: the head, and under it the step's cards. */
function renderStep(step: DraftKnownStep, propOverrides: StepPanelOverrides = {}) {
  const onChange = vi.fn();
  const dependencies = dependenciesOf();
  const { sessionAuthoring, onActionChange, ...fieldOverrides } = propOverrides;
  render(
    <>
      <WorkflowStepHeader
        step={step}
        index={1}
        totalSteps={2}
        mark={IDLE}
        protocol={null}
        does={{ text: '' }}
        sessionAuthoring={sessionAuthoring}
        errors={fieldOverrides.errors ?? []}
        onChange={onChange}
        onActionChange={onActionChange}
      />
      <WorkflowStepEditor
        step={step}
        index={1}
        availableRequests={[
          { uid: 'reqrefrsh', name: 'refresh', method: 'POST', collectionName: 'auth', folderTrail: ['oauth'] },
        ]}
        onChange={onChange}
        dependencies={dependencies}
        reachableSteps={[{ id: 'introspect', label: 'introspect' }]}
        capturesByStepId={new Map([['introspect', ['active', 'exp']]])}
        errors={[]}
        {...fieldOverrides}
      />
    </>,
  );
  return { onChange, dependencies: fieldOverrides.dependencies ?? dependencies };
}

describe('WorkflowStepEditor — Depends on and Required by', () => {
  const deps = () => screen.getByTestId('wf-step-1-deps');

  it('a step that names none shows the step before it, and says that is the default', () => {
    renderStep(mkStep());
    expect(within(deps()).getByTestId('wf-step-1-dep-introspect').textContent).toBe('introspectHTTP');
    expect(deps().textContent).toContain('By default it waits for the step before it.');
    expect(within(deps()).queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('a step that waits for nothing says it starts with the workflow', () => {
    renderStep(mkStep({ dependsOn: [] }), { dependencies: dependenciesOf({ parents: [] }) });
    expect(deps().textContent).toContain('Nothing. This step starts with the workflow.');
    expect(screen.getByTestId('gate-summary').textContent).toBe(
      'No dependencies, so this step runs when the workflow starts.',
    );
  });

  it('Reset goes back to naming none', () => {
    const { onChange } = renderStep(mkStep({ dependsOn: ['introspect'] }));
    expect(deps().textContent).toContain('Chosen for this step.');
    fireEvent.click(within(deps()).getByRole('button', { name: 'Reset' }));
    const last = onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect('dependsOn' in last).toBe(false);
  });

  it('Add names one more step, and the × on a row drops that one', () => {
    const { dependencies } = renderStep(mkStep(), { dependencies: dependenciesOf({ addable: ['probe'] }) });
    openSelect('wf-step-1-deps-select');
    pickOption('probe');
    expect(dependencies.onAdd).toHaveBeenCalledWith('probe');
    fireEvent.click(screen.getByRole('button', { name: 'Remove dependency introspect' }));
    expect(dependencies.onRemove).toHaveBeenCalledWith('introspect');
  });

  it('Add is off where there is no other step to wait for', () => {
    renderStep(mkStep());
    expect(within(screen.getByTestId('wf-step-1-deps-select')).getByRole('combobox')).toHaveProperty('disabled', true);
  });

  it('a row opens its step, and says how the last run left it', () => {
    const passed: StepMark = { kind: 'passed', text: '200 · 10 ms', label: '200 · 10 ms' };
    const { dependencies } = renderStep(mkStep(), {
      dependencies: dependenciesOf({
        parents: [{ ...INTROSPECT, mark: passed }],
        dependents: [{ id: 'report', uid: 'stpreprt', mark: IDLE, protocol: null }],
      }),
    });
    expect(screen.getByTestId('wf-step-1-dep-introspect').textContent).toBe('introspectHTTPPassed');
    fireEvent.click(within(screen.getByTestId('wf-step-1-dependent-report')).getByRole('button'));
    expect(dependencies.onGoToStep).toHaveBeenCalledWith('stpreprt');
  });

  it('a dependency that is no step is a row that opens nothing, with the validator’s sentence under it', () => {
    renderStep(mkStep({ dependsOn: ['ghost'] }), {
      dependencies: dependenciesOf({ parents: [{ id: 'ghost', mark: IDLE, protocol: null }] }),
      errors: [
        { issue: 'step-unknown-dep', stepId: 'refresh', message: 'Step "refresh" depends on unknown step "ghost".' },
      ],
    });
    const row = within(screen.getByTestId('wf-step-1-dep-ghost')).getAllByRole('button')[0];
    expect(row).toHaveProperty('disabled', true);
    expect(deps().textContent).toContain('Step "refresh" depends on unknown step "ghost".');
  });

  it('nothing waits for a step no other one names', () => {
    renderStep(mkStep());
    expect(screen.getByTestId('wf-step-1-required-by').textContent).toContain('Nothing waits for this step.');
  });
});

describe('WorkflowStepEditor — Run condition', () => {
  const gate: StepGate = {
    all: [
      { uid: 'gat0sta1', kind: 'status', stepId: 'introspect', match: '2xx' },
      { uid: 'gat0ex01', kind: 'capture-exists', stepId: 'introspect', captureName: 'active' },
    ],
  };

  it('reads the logic back at its foot', () => {
    renderStep(mkStep({ runIf: gate }));
    expect(screen.getByTestId('gate-summary').textContent).toBe(
      'Runs when every condition holds: introspect 2xx · introspect active exists.',
    );
    cleanup();
    renderStep(mkStep());
    expect(screen.getByTestId('gate-summary').textContent).toBe(
      'No conditions — step runs whenever its dependencies complete.',
    );
  });

  it('says of each clause whether it held in the last run, and a dash where no run judged it', () => {
    renderStep(mkStep({ runIf: gate }));
    expect(screen.getByTestId('gate-clause-0-truth').textContent).toBe('—');
    cleanup();
    renderStep(mkStep({ runIf: gate }), { clauseTruth: (uid) => (uid === 'gat0ex01' ? 'false' : 'true') });
    expect(screen.getByTestId('gate-clause-0-truth').textContent).toBe('True');
    expect(screen.getByTestId('gate-clause-1-truth').textContent).toBe('False');
  });

  it('adds a clause from the card’s head and removes one from its row', () => {
    const { onChange } = renderStep(mkStep({ runIf: gate }));
    const card = screen.getByTestId('wf-step-1-runif');
    fireEvent.click(within(card).getByRole('button', { name: 'Add condition' }));
    const added = onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(added.runIf?.all).toHaveLength(3);
    fireEvent.click(within(card).getByRole('button', { name: 'Remove clause 2' }));
    const removed = onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(removed.runIf?.all).toEqual([gate.all[0]]);
  });
});

describe('WorkflowStepEditor — a call’s sections', () => {
  // ── Show-but-disable catalog ────────────────────────────────────────
  // Each of these assertions verifies a future-feature affordance is
  // surfaced in v1 with a disabled state — the plan's show-but-disable
  // contract (the live-orchestration plan §UI).

  it('step-type selector marks Foreach + Composite as aria-disabled options', () => {
    renderStep(mkStep());

    // Step-type selector is the first combobox in render order — it sits
    // in the panel's head, before the REQUEST selector. The underlying
    // request's requestUid is already bound so its Select also renders,
    // but after the step-type one. AntD's visible options lack role="option"
    // (a11y gap); we locate each visible option by text and check the
    // `aria-disabled` ancestor.
    const comboboxes = screen.getAllByRole('combobox');
    const stepTypeCombobox = comboboxes[0];
    fireEvent.mouseDown(stepTypeCombobox);
    fireEvent.click(stepTypeCombobox);

    for (const label of ['Foreach', 'Composite']) {
      const node = screen.getByText(label);
      const option = node.closest('[aria-disabled]');
      expect(option?.getAttribute('aria-disabled'), `"${label}" option should be aria-disabled=true`).toBe('true');
    }
  });

  // ── The Retry policy and Timeout cards ──────────────────────────────

  it('a call’s four cards are open under its Request, each unset until its first field holds a number', () => {
    renderStep(mkStep());
    for (const title of ['Success criteria', 'Poll', 'Retry policy', 'Timeout']) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }
    expect(numberInput('wf-step-1-retry-attempts')?.placeholder).toBe('No retry');
    expect(numberInput('wf-step-1-retry-delay')).toHaveProperty('disabled', true);
    expect(numberInput('wf-step-1-poll-attempts')?.placeholder).toBe('No poll');
    expect(numberInput('wf-step-1-poll-delay')).toHaveProperty('disabled', true);
    expect(numberInput('wf-step-1-timeout')?.placeholder).toBe('No timeout');
    expect(screen.queryByRole('button', { name: /^Clear$/ })).toBeNull();
  });

  it('the Retry policy card holds the policy: its attempts, its backoff, and a Clear that removes it', () => {
    const { onChange } = renderStep(mkStep({ retry: { maxAttempts: 4, backoff: 'exponential' } }));
    const card = screen.getByTestId('wf-step-1-retry');
    expect(numberInput('wf-step-1-retry-attempts')?.value).toBe('4');
    expect(numberInput('wf-step-1-retry-delay')).toHaveProperty('disabled', false);
    expect(screen.getByTestId('wf-step-1-retry-backoff').textContent).toContain('Exponential');
    fireEvent.click(within(card).getByRole('button', { name: /^Clear$/ }));
    const last = onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.retry).toBeUndefined();
  });

  it('setting attempts creates a policy; clearing the field removes it', () => {
    const { onChange } = renderStep(mkStep({ retry: { maxAttempts: 3 } }));
    const attempts = numberInput('wf-step-1-retry-attempts');
    expect(attempts).not.toBeNull();
    fireEvent.change(attempts as HTMLInputElement, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retry: { maxAttempts: 5 } }));
    fireEvent.change(attempts as HTMLInputElement, { target: { value: '' } });
    const last = onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.retry).toBeUndefined();
  });

  it('the Timeout card holds the ceiling; editing the field emits timeoutMs', () => {
    const { onChange } = renderStep(mkStep({ timeoutMs: 10_000 }));
    const input = numberInput('wf-step-1-timeout');
    expect(input?.value).toBe('10000');
    fireEvent.change(input as HTMLInputElement, { target: { value: '2500' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 2500 }));
  });

  it('Timeout Clear button removes the ceiling', () => {
    const { onChange } = renderStep(mkStep({ timeoutMs: 5_000 }));
    fireEvent.click(within(screen.getByTestId('wf-step-1-timeout-section')).getByRole('button', { name: /^Clear$/ }));
    const last = onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.timeoutMs).toBeUndefined();
  });

  // ── The Request card ────────────────────────────────────────────────

  it('names the request it sends: its method, and where it is kept', () => {
    renderStep(mkStep());
    expect(screen.getByRole('heading', { name: 'Request' })).toBeTruthy();
    expect(screen.getByTestId('wf-step-1-request-meta').textContent).toBe('POSTin auth › oauth');
    cleanup();
    renderStep(mkStep({ requestUid: 'reqgone00' }));
    expect(screen.queryByTestId('wf-step-1-request-meta')).toBeNull();
  });

  it('Open request opens the request’s tab, and is off where the step names none', () => {
    const onOpenRequest = vi.fn();
    renderStep(mkStep(), { onOpenRequest });
    fireEvent.click(screen.getByRole('button', { name: 'Open request' }));
    expect(onOpenRequest).toHaveBeenCalledTimes(1);
    cleanup();
    renderStep(mkStep());
    expect(screen.getByRole('button', { name: 'Open request' })).toHaveProperty('disabled', true);
  });

  it('ticking the scripts checkbox emits runScripts: true; unticking removes the field', () => {
    const { onChange } = renderStep(mkStep());
    expect(screen.queryByRole('button', { name: /^Scripts/ })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Run the request's scripts/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ runScripts: true }));
    cleanup();
    const optedIn = renderStep(mkStep({ runScripts: true }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Run the request's scripts/i }));
    const last = optedIn.onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.runScripts).toBeUndefined();
  });

  // ── The Success criteria and Poll cards ─────────────────────────────

  it('the Success criteria card says what none means, then holds a row per criterion', () => {
    renderStep(mkStep());
    const empty = screen.getByTestId('wf-step-1-criteria');
    expect(empty.textContent).toContain('The response passes when every row holds.');
    expect(empty.textContent).toContain('No criteria — any response that arrives passes.');
    expect(screen.queryByTestId('wf-step-1-criterion-0')).toBeNull();
    cleanup();
    renderStep(
      mkStep({
        successCriteria: [
          { kind: 'status', uid: 'crtstat0', match: '2xx' },
          { kind: 'exists', uid: 'crtname0', extractor: { kind: 'json-path', path: '$.name' } },
        ],
      }),
    );
    expect(screen.getByTestId('wf-step-1-criterion-0').textContent).toContain('Status code');
    expect(screen.getByTestId('wf-step-1-criterion-1')).toBeTruthy();
    expect(screen.queryByTestId('wf-step-1-criterion-2')).toBeNull();
    expect(screen.queryByText('No criteria — any response that arrives passes.')).toBeNull();
  });

  it('adding a criterion emits a status row; removing the last one removes the field', () => {
    const { onChange } = renderStep(mkStep());
    fireEvent.click(screen.getByRole('button', { name: /Add criterion/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ successCriteria: [{ kind: 'status', uid: expect.any(String), match: '2xx' }] }),
    );
    cleanup();
    const held = renderStep(mkStep({ successCriteria: [{ kind: 'status', uid: 'crtstat0', match: '2xx' }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove criterion 1' }));
    const last = held.onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.successCriteria).toBeUndefined();
  });

  it('editing an equals row’s value emits the row with its extractor kept', () => {
    const criterion: Criterion = {
      kind: 'equals',
      uid: 'crtname0',
      extractor: { kind: 'json-path', path: '$.name' },
      value: '',
    };
    const { onChange } = renderStep(mkStep({ successCriteria: [criterion] }));
    fireEvent.change(screen.getByTestId('wf-step-1-criterion-0-value'), { target: { value: '{{step.rename.name}}' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ successCriteria: [{ ...criterion, value: '{{step.rename.name}}' }] }),
    );
  });

  it('the Poll card holds its two numbers; setting attempts starts a poll, Clear ends it', () => {
    const { onChange } = renderStep(mkStep());
    expect(screen.getByTestId('wf-step-1-poll').textContent).toContain(
      'Sends the request again until its success criteria hold.',
    );
    fireEvent.change(numberInput('wf-step-1-poll-attempts') as HTMLInputElement, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ poll: { maxAttempts: 10, delayMs: 1_000 } }));
    cleanup();
    const polled = renderStep(mkStep({ poll: { maxAttempts: 10, delayMs: 200 } }));
    expect(numberInput('wf-step-1-poll-attempts')?.value).toBe('10');
    expect(numberInput('wf-step-1-poll-delay')?.value).toBe('200');
    fireEvent.change(numberInput('wf-step-1-poll-delay') as HTMLInputElement, { target: { value: '500' } });
    expect(polled.onChange).toHaveBeenCalledWith(expect.objectContaining({ poll: { maxAttempts: 10, delayMs: 500 } }));
    fireEvent.click(within(screen.getByTestId('wf-step-1-poll')).getByRole('button', { name: /^Clear$/ }));
    const last = polled.onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.poll).toBeUndefined();
  });

  it('a poll’s issue is said in its card, and an issue no field owns under the panel’s head', () => {
    renderStep(mkStep({ poll: { maxAttempts: 10, delayMs: 200 } }), {
      errors: [
        {
          issue: 'poll-without-criteria',
          stepId: 'refresh',
          message: 'Step "refresh" polls with no success criteria to wait for.',
        },
        {
          issue: 'duplicate-capture-name',
          stepId: 'refresh',
          referencedCaptureName: 'token',
          message: 'Duplicate capture name "token" in step "refresh".',
        },
      ],
    });
    const foot = screen.getByTestId('wf-step-1-issues');
    expect(foot.textContent).toBe('Duplicate capture name "token" in step "refresh".');
    expect(screen.getByTestId('wf-step-1-poll').textContent).toContain(
      'Step "refresh" polls with no success criteria to wait for.',
    );
  });
});

// ── A session step's card ───────────────────────────────────────────
//
// The workflow runs plan, Decisions log, S16: the type selector is the
// action, and a listen, a send and an expect each have their own fields
// under the head and the sections every step shares.

const LISTEN: ListenWorkflowStep = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttreq1',
  timeoutMs: 10_000,
  captures: [],
};
const REBOOT: DraftCallStep = { uid: 'stpcall0', id: 'reboot', requestUid: 'reqrefrsh', captures: [] };
const SEND: SendWorkflowStep = {
  uid: 'stpsend0',
  id: 'rename',
  action: 'send',
  on: 'probe',
  messageUid: 'msgname1',
  captures: [],
};
const EXPECT: ExpectWorkflowStep = {
  uid: 'stpexpct',
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: 'devices/dev-1/status',
  match: [],
  timeoutMs: 10_000,
  captures: [],
};

function makeMqttRequest(overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqttreq1',
    path: 'api-requests/probe-mqttreq1',
    name: 'Probe MQTT',
    url: 'ws://openheaders.io/mqtt',
    topic: '',
    payload: '',
    topics: [],
    savedMessages: [
      { uid: 'msgname1', name: 'Rename', topic: 'devices/dev-1/name', payload: 'John Doe' },
      { uid: 'msgping1', name: 'Ping', topic: 'devices/dev-1/ping', payload: '' },
    ],
    userProperties: [],
    ...overrides,
  };
}

function renderSession(
  step: DraftKnownStep,
  propOverrides: Partial<React.ComponentProps<typeof WorkflowStepEditor>> = {},
) {
  return renderStep(step, {
    steps: [LISTEN, REBOOT, SEND, EXPECT],
    mqttRequests: [makeMqttRequest()],
    sessionRequests: [
      { uid: 'mqttreq1', name: 'Probe MQTT', method: 'MQTT', kind: 'mqtt', collectionName: 'devices', folderTrail: [] },
    ],
    ...propOverrides,
  });
}

/** Open a Select from its testid — AntD stamps the data attribute on the control's root. */
function openSelect(testId: string): void {
  const combobox = within(screen.getByTestId(testId)).getByRole('combobox');
  fireEvent.mouseDown(combobox);
  fireEvent.click(combobox);
}

/** Press an open Select's option. AntD draws each option twice — an accessible list entry and the visible row; the row takes the press. */
function pickOption(label: string): void {
  fireEvent.click(screen.getByText(label, { selector: '.ant-select-item-option-content' }));
}

function issue(overrides: Pick<StructuralError, 'issue' | 'stepId' | 'message'>): StructuralError {
  return overrides;
}

describe('WorkflowStepEditor — the type selector is the action', () => {
  it('offers a call alone until the surface authors session steps', () => {
    renderStep(mkStep());
    openSelect('wf-step-1-action');
    expect(screen.queryByText('Listen')).toBeNull();
    expect(screen.queryByText('Send')).toBeNull();
    expect(screen.queryByText('Wait')).toBeNull();
  });

  it('offers Listen, Send and Wait where it does, and hands the pick to its owner', () => {
    const onActionChange = vi.fn();
    renderStep(mkStep(), { sessionAuthoring: true, onActionChange });
    openSelect('wf-step-1-action');
    pickOption('Wait');
    expect(onActionChange).toHaveBeenCalledWith('expect');
  });

  it('shows a session step under its own action whether or not session steps are authored here', () => {
    renderSession(LISTEN);
    expect(screen.getByTestId('wf-step-1-action').textContent).toContain('Listen');
    openSelect('wf-step-1-action');
    expect(screen.queryByText('Send')).toBeNull();
    expect(screen.queryByText('Wait')).toBeNull();
  });
});

describe('WorkflowStepEditor — a listen', () => {
  it('has its request, its deadline, its scripts and the shared sections — and nothing to capture', () => {
    renderSession(LISTEN);
    expect(screen.getByRole('heading', { name: 'Connection' })).toBeTruthy();
    expect(screen.getByTestId('wf-step-1-connection').textContent).toContain('Stays open until the run ends.');
    expect(screen.getByTestId('wf-step-1-session-request').textContent).toContain('Probe MQTT');
    expect(numberInput('wf-step-1-ready-within')?.value).toBe('10000');
    expect(screen.queryByRole('button', { name: '+ Capture' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Depends on' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Run condition' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Priority/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Retry policy' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Success criteria' })).toBeNull();
  });

  it('emits its deadline and its scripts checkbox', () => {
    const { onChange } = renderSession(LISTEN);
    fireEvent.change(numberInput('wf-step-1-ready-within') as HTMLInputElement, { target: { value: '2500' } });
    expect(onChange).toHaveBeenCalledWith({ ...LISTEN, timeoutMs: 2500 });
    fireEvent.click(screen.getByRole('checkbox', { name: /Run the request's scripts/i }));
    expect(onChange).toHaveBeenLastCalledWith({ ...LISTEN, runScripts: true });
  });

  it('Open request opens the session request’s tab', () => {
    const onOpenRequest = vi.fn();
    renderSession(LISTEN, { onOpenRequest });
    fireEvent.click(screen.getByRole('button', { name: 'Open request' }));
    expect(onOpenRequest).toHaveBeenCalledTimes(1);
  });

  it('says who the session connects as, from the request', () => {
    renderSession(LISTEN);
    expect(screen.getByTestId('wf-step-1-identity').textContent).toContain('Client ID generated · Clean start');
    cleanup();
    renderSession(LISTEN, {
      mqttRequests: [makeMqttRequest({ clientId: 'probe-1', cleanStart: false, sessionExpiryInterval: 300 })],
    });
    expect(screen.getByTestId('wf-step-1-identity').textContent).toContain(
      'Client ID set on the request · Session Expiry Interval 300 s',
    );
  });

  it('marks a request that is gone, and not one that was never picked', () => {
    const missing = issue({
      issue: 'listen-request-missing',
      stepId: 'probe',
      message: 'Step "probe" names a session request that is not an MQTT request in this workspace.',
    });
    renderSession(LISTEN, { errors: [missing], mqttRequests: [] });
    expect(screen.getByTestId('wf-step-1-session-request').className).toContain('ant-select-status-error');
    expect(screen.queryByTestId('wf-step-1-issues')).toBeNull();
    cleanup();
    renderSession({ ...LISTEN, sessionRequestUid: '' }, { errors: [missing], mqttRequests: [] });
    expect(screen.getByTestId('wf-step-1-session-request').className).not.toContain('ant-select-status-error');
    expect(screen.getByTestId('wf-step-1-session-request').textContent).toContain('Select an MQTT request');
  });
});

describe('WorkflowStepEditor — a send', () => {
  it('is on a listen and sends one of its request’s saved messages', () => {
    renderSession(SEND);
    expect(screen.getByRole('heading', { name: 'Send message' })).toBeTruthy();
    expect(screen.getByTestId('wf-step-1-on').textContent).toContain('probe');
    expect(screen.getByTestId('wf-step-1-message').textContent).toContain('Rename');
    openSelect('wf-step-1-message');
    expect(screen.getByText('Ping')).toBeTruthy();
  });

  it('emits the message picked', () => {
    const { onChange } = renderSession(SEND);
    openSelect('wf-step-1-message');
    fireEvent.click(screen.getByText('Ping'));
    expect(onChange).toHaveBeenCalledWith({ ...SEND, messageUid: 'msgping1' });
  });

  it('drops its message when it moves to another listen', () => {
    const second: ListenWorkflowStep = { ...LISTEN, uid: 'stplist2', id: 'second', sessionRequestUid: 'mqttreq2' };
    const { onChange } = renderSession(SEND, { steps: [LISTEN, second, SEND] });
    openSelect('wf-step-1-on');
    pickOption('second');
    expect(onChange).toHaveBeenCalledWith({
      uid: 'stpsend0',
      id: 'rename',
      action: 'send',
      on: 'second',
      captures: [],
    });
  });

  it('captures the message as sent: no status code among its extractors', () => {
    const { onChange } = renderSession(SEND);
    fireEvent.click(screen.getByRole('button', { name: '+ Capture' }));
    expect(onChange).toHaveBeenCalledWith({
      ...SEND,
      captures: [{ uid: expect.any(String), name: 'capture1', extractor: { kind: 'whole-body' } }],
    });
    cleanup();
    renderSession({ ...SEND, captures: [{ uid: 'capname0', name: 'sent', extractor: { kind: 'whole-body' } }] });
    expect(screen.getByText('Whole payload')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /Expose capture/i })).toBeNull();
  });

  it('says a listen it cannot be on, on its field; a message not picked yet marks nothing', () => {
    const { messageUid: _picked, ...unpicked } = SEND;
    renderSession(unpicked, {
      errors: [
        issue({ issue: 'send-without-message', stepId: 'rename', message: 'Step "rename" has no message to send.' }),
        issue({
          issue: 'session-step-unknown-listen',
          stepId: 'rename',
          message: 'Step "rename" names "probe" as its session, which is not a listen step.',
        }),
      ],
    });
    expect(screen.getByTestId('wf-step-1-message').className).not.toContain('ant-select-status-error');
    expect(screen.getByTestId('wf-step-1-on').className).toContain('ant-select-status-error');
    expect(screen.queryByTestId('wf-step-1-issues')).toBeNull();
  });
});

describe('WorkflowStepEditor — an expect', () => {
  it('is on a listen, after a trigger, on a topic filter, within a deadline', () => {
    renderSession(EXPECT);
    expect(screen.getByRole('heading', { name: 'Expect message' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Match criteria' })).toBeTruthy();
    expect(screen.getByTestId('wf-step-1-on').textContent).toContain('probe');
    expect(screen.getByTestId('wf-step-1-after').textContent).toContain('reboot');
    expect(screen.getByTestId<HTMLInputElement>('wf-step-1-address').value).toBe('devices/dev-1/status');
    expect(numberInput('wf-step-1-within')?.value).toBe('10000');
  });

  it('emits its topic filter, and drops the field when it is emptied', () => {
    const { onChange } = renderSession(EXPECT);
    fireEvent.change(screen.getByTestId('wf-step-1-address'), { target: { value: 'devices/+/status' } });
    expect(onChange).toHaveBeenCalledWith({ ...EXPECT, address: 'devices/+/status' });
    fireEvent.change(screen.getByTestId('wf-step-1-address'), { target: { value: '' } });
    const last = onChange.mock.calls.at(-1)?.[0] as ExpectWorkflowStep;
    expect('address' in last).toBe(false);
  });

  it('emits its deadline and whether a stored message counts', () => {
    const { onChange } = renderSession(EXPECT);
    fireEvent.change(numberInput('wf-step-1-within') as HTMLInputElement, { target: { value: '5000' } });
    expect(onChange).toHaveBeenCalledWith({ ...EXPECT, timeoutMs: 5000 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include stored messages' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EXPECT, includeStored: true });
  });

  it('says in one line what the last run made of its rows together, and nothing while it has none', () => {
    const held: ExpectWorkflowStep = {
      ...EXPECT,
      match: [{ kind: 'exists', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' } }],
    };
    renderSession(held, { runState: 'passed' });
    expect(screen.getByTestId('wf-step-1-match-last-run').textContent).toBe('Last run: Matched');
    cleanup();
    renderSession(held, { runState: 'timed-out' });
    expect(screen.getByTestId('wf-step-1-match-last-run').textContent).toBe('Last run: Never matched');
    cleanup();
    renderSession(held, { runState: 'failed' });
    expect(screen.queryByTestId('wf-step-1-match-last-run')).toBeNull();
    cleanup();
    renderSession(EXPECT, { runState: 'passed' });
    expect(screen.queryByTestId('wf-step-1-match-last-run')).toBeNull();
  });

  it('starts a match row as a comparison: a message has no status', () => {
    const { onChange } = renderSession(EXPECT);
    expect(screen.getByText('No rows — the first message that lands matches.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add criterion/i }));
    expect(onChange).toHaveBeenCalledWith({
      ...EXPECT,
      match: [{ kind: 'exists', uid: expect.any(String), extractor: { kind: 'json-path', path: '$.' } }],
    });
    cleanup();
    renderSession({
      ...EXPECT,
      match: [{ kind: 'exists', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' } }],
    });
    openSelect('wf-step-1-match-0-kind');
    expect(screen.getByText('Equals')).toBeTruthy();
    expect(screen.queryByText('Status')).toBeNull();
  });

  it('says a trigger that could fire unarmed on After, and an issue no field owns at the foot', () => {
    renderSession(EXPECT, {
      errors: [
        issue({
          issue: 'expect-unarmed-trigger',
          stepId: 'status',
          message: 'Step "reboot" can start before "probe" is ready, so "status" could miss what it sets off.',
        }),
        issue({
          issue: 'expect-stored-unsure',
          stepId: 'status',
          message:
            'Step "status" passes over stored messages, but "Probe MQTT" subscribes to devices/# with Retain As Published on, so a live message can look stored.',
        }),
      ],
    });
    expect(screen.getByTestId('wf-step-1-after').className).toContain('ant-select-status-error');
    expect(screen.getByTestId('wf-step-1-issues').textContent).toBe(
      'Step "status" passes over stored messages, but "Probe MQTT" subscribes to devices/# with Retain As Published on, so a live message can look stored.',
    );
  });

  it('marks the match row whose value reads a step it cannot, and says nothing of it at the foot', () => {
    const reading: ExpectWorkflowStep = {
      ...EXPECT,
      match: [
        { kind: 'equals', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' },
        { kind: 'equals', uid: 'crtghost', extractor: { kind: 'json-path', path: '$.id' }, value: '{{step.ghost.id}}' },
      ],
    };
    renderSession(reading, {
      errors: [
        {
          issue: 'step-unknown-step-id',
          stepId: 'status',
          referencedCriterionUid: 'crtghost',
          message: 'Step "status" criterion references "ghost", and there is no such step.',
        },
      ],
    });
    expect(screen.getByTestId('wf-step-1-match-1-value').className).toContain('ant-input-status-error');
    expect(screen.getByTestId('wf-step-1-match-0-value').className).not.toContain('ant-input-status-error');
    expect(screen.queryByTestId('wf-step-1-issues')).toBeNull();
  });
});

describe('WorkflowStepEditor — a call in a workflow that holds a session step', () => {
  const captured = mkStep({
    captures: [
      { uid: 'captoken', name: 'token', extractor: { kind: 'whole-body' }, exposed: false, liveName: 'token' },
    ],
  });

  it('offers no exposure on its captures, and adds one that is not exposed', () => {
    const { onChange } = renderStep(captured, { exposable: false });
    expect(screen.queryByRole('switch', { name: /Expose capture/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ Capture' }));
    const last = onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.captures[1]).toMatchObject({ name: 'capture2', exposed: false });
  });

  it('keeps the exposure row everywhere else', () => {
    renderStep(captured);
    expect(screen.getByRole('switch', { name: 'Expose capture token as live variable' })).toBeTruthy();
  });
});
