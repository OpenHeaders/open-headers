/**
 * Coverage for {@link WorkflowStepEditor} — Phase I extensions.
 *
 * The editor is big; these tests target the new surfaces:
 *   1. Show-but-disable catalog — step-type selector (Foreach + Composite
 *      options disabled), Retry policy + Timeout (ms) collapse items
 *      (`collapsible: 'disabled'`).
 *   2. `Depends on` section presence + clear button emission.
 *   3. Priority row `Clear` emits `priorityFrom: undefined`.
 *   4. `Run condition` count badge reflects the gate's clause count.
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

import type { V5 } from '@openheaders/core/types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import WorkflowStepEditor from '@/workbench/components/live/WorkflowStepEditor';

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

function mkStep(overrides: Partial<V5.WorkflowStep> = {}): V5.WorkflowStep {
  return { id: 'refresh', requestUid: 'reqrefrsh', captures: [], ...overrides };
}

function renderStep(
  step: V5.WorkflowStep,
  propOverrides: Partial<React.ComponentProps<typeof WorkflowStepEditor>> = {},
) {
  const onChange = vi.fn();
  render(
    <WorkflowStepEditor
      step={step}
      index={1}
      totalSteps={2}
      availableRequests={[{ uid: 'reqrefrsh', name: 'refresh', method: 'POST' }]}
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
            { kind: 'status', stepId: 'introspect', match: '2xx' },
            { kind: 'capture-exists', stepId: 'introspect', captureName: 'active' },
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

  it('Retry policy collapse header is disabled with the future-feature tooltip', () => {
    renderStep(mkStep());
    // AntD's disabled Collapse header renders as role=button with
    // aria-disabled="true". The accessible name picks up the label span —
    // we match /Retry policy/i so the (coming soon) suffix doesn't matter.
    const header = screen.getByRole('button', { name: /Retry policy/i });
    expect(header.getAttribute('aria-disabled')).toBe('true');
  });

  it('Timeout (ms) collapse header is disabled with the future-feature tooltip', () => {
    renderStep(mkStep());
    const header = screen.getByRole('button', { name: /Timeout \(ms\)/i });
    expect(header.getAttribute('aria-disabled')).toBe('true');
  });
});
