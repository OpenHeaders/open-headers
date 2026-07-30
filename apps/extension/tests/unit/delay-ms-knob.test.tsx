// @vitest-environment jsdom
/**
 * DelayMsKnob — the shared delay-rule duration ComboKnob (full rule
 * editor + panel quick editors). The field is required, so the knob
 * commits only interpreted candidates: unambiguous text lands as
 * milliseconds, ambiguous or out-of-bounds text reverts, and emptying
 * reports undefined so each surface's save gate can block.
 */

import DelayMsKnob from '@openheaders/ui/workbench/components/rule-fields/DelayMsKnob';
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

const knob = (): HTMLInputElement => screen.getByRole('combobox', { name: 'Delay' }) as HTMLInputElement;

describe('DelayMsKnob', () => {
  it('renders a committed value as a human duration label', () => {
    render(<DelayMsKnob value={1000} onChange={() => {}} ariaLabel="Delay" />);
    expect(knob().value).toBe('1 s');
  });

  it('offers the curated presets while empty', () => {
    render(<DelayMsKnob onChange={() => {}} ariaLabel="Delay" />);
    fireEvent.mouseDown(knob());
    fireEvent.click(knob());
    const labels = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option')).map((el) =>
      el.getAttribute('title'),
    );
    expect(labels).toContain('100 ms');
    expect(labels).toContain('1 s');
    expect(labels).toContain('30 s');
  });

  it('interprets unambiguous unit-bearing text into ms on blur', () => {
    const onChange = vi.fn();
    render(<DelayMsKnob onChange={onChange} ariaLabel="Delay" />);
    fireEvent.change(knob(), { target: { value: '2s' } });
    fireEvent.blur(knob());
    expect(onChange).toHaveBeenCalledWith(2000);
  });

  it('interprets a bare number with one in-bounds reading', () => {
    // "250" commits as 250 ms — the 250 s / 250 min readings exceed the
    // 30 s cap, so they are disabled feedback, not committable.
    const onChange = vi.fn();
    render(<DelayMsKnob onChange={onChange} ariaLabel="Delay" />);
    fireEvent.change(knob(), { target: { value: '250' } });
    fireEvent.blur(knob());
    expect(onChange).toHaveBeenCalledWith(250);
  });

  it('reverts ambiguous text instead of guessing', () => {
    // "5" reads as 5 ms or 5 s — two enabled candidates, so blur must
    // not commit.
    const onChange = vi.fn();
    render(<DelayMsKnob onChange={onChange} ariaLabel="Delay" />);
    fireEvent.change(knob(), { target: { value: '5' } });
    fireEvent.blur(knob());
    expect(onChange).not.toHaveBeenCalled();
    expect(knob().value).toBe('');
  });

  it('reverts out-of-bounds text to the committed value', () => {
    // "60 s" is beyond the 30 s cap — its only candidate is disabled,
    // so blur reverts.
    const onChange = vi.fn();
    render(<DelayMsKnob value={1000} onChange={onChange} ariaLabel="Delay" />);
    fireEvent.change(knob(), { target: { value: '60 s' } });
    fireEvent.blur(knob());
    expect(onChange).not.toHaveBeenCalled();
    expect(knob().value).toBe('1 s');
  });

  it('explains an over-cap reading as a disabled candidate', () => {
    // "32" reads as 32 ms (in bounds) plus 32 s / 32 min over the cap —
    // the pruned readings stay visible, disabled, naming the bound.
    render(<DelayMsKnob onChange={() => {}} ariaLabel="Delay" />);
    fireEvent.change(knob(), { target: { value: '32' } });
    const options = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option'));
    const byTitle = new Map(options.map((el) => [el.getAttribute('title'), el]));
    expect(byTitle.get('32 ms')?.classList.contains('ant-select-item-option-disabled')).toBe(false);
    expect(byTitle.get('32 s — max 30 s')?.classList.contains('ant-select-item-option-disabled')).toBe(true);
    expect(byTitle.get('32 min — max 30 s')?.classList.contains('ant-select-item-option-disabled')).toBe(true);
  });

  it('never commits a disabled candidate via Enter', () => {
    // "60 s" has a single candidate and it is disabled — Enter must
    // leave the model untouched.
    const onChange = vi.fn();
    render(<DelayMsKnob onChange={onChange} ariaLabel="Delay" />);
    fireEvent.change(knob(), { target: { value: '60 s' } });
    fireEvent.keyDown(knob(), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('groups big label numbers per the runtime locale', () => {
    // Display only — the model keeps the plain 29304; the label rides
    // Intl grouping ("29,304 ms" / "29.304 ms" per locale).
    const grouped = new Intl.NumberFormat().format(29304);
    render(<DelayMsKnob value={29304} onChange={() => {}} ariaLabel="Delay" />);
    expect(knob().value).toBe(`${grouped} ms`);
  });

  it('explains a below-minimum reading as a disabled candidate', () => {
    // "0" rounds to 0 ms, under the 1 ms floor — disabled, min named.
    render(<DelayMsKnob onChange={() => {}} ariaLabel="Delay" />);
    fireEvent.change(knob(), { target: { value: '0' } });
    const labels = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option-disabled')).map((el) =>
      el.getAttribute('title'),
    );
    expect(labels).toContain('0 ms — min 1 ms');
  });

  it('reports undefined when emptied so the save gate can block', () => {
    const onChange = vi.fn();
    render(<DelayMsKnob value={5000} onChange={onChange} ariaLabel="Delay" />);
    fireEvent.change(knob(), { target: { value: '' } });
    fireEvent.blur(knob());
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
