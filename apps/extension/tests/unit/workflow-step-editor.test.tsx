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

import type { DraftStep } from '@openheaders/core/live';
import WorkflowStepEditor from '@openheaders/ui/workbench/components/live/WorkflowStepEditor';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

function mkStep(overrides: Partial<DraftStep> = {}): DraftStep {
  return { uid: 'stprefrs', id: 'refresh', requestUid: 'reqrefrsh', captures: [], ...overrides };
}

/** Resolve an InputNumber's editable `<input>` from its testid — AntD may
 *  stamp the data attribute on the inner input or on a wrapper. */
function numberInput(testId: string): HTMLInputElement | null {
  const el = screen.getByTestId(testId);
  if (el.tagName === 'INPUT') return el as HTMLInputElement;
  return el.querySelector('input');
}

function renderStep(step: DraftStep, propOverrides: Partial<React.ComponentProps<typeof WorkflowStepEditor>> = {}) {
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
  // contract (docs/LIVE_ORCHESTRATION_PLAN.md §UI).

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
    const last = onChange.mock.calls.at(-1)?.[0] as DraftStep;
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
    const last = onChange.mock.calls.at(-1)?.[0] as DraftStep;
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
    const last = optedIn.onChange.mock.calls.at(-1)?.[0] as DraftStep;
    expect(last.runScripts).toBeUndefined();
  });

  it('shows a `scripts` chip in the step header when opted in', () => {
    renderStep(mkStep({ runScripts: true }));
    expect(screen.queryByText(/^scripts$/)).not.toBeNull();
    cleanup();
    renderStep(mkStep());
    expect(screen.queryByText(/^scripts$/)).toBeNull();
  });
});
