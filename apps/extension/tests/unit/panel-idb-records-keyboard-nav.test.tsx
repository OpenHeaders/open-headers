// @vitest-environment jsdom
/**
 * IndexedDB records keyboard navigation — StorageGrid's model on a
 * read-only, paginated grid: the records grid is a focusable
 * `role="grid"` (the per-row tabIndex/Enter it predated the model with
 * is gone), ArrowUp/ArrowDown walk the page's display order and OPEN the
 * record document like a click (the row highlight follows via the
 * active-editor-tab derivation — no grid-local selection state),
 * Home/End jump. The walk is page-local and the Page keys stay
 * unhandled — the pager buttons are the page gesture. Enter has no
 * gesture (read-only rows; the arrow move already opened the document),
 * and a rare row without a wire key is the same visual no-op an arrow
 * move onto it is as a click on it.
 */

import { IndexedDbSection, type OpenIdbRecordRequest } from '@openheaders/ui/panel/components/storage/IndexedDbSection';
import type { IdbRecord } from '@openheaders/ui/panel/data/storage/storage-inspector-host';
import type { IdbBrowserState } from '@openheaders/ui/panel/data/storage/use-idb-browser';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  // jsdom computes no layout and implements no scrollIntoView — the
  // reveal is a no-op stub; the walk/clamp logic is what's under test.
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterEach(cleanup);

function record(key: string, over: Partial<IdbRecord> = {}): IdbRecord {
  return {
    keyPreview: key,
    primaryKeyPreview: key,
    valuePreview: `{ id: "${key}" }`,
    primaryKeyWire: `wire:${key}`,
    ...over,
  };
}

const THREE = [record('alpha'), record('beta'), record('gamma')];

function makeIdbState(records: ReadonlyArray<IdbRecord>, over: Partial<IdbBrowserState> = {}): IdbBrowserState {
  return {
    databases: [
      {
        name: 'app-db',
        version: 1,
        objectStores: [{ name: 'sessions', keyPath: 'id', autoIncrement: false, indexNames: [] }],
      },
    ],
    loading: false,
    selection: { database: 'app-db', store: 'sessions' },
    selectStore: vi.fn(),
    closeStore: vi.fn(),
    index: null,
    setIndex: vi.fn(),
    page: 0,
    setPage: vi.fn(),
    recordsPage: { records, truncated: false },
    refresh: vi.fn(),
    mutationFailed: false,
    deleteRecord: vi.fn(),
    clearStore: vi.fn(),
    deleteDatabase: vi.fn(),
    ...over,
  };
}

function Harness({
  records,
  onOpenSpy,
}: {
  records: ReadonlyArray<IdbRecord>;
  onOpenSpy: (request: OpenIdbRecordRequest) => void;
}) {
  // The production highlight derives from which record document is the
  // ACTIVE editor tab; opening a record activates it. Model exactly that.
  const [activeWire, setActiveWire] = useState<string | null>(null);
  return (
    <IndexedDbSection
      idb={makeIdbState(records)}
      filter=""
      onOpenRecord={(request) => {
        onOpenSpy(request);
        setActiveWire(request.primaryKeyWire);
      }}
      isRecordActive={(database, store, primaryKeyWire) =>
        database === 'app-db' && store === 'sessions' && primaryKeyWire === activeWire
      }
    />
  );
}

function renderRecords(records: ReadonlyArray<IdbRecord> = THREE) {
  const onOpenSpy = vi.fn();
  const { container } = render(<Harness records={records} onOpenSpy={onOpenSpy} />);
  const grid = screen.getByRole('grid', { name: 'IndexedDB records' }) as HTMLDivElement;
  return { container, grid, onOpenSpy };
}

function activeRowKey(container: HTMLElement): string | null {
  const row = container.querySelector('.dt-storage-row[aria-selected="true"]');
  return row?.querySelector('.dt-storage-key')?.textContent ?? null;
}

describe('IndexedDbSection records — keyboard navigation', () => {
  it('exposes the focusable grid anatomy with aria-selected, indexed rows and no per-row tabstops', () => {
    const { container, grid } = renderRecords();
    expect(grid.getAttribute('tabindex')).toBe('0');
    const rows = container.querySelectorAll('.dt-storage-row[role="row"]');
    expect(rows.length).toBe(3);
    rows.forEach((row, i) => {
      expect(row.getAttribute('aria-selected')).toBe('false');
      expect(row.getAttribute('data-entry-index')).toBe(String(i));
      expect(row.getAttribute('tabindex')).toBeNull();
    });
  });

  it('ArrowDown walks from the first row, opening the record document per move, and clamps at the end', () => {
    const { container, grid, onOpenSpy } = renderRecords();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowKey(container)).toBe('alpha');
    expect(onOpenSpy).toHaveBeenLastCalledWith({
      database: 'app-db',
      store: 'sessions',
      primaryKeyWire: 'wire:alpha',
      keyPreview: 'alpha',
    });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowKey(container)).toBe('beta');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowKey(container)).toBe('gamma');
    // Clamped at the end: no re-open of the same document.
    expect(onOpenSpy).toHaveBeenCalledTimes(3);
  });

  it('ArrowUp with no active row starts from the last row', () => {
    const { container, grid } = renderRecords();
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(activeRowKey(container)).toBe('gamma');
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(activeRowKey(container)).toBe('beta');
  });

  it('Home and End jump to the first and last row', () => {
    const { container, grid } = renderRecords();
    fireEvent.keyDown(grid, { key: 'End' });
    expect(activeRowKey(container)).toBe('gamma');
    fireEvent.keyDown(grid, { key: 'Home' });
    expect(activeRowKey(container)).toBe('alpha');
  });

  it('click-then-arrow hands off: a row click activates it and the next arrow moves on', () => {
    const { container, grid, onOpenSpy } = renderRecords();
    const betaRow = container.querySelector('.dt-storage-row[data-entry-index="1"]');
    if (betaRow === null) throw new Error('beta row not rendered');
    fireEvent.click(betaRow);
    expect(onOpenSpy).toHaveBeenLastCalledWith(expect.objectContaining({ primaryKeyWire: 'wire:beta' }));
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowKey(container)).toBe('gamma');
  });

  it('a walk onto a row without a wire key opens nothing, like a click on it', () => {
    const { container, grid, onOpenSpy } = renderRecords([
      record('alpha'),
      record('keyless', { primaryKeyWire: undefined }),
    ]);
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(activeRowKey(container)).toBe('alpha');
  });

  it('Enter and the Page keys have no gesture — page-local walk, pager buttons page', () => {
    const { container, grid, onOpenSpy } = renderRecords();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.keyDown(grid, { key: 'Enter' });
    fireEvent.keyDown(grid, { key: 'PageDown' });
    fireEvent.keyDown(grid, { key: 'PageUp' });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(activeRowKey(container)).toBe('alpha');
  });

  it('presses on the row action lane belong to its buttons, not the grid nav', () => {
    const { grid, onOpenSpy } = renderRecords();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.keyDown(screen.getByLabelText('Delete record alpha'), { key: 'ArrowDown' });
    expect(onOpenSpy).not.toHaveBeenCalled();
  });

  it('ignores non-navigation keys and modified presses', () => {
    const { container, grid, onOpenSpy } = renderRecords();
    fireEvent.keyDown(grid, { key: 'a' });
    fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', metaKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', altKey: true });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(activeRowKey(container)).toBeNull();
  });
});
