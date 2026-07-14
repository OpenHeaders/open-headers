// @vitest-environment jsdom
/**
 * Cache Storage entries keyboard navigation — StorageGrid's model on a
 * read-only, paginated grid: the entry grid is a focusable `role="grid"`,
 * ArrowUp/ArrowDown walk the page's display order and OPEN the entry
 * document like a click (the row highlight follows via the
 * active-editor-tab derivation — no grid-local selection state), Home/End
 * jump. The walk is page-local: an active document from another page
 * reads as no selection, and the Page keys stay unhandled — the pager
 * buttons are the page gesture. Enter has no gesture (read-only rows;
 * the arrow move already opened the document).
 */

import { CacheStorageSection } from '@openheaders/ui/panel/components/storage/CacheStorageSection';
import type { CacheEntry } from '@openheaders/ui/panel/data/storage/storage-inspector-host';
import type { CacheBrowserState } from '@openheaders/ui/panel/data/storage/use-cache-browser';
import { buildTextPredicate, DEFAULT_TEXT_MATCH_CONFIG } from '@openheaders/ui/panel/data/text-match';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const filterOf = (text: string) => buildTextPredicate(text, DEFAULT_TEXT_MATCH_CONFIG);

beforeAll(() => {
  // jsdom computes no layout and implements no scrollIntoView — the
  // reveal is a no-op stub; the walk/clamp logic is what's under test.
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterEach(cleanup);

function entry(path: string): CacheEntry {
  return { url: `https://openheaders.io${path}`, method: 'GET' };
}

const THREE = [entry('/alpha.js'), entry('/beta.js'), entry('/gamma.js')];

function makeCacheState(entries: ReadonlyArray<CacheEntry>, over: Partial<CacheBrowserState> = {}): CacheBrowserState {
  return {
    caches: [{ name: 'assets' }],
    loading: false,
    selectedCache: 'assets',
    selectCache: vi.fn(),
    closeCache: vi.fn(),
    page: 0,
    setPage: vi.fn(),
    entriesPage: { entries, truncated: false },
    refresh: vi.fn(),
    mutationFailed: false,
    deleteCache: vi.fn(),
    deleteEntry: vi.fn(),
    ...over,
  };
}

function Harness({
  entries,
  onOpenSpy,
}: {
  entries: ReadonlyArray<CacheEntry>;
  onOpenSpy: (url: string, method: string) => void;
}) {
  // The production highlight derives from which entry document is the
  // ACTIVE editor tab; opening an entry activates it. Model exactly that.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  return (
    <CacheStorageSection
      cache={makeCacheState(entries)}
      filter={filterOf('')}
      onOpenEntry={(url, method) => {
        onOpenSpy(url, method);
        setActiveKey(`${method} ${url}`);
      }}
      isEntryActive={(url, method) => `${method} ${url}` === activeKey}
    />
  );
}

function renderEntries(entries: ReadonlyArray<CacheEntry> = THREE) {
  const onOpenSpy = vi.fn();
  const { container } = render(<Harness entries={entries} onOpenSpy={onOpenSpy} />);
  const grid = screen.getByRole('grid', { name: 'Cache entries' }) as HTMLDivElement;
  return { container, grid, onOpenSpy };
}

function activeRowUrl(container: HTMLElement): string | null {
  const row = container.querySelector('.dt-storage-row[aria-selected="true"]');
  return row?.querySelector('.dt-storage-key')?.textContent ?? null;
}

describe('CacheStorageSection entries — keyboard navigation', () => {
  it('exposes the focusable grid anatomy with aria-selected, indexed rows', () => {
    const { container, grid } = renderEntries();
    expect(grid.getAttribute('tabindex')).toBe('0');
    const rows = container.querySelectorAll('.dt-storage-row[role="row"]');
    expect(rows.length).toBe(3);
    rows.forEach((row, i) => {
      expect(row.getAttribute('aria-selected')).toBe('false');
      expect(row.getAttribute('data-entry-index')).toBe(String(i));
    });
  });

  it('ArrowDown walks from the first row, opening the entry document per move, and clamps at the end', () => {
    const { container, grid, onOpenSpy } = renderEntries();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowUrl(container)).toBe('https://openheaders.io/alpha.js');
    expect(onOpenSpy).toHaveBeenLastCalledWith('https://openheaders.io/alpha.js', 'GET');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowUrl(container)).toBe('https://openheaders.io/beta.js');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowUrl(container)).toBe('https://openheaders.io/gamma.js');
    // Clamped at the end: no re-open of the same document.
    expect(onOpenSpy).toHaveBeenCalledTimes(3);
  });

  it('ArrowUp with no active row starts from the last row', () => {
    const { container, grid } = renderEntries();
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(activeRowUrl(container)).toBe('https://openheaders.io/gamma.js');
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(activeRowUrl(container)).toBe('https://openheaders.io/beta.js');
  });

  it('Home and End jump to the first and last row', () => {
    const { container, grid } = renderEntries();
    fireEvent.keyDown(grid, { key: 'End' });
    expect(activeRowUrl(container)).toBe('https://openheaders.io/gamma.js');
    fireEvent.keyDown(grid, { key: 'Home' });
    expect(activeRowUrl(container)).toBe('https://openheaders.io/alpha.js');
  });

  it('click-then-arrow hands off: a row click activates it and the next arrow moves on', () => {
    const { container, grid, onOpenSpy } = renderEntries();
    fireEvent.click(screen.getByTitle('https://openheaders.io/beta.js'));
    expect(onOpenSpy).toHaveBeenLastCalledWith('https://openheaders.io/beta.js', 'GET');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowUrl(container)).toBe('https://openheaders.io/gamma.js');
  });

  it('Enter and the Page keys have no gesture — page-local walk, pager buttons page', () => {
    const { container, grid, onOpenSpy } = renderEntries();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.keyDown(grid, { key: 'Enter' });
    fireEvent.keyDown(grid, { key: 'PageDown' });
    fireEvent.keyDown(grid, { key: 'PageUp' });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(activeRowUrl(container)).toBe('https://openheaders.io/alpha.js');
  });

  it('presses on the row action lane belong to its buttons, not the grid nav', () => {
    const { grid, onOpenSpy } = renderEntries();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.keyDown(screen.getByLabelText('Delete entry https://openheaders.io/alpha.js'), { key: 'ArrowDown' });
    expect(onOpenSpy).not.toHaveBeenCalled();
  });

  it('ignores non-navigation keys and modified presses', () => {
    const { container, grid, onOpenSpy } = renderEntries();
    fireEvent.keyDown(grid, { key: 'a' });
    fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', metaKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', altKey: true });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(activeRowUrl(container)).toBeNull();
  });
});
