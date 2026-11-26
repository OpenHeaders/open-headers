/**
 * Coverage for {@link WorkflowStepEditor} — Phase I extensions.
 *
 * The editor is big; these tests target the new surfaces:
 *   1. Show-but-disable catalog — step-type selector (Foreach + Composite
 *      options disabled).
 *   2. `Depends on` section presence + clear button emission.
 *   3. Priority row `Clear` emits `priorityFrom: undefined`.
 *   4. `Run condition` count badge reflects the gate's clause count.
 *   5. Retry policy + Timeout sections — summaries + edit/clear emission.
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
} from '@openheaders/core/types';
import WorkflowStepEditor from '@openheaders/ui/workbench/components/live/WorkflowStepEditor';
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

function renderStep(
  step: DraftKnownStep,
  propOverrides: Partial<React.ComponentProps<typeof WorkflowStepEditor>> = {},
) {
  const onChange = vi.fn();
  render(
    <WorkflowStepEditor
      step={step}
      index={1}
      totalSteps={2}
      availableRequests={[
        { uid: 'reqrefrsh', name: 'refresh', method: 'POST', collectionName: 'auth', folderTrail: ['oauth'] },
      ]}
      onChange={onChange}
      allStepIds={[{ id: 'introspect', label: 'introspect' }]}
      reachableSteps={[{ id: 'introspect', label: 'introspect' }]}
      capturesByStepId={new Map([['introspect', ['active', 'exp']]])}
      errors={[]}
      dependencyRow={{
        step,
        declaredIndex: 1,
        indent: 1,
        parents: ['introspect'],
        reachable: new Set(['introspect']),
      }}
      {...propOverrides}
    />,
  );
  return { onChange };
}

describe('WorkflowStepEditor — Phase I', () => {
  it('shows "(implicit — prior step)" label when dependsOn is absent', () => {
    renderStep(mkStep());
    expect(screen.queryByText(/implicit — prior step/i)).not.toBeNull();
  });

  it('shows "(root)" label when dependsOn is an empty array', () => {
    renderStep(mkStep({ dependsOn: [] }));
    expect(screen.queryByText(/\(root\)/i)).not.toBeNull();
  });

  it('shows `runs if N conditions` chip when runIf has clauses', () => {
    renderStep(
      mkStep({
        runIf: {
          all: [
            { uid: 'gat0sta1', kind: 'status', stepId: 'introspect', match: '2xx' },
            { uid: 'gat0ex01', kind: 'capture-exists', stepId: 'introspect', captureName: 'active' },
          ],
        },
      }),
    );
    expect(screen.queryByText(/runs if 2 conditions/i)).not.toBeNull();
  });

  it('shows `priority: <step>.<capture>` chip when priorityFrom is set', () => {
    renderStep(
      mkStep({
        priorityFrom: { stepId: 'introspect', captureName: 'exp' },
      }),
    );
    expect(screen.queryByText(/priority: introspect\.exp/i)).not.toBeNull();
  });

  // ── Show-but-disable catalog ────────────────────────────────────────
  // Each of these assertions verifies a future-feature affordance is
  // surfaced in v1 with a disabled state — the plan's show-but-disable
  // contract (the live-orchestration plan §UI).

  it('step-type selector marks Foreach + Composite as aria-disabled options', () => {
    renderStep(mkStep());

    // Step-type selector is the first combobox in render order — it sits
    // in the step header row, before the REQUEST selector. The underlying
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

  // ── Retry policy + Timeout sections (live editors) ─────────────────

  it('Retry policy collapse header is enabled and summarizes (none) without a policy', () => {
    renderStep(mkStep());
    const header = screen.getByRole('button', { name: /Retry policy/i });
    expect(header.getAttribute('aria-disabled')).not.toBe('true');
    expect(header.textContent).toContain('(none)');
  });

  it('Retry policy header summarizes attempts + backoff when a policy is set', () => {
    renderStep(mkStep({ retry: { maxAttempts: 4, backoff: 'exponential' } }));
    const header = screen.getByRole('button', { name: /Retry policy/i });
    expect(header.textContent).toContain('(4 attempts, exponential)');
  });

  it('setting attempts creates a policy; clearing the field removes it', () => {
    const { onChange } = renderStep(mkStep({ retry: { maxAttempts: 3 } }));
    fireEvent.click(screen.getByRole('button', { name: /Retry policy/i }));
    const attempts = numberInput('wf-step-1-retry-attempts');
    expect(attempts).not.toBeNull();
    fireEvent.change(attempts as HTMLInputElement, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retry: { maxAttempts: 5 } }));
    fireEvent.change(attempts as HTMLInputElement, { target: { value: '' } });
    const last = onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.retry).toBeUndefined();
  });

  it('Timeout header summarizes the ceiling; editing the field emits timeoutMs', () => {
    const { onChange } = renderStep(mkStep({ timeoutMs: 10_000 }));
    const header = screen.getByRole('button', { name: /Timeout/i });
    expect(header.getAttribute('aria-disabled')).not.toBe('true');
    expect(header.textContent).toContain('(10000 ms)');
    fireEvent.click(header);
    const input = numberInput('wf-step-1-timeout');
    fireEvent.change(input as HTMLInputElement, { target: { value: '2500' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 2500 }));
  });

  it('Timeout Clear button removes the ceiling', () => {
    const { onChange } = renderStep(mkStep({ timeoutMs: 5_000 }));
    fireEvent.click(screen.getByRole('button', { name: /Timeout/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    const last = onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.timeoutMs).toBeUndefined();
  });

  // ── Scripts section (runScripts opt-in) ─────────────────────────────

  it('Scripts header summarizes (off) by default and (on) when opted in', () => {
    renderStep(mkStep());
    expect(screen.getByRole('button', { name: /Scripts/i }).textContent).toContain('(off)');
    cleanup();
    renderStep(mkStep({ runScripts: true }));
    expect(screen.getByRole('button', { name: /Scripts/i }).textContent).toContain('(on)');
  });

  it('toggling the switch on emits runScripts: true; off removes the field', () => {
    const { onChange } = renderStep(mkStep());
    fireEvent.click(screen.getByRole('button', { name: /Scripts/i }));
    fireEvent.click(screen.getByRole('switch', { name: /Run the request's scripts/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ runScripts: true }));
    cleanup();
    const optedIn = renderStep(mkStep({ runScripts: true }));
    fireEvent.click(screen.getByRole('button', { name: /Scripts/i }));
    fireEvent.click(screen.getByRole('switch', { name: /Run the request's scripts/i }));
    const last = optedIn.onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.runScripts).toBeUndefined();
  });

  it('shows a `scripts` chip in the step header when opted in', () => {
    renderStep(mkStep({ runScripts: true }));
    expect(screen.queryByText(/^scripts$/)).not.toBeNull();
    cleanup();
    renderStep(mkStep());
    expect(screen.queryByText(/^scripts$/)).toBeNull();
  });

  // ── Success criteria + Poll sections ────────────────────────────────

  it('Success criteria header summarizes (none), then the number of rows', () => {
    renderStep(mkStep());
    expect(screen.getByRole('button', { name: /Success criteria/i }).textContent).toContain('(none)');
    cleanup();
    renderStep(
      mkStep({
        successCriteria: [
          { kind: 'status', uid: 'crtstat0', match: '2xx' },
          { kind: 'exists', uid: 'crtname0', extractor: { kind: 'json-path', path: '$.name' } },
        ],
      }),
    );
    expect(screen.getByRole('button', { name: /Success criteria/i }).textContent).toContain('(2)');
  });

  it('adding a criterion emits a status row; removing the last one removes the field', () => {
    const { onChange } = renderStep(mkStep());
    fireEvent.click(screen.getByRole('button', { name: /Success criteria/i }));
    expect(screen.queryByText('No criteria — any response that arrives passes.')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add criterion/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ successCriteria: [{ kind: 'status', uid: expect.any(String), match: '2xx' }] }),
    );
    cleanup();
    const held = renderStep(mkStep({ successCriteria: [{ kind: 'status', uid: 'crtstat0', match: '2xx' }] }));
    fireEvent.click(screen.getByRole('button', { name: /Success criteria/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /Success criteria/i }));
    fireEvent.change(screen.getByTestId('wf-step-1-criterion-0-value'), { target: { value: '{{step.rename.name}}' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ successCriteria: [{ ...criterion, value: '{{step.rename.name}}' }] }),
    );
  });

  it('Poll header summarizes its two numbers; setting attempts starts a poll, Clear ends it', () => {
    const { onChange } = renderStep(mkStep());
    const header = screen.getByRole('button', { name: /Poll/i });
    expect(header.textContent).toContain('(none)');
    fireEvent.click(header);
    fireEvent.change(numberInput('wf-step-1-poll-attempts') as HTMLInputElement, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ poll: { maxAttempts: 10, delayMs: 1_000 } }));
    cleanup();
    const polled = renderStep(mkStep({ poll: { maxAttempts: 10, delayMs: 200 } }));
    const polledHeader = screen.getByRole('button', { name: /Poll/i });
    expect(polledHeader.textContent).toContain('(10 × 200 ms)');
    fireEvent.click(polledHeader);
    fireEvent.change(numberInput('wf-step-1-poll-delay') as HTMLInputElement, { target: { value: '500' } });
    expect(polled.onChange).toHaveBeenCalledWith(expect.objectContaining({ poll: { maxAttempts: 10, delayMs: 500 } }));
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    const last = polled.onChange.mock.calls.at(-1)?.[0] as DraftCallStep;
    expect(last.poll).toBeUndefined();
  });

  it('a poll’s issue is said in its section, and an issue no field owns at the card’s foot', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Poll/i }));
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
    expect(screen.queryByText('Expect')).toBeNull();
  });

  it('offers Listen, Send and Expect where it does, and hands the pick to its owner', () => {
    const onActionChange = vi.fn();
    renderStep(mkStep(), { sessionAuthoring: true, onActionChange });
    openSelect('wf-step-1-action');
    pickOption('Expect');
    expect(onActionChange).toHaveBeenCalledWith('expect');
  });

  it('shows a session step under its own action whether or not session steps are authored here', () => {
    renderSession(LISTEN);
    expect(screen.getByTestId('wf-step-1-action').textContent).toContain('Listen');
    openSelect('wf-step-1-action');
    expect(screen.queryByText('Send')).toBeNull();
    expect(screen.queryByText('Expect')).toBeNull();
  });
});

describe('WorkflowStepEditor — a listen', () => {
  it('has its request, its deadline, its scripts and the shared sections — and nothing to capture', () => {
    renderSession(LISTEN);
    expect(screen.getByTestId('wf-step-1-session-request').textContent).toContain('Probe MQTT');
    expect(numberInput('wf-step-1-ready-within')?.value).toBe('10000');
    expect(screen.queryByRole('button', { name: '+ Capture' })).toBeNull();
    expect(screen.getByRole('button', { name: /Depends on/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Run condition/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Priority/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Retry policy/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Success criteria/i })).toBeNull();
  });

  it('emits its deadline and its scripts switch', () => {
    const { onChange } = renderSession(LISTEN);
    fireEvent.change(numberInput('wf-step-1-ready-within') as HTMLInputElement, { target: { value: '2500' } });
    expect(onChange).toHaveBeenCalledWith({ ...LISTEN, timeoutMs: 2500 });
    fireEvent.click(screen.getByRole('switch', { name: /Run the request's scripts/i }));
    expect(onChange).toHaveBeenLastCalledWith({ ...LISTEN, runScripts: true });
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
    fireEvent.click(screen.getByRole('switch', { name: 'Include stored messages' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EXPECT, includeStored: true });
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
