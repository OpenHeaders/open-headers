/**
 * Coverage for `useMeasuredCssHeights` — publishes each element's
 * rendered height (subpixel-precise via `getBoundingClientRect`) as a
 * CSS custom property on a target element, and keeps the values in
 * sync via `ResizeObserver`.
 *
 * Tests focus on the contract callers depend on:
 *   1. Variables are present immediately after mount (no waiting for
 *      the first RO tick, otherwise the first paint reads `var(…, fallback)`).
 *   2. Subpixel values pass through unrounded — sticky stacks rely on
 *      this to land flush against each other.
 *   3. Variables are removed on unmount — leaving stale `--*-h: 120px`
 *      attributes around poisons later renders.
 *   4. Null refs publish nothing (don't set the variable to `null` or `0`
 *      unexpectedly — fallback should kick in).
 */

import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/dom/useMeasuredStickyOffset';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * jsdom doesn't compute layout, so `getBoundingClientRect` returns a
 * zero rect for every element. Override the prototype method so the
 * hook reads the per-element height we want to assert against.
 */
function stubBoundingHeightByTestId(map: Record<string, number>): { restore: () => void } {
  const original = HTMLElement.prototype.getBoundingClientRect;
  const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const id = this.dataset.testid;
    const height = id && map[id] !== undefined ? map[id] : 0;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: height,
      width: 0,
      height,
      toJSON() {
        return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: height, width: 0, height };
      },
    } as DOMRect;
  });
  return {
    restore: () => {
      spy.mockRestore();
      HTMLElement.prototype.getBoundingClientRect = original;
    },
  };
}

function Harness({
  toolbarHeight: _toolbarHeight,
  summaryHeight: _summaryHeight,
  attachSummary = true,
}: {
  toolbarHeight: number;
  summaryHeight: number;
  attachSummary?: boolean;
}): React.ReactElement {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  useMeasuredCssHeights(targetRef, [
    { ref: toolbarRef, cssVar: '--toolbar-h' },
    { ref: summaryRef, cssVar: '--summary-h' },
  ]);
  return (
    <div data-testid="target" ref={targetRef}>
      <div ref={toolbarRef} data-testid="toolbar" />
      {attachSummary && <div ref={summaryRef} data-testid="summary" />}
    </div>
  );
}

describe('useMeasuredCssHeights', () => {
  it('publishes each tracked element height as a CSS variable on the target', () => {
    const stub = stubBoundingHeightByTestId({ toolbar: 30, summary: 24 });

    const { getByTestId, unmount } = render(<Harness toolbarHeight={30} summaryHeight={24} />);
    const target = getByTestId('target') as HTMLElement;

    expect(target.style.getPropertyValue('--toolbar-h')).toBe('30px');
    expect(target.style.getPropertyValue('--summary-h')).toBe('24px');

    unmount();
    stub.restore();
  });

  it('preserves subpixel precision — the sticky stack uses these values to land flush', () => {
    // Real fonts / borders render at fractional heights (e.g. 19.5px,
    // 30.625px). `getBoundingClientRect` returns those unrounded; the
    // hook must pass them through to CSS so calc(…) joins are tight.
    const stub = stubBoundingHeightByTestId({ toolbar: 30.625, summary: 19.5 });

    const { getByTestId, unmount } = render(<Harness toolbarHeight={30} summaryHeight={20} />);
    const target = getByTestId('target') as HTMLElement;

    expect(target.style.getPropertyValue('--toolbar-h')).toBe('30.625px');
    expect(target.style.getPropertyValue('--summary-h')).toBe('19.5px');

    unmount();
    stub.restore();
  });

  it('removes the variables on unmount (no leftover sticky offsets in the tree)', () => {
    const stub = stubBoundingHeightByTestId({ toolbar: 40, summary: 40 });

    const { getByTestId, unmount } = render(<Harness toolbarHeight={40} summaryHeight={40} />);
    const target = getByTestId('target') as HTMLElement;

    expect(target.style.getPropertyValue('--toolbar-h')).toBe('40px');
    unmount();
    expect(target.style.getPropertyValue('--toolbar-h')).toBe('');
    expect(target.style.getPropertyValue('--summary-h')).toBe('');

    stub.restore();
  });

  it('skips variables for null refs (lets the CSS fallback win)', () => {
    const stub = stubBoundingHeightByTestId({ toolbar: 30, summary: 24 });

    const { getByTestId, unmount } = render(<Harness toolbarHeight={30} summaryHeight={24} attachSummary={false} />);
    const target = getByTestId('target') as HTMLElement;

    expect(target.style.getPropertyValue('--toolbar-h')).toBe('30px');
    expect(target.style.getPropertyValue('--summary-h')).toBe('');

    unmount();
    stub.restore();
  });
});
