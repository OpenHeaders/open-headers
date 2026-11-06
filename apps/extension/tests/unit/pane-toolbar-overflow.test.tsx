// @vitest-environment jsdom
/**
 * PaneToolbar — mounted pin for the horizontal band's fold: with the
 * band measured narrower than its run, the leading buttons that fit
 * stay, the › chevron takes the right edge, and hovering it lays the
 * folded buttons out in the strip; the spacer never joins the strip.
 */

import PaneToolbar, {
  type PaneToolbarEntry,
} from '@openheaders/ui/workbench/components/panels/git/toolbar/PaneToolbar';
import ToolbarIconButton from '@openheaders/ui/workbench/components/panels/git/toolbar/ToolbarIconButton';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

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

/** jsdom lays nothing out — the band's clientWidth is pinned per test. */
function bandWidth(width: number): void {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
}

const button = (key: string): PaneToolbarEntry => ({
  kind: 'item',
  key,
  node: <ToolbarIconButton icon={<span>{key}</span>} title={key} testid={`band-${key}`} />,
});

// diff revert eye | <spacer> | expand collapse — the details band's shape.
const entries: PaneToolbarEntry[] = [
  button('diff'),
  button('revert'),
  button('eye'),
  { kind: 'spacer', key: 'spacer' },
  button('expand'),
  button('collapse'),
];

describe('PaneToolbar', () => {
  it('keeps every button in the band when the run fits', () => {
    bandWidth(400);
    render(<PaneToolbar entries={entries} testid="band" />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.queryByTestId('band-more-button')).toBeNull();
  });

  it('folds the tail behind the chevron and lays it out in the strip on hover, the spacer left out', async () => {
    // 16px padding + room for two buttons beside the chevron: 16 + 24 + 2 + 24 + 2 + 24 = 92.
    bandWidth(92);
    render(<PaneToolbar entries={entries} testid="band" />);
    const band = screen.getByTestId('band');
    expect([...band.querySelectorAll('button')].map((el) => el.getAttribute('data-testid'))).toEqual([
      'band-diff',
      'band-revert',
      'band-more-button',
    ]);
    fireEvent.mouseEnter(screen.getByTestId('band-more-button'));
    const strip = await screen.findByTestId('band-overflow');
    expect([...strip.querySelectorAll('button')].map((el) => el.getAttribute('data-testid'))).toEqual([
      'band-eye',
      'band-expand',
      'band-collapse',
    ]);
  });
});
