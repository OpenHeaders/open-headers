/**
 * Coverage for {@link StepGateEditor} — the AND-of-clauses gate editor.
 *
 * Three focus areas:
 *   1. Empty state + clause list expansion — user can add a clause and
 *      the component emits a well-formed `V5.StepGate` to `onChange`.
 *   2. Show-but-disable catalog — Segmented `Any (OR)` option is
 *      disabled; future clause-kind options carry disabled + tooltip.
 *   3. Error plumbing — `gate-unknown-stepid` / `gate-unknown-capture`
 *      / `gate-invalid-regex` errors flow into the matching field.
 *
 * Queries prefer Testing Library's semantic roles (`radio`, `option`,
 * `combobox`, `textbox`) + ARIA attributes (`aria-disabled`) everywhere
 * AntD exposes them. AntD's `status="error"` prop is a known a11y gap:
 * it renders as a class on the outer wrapper and sets no ARIA attribute,
 * so error-state assertions fall back to the documented AntD class
 * selector with a comment noting the gap. If AntD ever ships
 * aria-invalid on status='error', flip these assertions over.
 */

import type { StructuralError } from '@openheaders/core/live';
import type { V5 } from '@openheaders/core/types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import StepGateEditor from '@/workbench/components/live/StepGateEditor';

// AntD Select's dropdown portal mounts with rc-resize-observer, which
// requires ResizeObserver in the global scope. jsdom doesn't provide one.
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

function renderEditor(overrides: Partial<React.ComponentProps<typeof StepGateEditor>> = {}): {
  onChange: ReturnType<typeof vi.fn>;
  rerender: (next: V5.StepGate | undefined) => void;
} {
  const onChange = vi.fn();
  const reachableSteps = overrides.reachableSteps ?? [
    { id: 'introspect', label: 'introspect' },
    { id: 'probe', label: 'probe' },
  ];
  const capturesByStepId =
    overrides.capturesByStepId ??
    new Map<string, string[]>([
      ['introspect', ['active', 'exp']],
      ['probe', ['route']],
    ]);

  const view = render(
    <StepGateEditor
      value={overrides.value}
      onChange={(next) => {
        onChange(next);
      }}
      reachableSteps={reachableSteps}
      capturesByStepId={capturesByStepId}
      errors={overrides.errors}
    />,
  );

  return {
    onChange,
    rerender: (next) => {
      view.rerender(
        <StepGateEditor
          value={next}
          onChange={(n) => {
            onChange(n);
          }}
          reachableSteps={reachableSteps}
          capturesByStepId={capturesByStepId}
          errors={overrides.errors}
        />,
      );
    },
  };
}

/** Open an AntD Select dropdown; subsequent queries find the rendered items. */
function openCombobox(combobox: HTMLElement): void {
  fireEvent.mouseDown(combobox);
  fireEvent.click(combobox);
}

afterEach(() => {
  cleanup();
});

describe('StepGateEditor', () => {
  it('renders the empty state with no clauses', () => {
    renderEditor({ value: undefined });
    expect(screen.queryByText('No conditions — step runs whenever its dependencies complete.')).not.toBeNull();
  });

  it('adds a clause seeded against the first reachable step', () => {
    const { onChange } = renderEditor({ value: undefined });
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
    expect(onChange).toHaveBeenCalledWith({
      all: [{ kind: 'status', stepId: 'introspect', match: '2xx' }],
    });
  });

  it('emits undefined when the last clause is removed', () => {
    const value: V5.StepGate = {
      all: [{ kind: 'status', stepId: 'introspect', match: '2xx' }],
    };
    const { onChange } = renderEditor({ value });
    fireEvent.click(screen.getByRole('button', { name: /remove clause 1/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('renders OR toggle as disabled (show-but-disable)', () => {
    renderEditor({ value: undefined });
    // AntD Segmented renders each option as role=radio; the disabled Any (OR)
    // option's inner input is `disabled=true`.
    const orRadio = screen.getByRole('radio', { name: /Any \(OR\)/i });
    expect(orRadio).toHaveProperty('disabled', true);
  });

  // ── Error plumbing (AntD `status="error"` → visual class only) ────
  // AntD doesn't expose `status="error"` through aria-invalid on Select or
  // Input. The regression guard is against the documented
  // `ant-*-status-error` class name on the wrapping element; when AntD
  // starts emitting aria-invalid, flip these over.
  it('routes `gate-unknown-stepid` to the step dropdown as a visual error', () => {
    const value: V5.StepGate = {
      all: [{ kind: 'status', stepId: 'deleted-step', match: '2xx' }],
    };
    const errors: StructuralError[] = [
      {
        issue: 'gate-unknown-stepid',
        stepId: 'refresh',
        referencedStepId: 'deleted-step',
        message: 'Step "refresh" gate references unknown step "deleted-step".',
      },
    ];
    renderEditor({ value, errors });
    expect(document.querySelectorAll('.ant-select-status-error').length).toBeGreaterThan(0);
  });

  it('routes `gate-unknown-capture` to the capture dropdown as a visual error', () => {
    const value: V5.StepGate = {
      all: [{ kind: 'capture-equals', stepId: 'introspect', captureName: 'missing', value: 'x' }],
    };
    const errors: StructuralError[] = [
      {
        issue: 'gate-unknown-capture',
        stepId: 'refresh',
        referencedStepId: 'introspect',
        referencedCaptureName: 'missing',
        message: 'Step "refresh" gate references capture "missing" on step "introspect".',
      },
    ];
    renderEditor({ value, errors });
    expect(document.querySelectorAll('.ant-select-status-error').length).toBeGreaterThan(0);
  });

  it('marks invalid capture-matches regex pattern with a visual error', () => {
    const value: V5.StepGate = {
      all: [{ kind: 'capture-matches', stepId: 'introspect', captureName: 'active', pattern: '(' }],
    };
    const errors: StructuralError[] = [
      {
        issue: 'gate-invalid-regex',
        stepId: 'refresh',
        referencedStepId: 'introspect',
        referencedCaptureName: 'active',
        message: 'Step "refresh" gate has an invalid regex pattern: (',
      },
    ];
    renderEditor({ value, errors });
    expect(document.querySelectorAll('.ant-input-status-error').length).toBeGreaterThan(0);
  });

  // ── Show-but-disable catalog — future clause kinds ────────────────
  // AntD's visible dropdown items don't carry `role="option"` — only the
  // screen-reader-only listbox does, and that listbox is virtually scrolled
  // so only 1–2 entries render at a time. We locate each option by the
  // user-visible label text and verify its containing element's
  // `aria-disabled` attribute — `aria-disabled` is a proper semantic ARIA
  // state, and visible-text search is how a user would identify the item.
  it('renders 3 future clause kinds as disabled options in the kind dropdown', () => {
    const value: V5.StepGate = {
      all: [{ kind: 'status', stepId: 'introspect', match: '2xx' }],
    };
    renderEditor({ value });

    // Clause-kind combobox is the second in its row (step is first).
    const comboboxes = screen.getAllByRole('combobox');
    openCombobox(comboboxes[1]);

    for (const label of ['Capture numeric compare', 'Capture in list', 'Header contains']) {
      // Each clause-kind label renders inside a disabled option container.
      // Text search finds the visible node; climb to the nearest
      // aria-disabled ancestor to read the option's disabled state.
      const textNode = screen.getByText(label);
      const option = textNode.closest('[aria-disabled]');
      expect(option, `"${label}" should live inside an aria-disabled container`).not.toBeNull();
      expect(option?.getAttribute('aria-disabled'), `"${label}" should be aria-disabled=true`).toBe('true');
    }
  });

  it('keeps enabled clause kinds aria-disabled=false in the kind dropdown', () => {
    // Regression guard: if anyone flips an enabled kind to disabled by
    // mistake, this catches it.
    const value: V5.StepGate = {
      all: [{ kind: 'status', stepId: 'introspect', match: '2xx' }],
    };
    renderEditor({ value });

    const comboboxes = screen.getAllByRole('combobox');
    openCombobox(comboboxes[1]);

    for (const label of ['Capture exists', 'Capture equals', 'Capture matches']) {
      const textNode = screen.getByText(label);
      const option = textNode.closest('[aria-disabled]');
      expect(option?.getAttribute('aria-disabled'), `"${label}" should be aria-disabled=false`).toBe('false');
    }
  });
});
