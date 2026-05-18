/**
 * Coverage for `useMeasuredCssHeights` — publishes each element's
 * `offsetHeight` as a CSS custom property on a target element, and
 * keeps the values in sync via `ResizeObserver`.
 *
 * Tests focus on the contract callers depend on:
 *   1. Variables are present immediately after mount (no waiting for
 *      the first RO tick, otherwise the first paint reads `var(…, fallback)`).
 *   2. Variables are removed on unmount — leaving stale `--*-h: 120px`
 *      attributes around poisons later renders.
 *   3. Null refs publish nothing (don't set the variable to `null` or `0`
 *      unexpectedly — fallback should kick in).
 */

import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/useMeasuredStickyOffset';

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

function Harness({
  toolbarHeight,
  summaryHeight,
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
      <div ref={toolbarRef} style={{ height: toolbarHeight }} data-testid="toolbar" />
      {attachSummary && <div ref={summaryRef} style={{ height: summaryHeight }} data-testid="summary" />}
    </div>
  );
}

describe('useMeasuredCssHeights', () => {
  it('publishes each tracked element height as a CSS variable on the target', () => {
    // jsdom doesn't compute layout, so we have to override offsetHeight.
    const offsetHeightStub = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.testid === 'toolbar') return 30;
        if (this.dataset.testid === 'summary') return 24;
        return 0;
      });

    const { getByTestId, unmount } = render(<Harness toolbarHeight={30} summaryHeight={24} />);
    const target = getByTestId('target') as HTMLElement;

    expect(target.style.getPropertyValue('--toolbar-h')).toBe('30px');
    expect(target.style.getPropertyValue('--summary-h')).toBe('24px');

    unmount();
    offsetHeightStub.mockRestore();
  });

  it('removes the variables on unmount (no leftover sticky offsets in the tree)', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40);

    const { getByTestId, unmount } = render(<Harness toolbarHeight={40} summaryHeight={40} />);
    const target = getByTestId('target') as HTMLElement;

    expect(target.style.getPropertyValue('--toolbar-h')).toBe('40px');
    unmount();
    expect(target.style.getPropertyValue('--toolbar-h')).toBe('');
    expect(target.style.getPropertyValue('--summary-h')).toBe('');
  });

  it('skips variables for null refs (lets the CSS fallback win)', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30);

    const { getByTestId } = render(<Harness toolbarHeight={30} summaryHeight={24} attachSummary={false} />);
    const target = getByTestId('target') as HTMLElement;

    expect(target.style.getPropertyValue('--toolbar-h')).toBe('30px');
    expect(target.style.getPropertyValue('--summary-h')).toBe('');
  });
});
