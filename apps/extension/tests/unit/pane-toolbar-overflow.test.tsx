// @vitest-environment jsdom
/**
 * PaneToolbar — mounted pin for the horizontal band's fold: with the
 * band measured narrower than its run, the leading buttons that fit
 * stay, the › chevron takes the right edge, and hovering it lays the
 * folded buttons out in the strip; the spacer never joins the strip.
 * A band led by a control that is no entry keeps that control's floor
 * and folds by the widths its entries have where they stand.
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

afterEach(() => {
  cleanup();
  entryWidths({});
});

/** jsdom lays nothing out — the band's clientWidth is pinned per test. */
function bandWidth(width: number): void {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
}

/**
 * The widths the band reads off its entries where they stand, by entry
 * key; an entry not listed reads zero, as everything does in jsdom, and
 * the band's default (a button's 24px) stands for it.
 */
function entryWidths(widths: Record<string, number>): void {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return widths[this.dataset.overflowKey ?? ''] ?? 0;
    },
  });
}

const chip = (key: string): PaneToolbarEntry => ({
  kind: 'item',
  key,
  node: (
    <button type="button" data-testid={`band-${key}`}>
      {key}
    </button>
  ),
});

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

  describe('led by a field, with chips as wide as their words', () => {
    // field | branch user <spacer> refresh goto — the log band's shape in small.
    const led: PaneToolbarEntry[] = [
      chip('branch'),
      chip('user'),
      { kind: 'spacer', key: 'spacer' },
      button('refresh'),
      button('goto'),
    ];
    const lead = { node: <input data-testid="band-field" />, basis: 220, floor: 140 };
    const inBand = (): (string | null)[] =>
      [...screen.getByTestId('band').querySelectorAll('button')].map((el) => el.getAttribute('data-testid'));
    const mount = (width: number): void => {
      bandWidth(width);
      entryWidths({ branch: 70, user: 54 });
      render(<PaneToolbar entries={led} testid="band" lead={lead} gap={6} />);
    };

    it('keeps every entry while the run fits beside the field at its floor', () => {
      // 16 padding + the field's 140 + 6, then 70 + 6 + 54 + 6 + 0 + 6 + 24 + 6 + 24 = 196: 358 in all.
      mount(358);
      expect(inBand()).toEqual(['band-branch', 'band-user', 'band-refresh', 'band-goto']);
      expect(screen.getByTestId('band-field')).toBeTruthy();
    });

    it('folds the far end first, one pixel short — the chips stay, the field stays', async () => {
      // 195 for the entries, 165 beside the chevron: the two chips (130) and the spacer (136) fit, refresh (166) does not.
      mount(357);
      expect(inBand()).toEqual(['band-branch', 'band-user', 'band-more-button']);
      fireEvent.mouseEnter(screen.getByTestId('band-more-button'));
      const strip = await screen.findByTestId('band-overflow');
      expect([...strip.querySelectorAll('button')].map((el) => el.getAttribute('data-testid'))).toEqual([
        'band-refresh',
        'band-goto',
      ]);
      expect(screen.getByTestId('band-field')).toBeTruthy();
    });

    it("folds a chip by its own width, not a button's — and the field alone stays beside the chevron", async () => {
      // 99 for the entries, 69 beside the chevron: the first chip is 70 wide.
      mount(261);
      expect(inBand()).toEqual(['band-more-button']);
      expect(screen.getByTestId('band-field')).toBeTruthy();
      fireEvent.mouseEnter(screen.getByTestId('band-more-button'));
      const strip = await screen.findByTestId('band-overflow');
      expect([...strip.querySelectorAll('button')].map((el) => el.getAttribute('data-testid'))).toEqual([
        'band-branch',
        'band-user',
        'band-refresh',
        'band-goto',
      ]);
    });
  });
});
