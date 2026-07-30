// @vitest-environment jsdom
/**
 * RefreshPolicyEditor's interval knob — a ComboKnob over the shared
 * duration labels ("30 s" / "5 min" / "1 h") while the policy stores
 * whole seconds. Commits round to integer seconds and clamp to the
 * 30 s schema floor; clearing returns to the 5-minute default the
 * kind picker mints; the sub-minute warning keys off the stored
 * seconds as before.
 */

import type { RefreshPolicy } from '@openheaders/core/types';
import RefreshPolicyEditor from '@openheaders/ui/workbench/components/live/RefreshPolicyEditor';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

afterEach(cleanup);

const interval = (seconds: number): RefreshPolicy => ({ kind: 'interval', seconds });

function renderInterval(seconds: number, onChange: (next: RefreshPolicy) => void = () => {}) {
  return render(<RefreshPolicyEditor value={interval(seconds)} onChange={onChange} availableCaptures={[]} />);
}

const knob = (): HTMLInputElement => screen.getByRole('combobox', { name: 'Fixed interval' }) as HTMLInputElement;

describe('RefreshPolicyEditor interval knob', () => {
  it('renders the stored seconds as a human duration label', () => {
    renderInterval(300);
    expect(knob().value).toBe('5 min');
  });

  it('commits unit-bearing text as whole seconds', () => {
    const onChange = vi.fn();
    renderInterval(300, onChange);
    fireEvent.change(knob(), { target: { value: '2 min' } });
    fireEvent.blur(knob());
    expect(onChange).toHaveBeenCalledWith({ kind: 'interval', seconds: 120 });
  });

  it('commits a below-the-hour seconds reading', () => {
    const onChange = vi.fn();
    renderInterval(300, onChange);
    fireEvent.change(knob(), { target: { value: '45 s' } });
    fireEvent.blur(knob());
    expect(onChange).toHaveBeenCalledWith({ kind: 'interval', seconds: 45 });
  });

  it('reverts sub-floor text instead of committing', () => {
    // 10 s sits below the 30 s alarm floor — zero candidates, revert.
    const onChange = vi.fn();
    renderInterval(300, onChange);
    fireEvent.change(knob(), { target: { value: '10 s' } });
    fireEvent.blur(knob());
    expect(onChange).not.toHaveBeenCalled();
    expect(knob().value).toBe('5 min');
  });

  it('returns to the 5-minute default when emptied', () => {
    const onChange = vi.fn();
    renderInterval(120, onChange);
    fireEvent.change(knob(), { target: { value: '' } });
    fireEvent.blur(knob());
    expect(onChange).toHaveBeenCalledWith({ kind: 'interval', seconds: 300 });
  });

  it('keeps the sub-minute warning keyed off the stored seconds', () => {
    renderInterval(45);
    expect(screen.getByText(/Sub-minute intervals hit the MV3 alarm floor/)).toBeTruthy();

    cleanup();
    renderInterval(300);
    expect(screen.queryByText(/Sub-minute intervals hit the MV3 alarm floor/)).toBeNull();
  });
});
