// @vitest-environment jsdom
/**
 * `ChangeCounterLine` — the Commit window's counter of what the commit
 * would take, mounted: a part per kind in the reference's order — added,
 * modified, deleted — each in its change's colour; nothing drawn while
 * nothing is checked; the words while the row has room for them, the
 * marks when it has not, with the words as the marks' tooltip.
 */

import ChangeCounterLine from '@openheaders/ui/workbench/components/panels/git/commit/ChangeCounterLine';
import { changeCounterParts } from '@openheaders/ui/workbench/components/panels/git/commit/commit-model';
import { vcsPalette } from '@openheaders/ui/workbench/components/panels/git/commit/vcs-colors';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterEach(() => {
  cleanup();
  laidOut(0, 0);
});

/** jsdom lays nothing out — the row's room and the width the words would take are pinned per test. */
function laidOut(room: number, words: number): void {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => room });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.getAttribute('aria-hidden') === 'true' ? words : 0;
    },
  });
}

const PARTS = changeCounterParts({ added: 1, unversioned: 2, modified: 2, deleted: 2 });

/** The drawn parts: the kind each is coloured as, and what it reads. */
const drawn = (): (string | null)[][] =>
  [...screen.getByTestId('commit-tool-counter').children].map((part) => [
    part.getAttribute('data-kind'),
    part.textContent,
  ]);

describe('ChangeCounterLine', () => {
  it('reads in words while the row has room: added, modified, deleted, each in its change’s colour', () => {
    laidOut(300, 220);
    render(<ChangeCounterLine parts={PARTS} />);
    expect(screen.getByTestId('commit-tool-counter').getAttribute('data-form')).toBe('words');
    expect(drawn()).toEqual([
      ['added', '1+2 added'],
      ['modified', '2 modified'],
      ['deleted', '2 deleted'],
    ]);
    // One element paints each colour, so the browser's own spelling of it is compared.
    const palette = vcsPalette(false);
    const probe = document.createElement('span');
    const painted = (colour: string): string => {
      probe.style.color = colour;
      return probe.style.color;
    };
    const colours = [...screen.getByTestId('commit-tool-counter').children].map(
      (part) => (part as HTMLElement).style.color,
    );
    expect(colours).toEqual([painted(palette.added), painted(palette.modified), painted(palette.deleted)]);
  });

  it('reads in marks when the words would not fit', () => {
    laidOut(120, 220);
    render(<ChangeCounterLine parts={PARTS} />);
    expect(screen.getByTestId('commit-tool-counter').getAttribute('data-form')).toBe('marks');
    expect(drawn()).toEqual([
      ['added', '+1+2'],
      ['modified', '*2'],
      ['deleted', '-2'],
    ]);
  });

  it('draws nothing while nothing is checked', () => {
    render(<ChangeCounterLine parts={changeCounterParts({ added: 0, unversioned: 0, modified: 0, deleted: 0 })} />);
    expect(screen.queryByTestId('commit-tool-counter')).toBeNull();
  });
});
