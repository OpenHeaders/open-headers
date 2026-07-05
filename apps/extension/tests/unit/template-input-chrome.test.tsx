// @vitest-environment jsdom
/**
 * TemplateInput chrome contract — `multiline resizable allowClear`
 * must render the always-visible-scrollbar surface (`--expanded`
 * class), the bottom-right resize grip, and the clear ✕ when a value
 * is present. The variable hover popover's value editor relies on this
 * exact prop combination to match the workbench form inputs.
 *
 * Also covers the grip's horizontal axis: with `onResizeX` the grip is
 * two-dimensional (`--2d` class) and reports start/move/end/reset
 * phases with the pointer's X travel — it never applies width itself.
 */

import TemplateInput from '@openheaders/ui/workbench/components/template-input/TemplateInput';
import type { GripResizeXEvent } from '@openheaders/ui/workbench/components/template-input/types';
// Side-effect import — TemplateInput reads workbench settings via
// useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
  // jsdom has no pointer-capture — the grip's pointer handlers call these.
  if (typeof Element.prototype.setPointerCapture === 'undefined') {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
});

afterEach(cleanup);

describe('TemplateInput — multiline resizable allowClear chrome', () => {
  it('renders the expanded surface, resize grip, and clear icon with a value', () => {
    const { container } = render(
      <TemplateInput value="Bearer {{env.TOKEN}}" onChange={vi.fn()} multiline resizable allowClear />,
    );
    expect(container.querySelector('.oh-template-input-editable--expanded')).not.toBeNull();
    expect(container.querySelector('.oh-template-input-resize-grip')).not.toBeNull();
    expect(container.querySelector('.oh-template-input-clear')).not.toBeNull();
  });

  it('hides the clear icon when the value is empty', () => {
    const { container } = render(<TemplateInput value="" onChange={vi.fn()} multiline resizable allowClear />);
    expect(container.querySelector('.oh-template-input-clear')).toBeNull();
  });

  it('clear icon empties the value and keeps focus in the field', () => {
    const onChange = vi.fn();
    const { container } = render(<TemplateInput value="abc" onChange={onChange} multiline resizable allowClear />);
    const clear = container.querySelector('.oh-template-input-clear');
    expect(clear).not.toBeNull();
    fireEvent.click(clear as Element);
    expect(onChange).toHaveBeenCalledWith('');
    expect(document.activeElement).toBe(container.querySelector('.oh-template-input-editable'));
  });
});

describe('TemplateInput — two-axis resize grip (onResizeX)', () => {
  it('stays one-dimensional without onResizeX', () => {
    const { container } = render(<TemplateInput value="v" onChange={vi.fn()} multiline resizable />);
    expect(container.querySelector('.oh-template-input-resize-grip--2d')).toBeNull();
  });

  it('reports start/move/end with the pointer X travel and reset on double-click', () => {
    const events: GripResizeXEvent[] = [];
    const { container } = render(
      <TemplateInput value="v" onChange={vi.fn()} multiline resizable onResizeX={(e) => events.push(e)} />,
    );
    const grip = container.querySelector('.oh-template-input-resize-grip--2d');
    expect(grip).not.toBeNull();

    fireEvent.pointerDown(grip as Element, { pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(grip as Element, { pointerId: 1, clientX: 140, clientY: 58 });
    fireEvent.pointerMove(grip as Element, { pointerId: 1, clientX: 70, clientY: 58 });
    fireEvent.pointerUp(grip as Element, { pointerId: 1, clientX: 70, clientY: 58 });
    fireEvent.doubleClick(grip as Element);

    expect(events.map((e) => [e.phase, e.deltaX])).toEqual([
      ['start', 0],
      ['move', 40],
      ['move', -30],
      ['end', -30],
      ['reset', 0],
    ]);
    for (const e of events) expect(e.gripEl).toBe(grip);
  });

  it('ignores pointer moves that arrive without an active drag', () => {
    const events: GripResizeXEvent[] = [];
    const { container } = render(
      <TemplateInput value="v" onChange={vi.fn()} multiline resizable onResizeX={(e) => events.push(e)} />,
    );
    const grip = container.querySelector('.oh-template-input-resize-grip--2d');
    fireEvent.pointerMove(grip as Element, { pointerId: 1, clientX: 300, clientY: 90 });
    expect(events).toEqual([]);
  });
});
