// @vitest-environment jsdom
/**
 * IndexedDbSection affordances — clicking a record row opens it as an
 * editor-tab document (gated on the lossless wire key; a row without
 * one is inert), record deletes stop the click from also opening, and
 * the bulk gestures (store clear, database delete) use the two-step
 * arm/confirm idiom: the first click must never commit.
 */

import { IndexedDbSection } from '@openheaders/ui/panel/components/storage/IndexedDbSection';
import type { IdbDatabase } from '@openheaders/ui/panel/data/storage/storage-inspector-host';
import type { IdbBrowserState } from '@openheaders/ui/panel/data/storage/use-idb-browser';
import { buildTextPredicate, DEFAULT_TEXT_MATCH_CONFIG } from '@openheaders/ui/panel/data/text-match';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const filterOf = (text: string) => buildTextPredicate(text, DEFAULT_TEXT_MATCH_CONFIG);

afterEach(() => {
  cleanup();
});

const DB: IdbDatabase = {
  name: 'oh-app',
  version: 3,
  objectStores: [{ name: 'kv', keyPath: 'id', autoIncrement: false, indexNames: [] }],
};

function makeIdb(overrides: Partial<IdbBrowserState> = {}): IdbBrowserState {
  return {
    databases: [DB],
    loading: false,
    selection: null,
    selectStore: vi.fn(),
    closeStore: vi.fn(),
    index: null,
    setIndex: vi.fn(),
    page: 0,
    setPage: vi.fn(),
    recordsPage: null,
    refresh: vi.fn(),
    mutationFailed: false,
    deleteRecord: vi.fn(),
    clearStore: vi.fn(),
    deleteDatabase: vi.fn(),
    ...overrides,
  };
}

describe('IndexedDbSection records view', () => {
  const RECORDS_PAGE = {
    records: [
      {
        keyPreview: '"simple"',
        primaryKeyPreview: '"simple"',
        valuePreview: '1',
        primaryKeyWire: '{"s":"simple"}',
      },
      { keyPreview: 'Infinity', primaryKeyPreview: 'Infinity', valuePreview: '2' },
    ],
    truncated: false,
  };

  it('opens a record as an editor document on row click, gated on the wire key', () => {
    const onOpenRecord = vi.fn();
    const idb = makeIdb({ selection: { database: 'oh-app', store: 'kv' }, recordsPage: RECORDS_PAGE });
    render(<IndexedDbSection idb={idb} filter={filterOf('')} onOpenRecord={onOpenRecord} />);

    fireEvent.click(screen.getByTitle('Open this record in the editor'));
    expect(onOpenRecord).toHaveBeenCalledWith({
      database: 'oh-app',
      store: 'kv',
      primaryKeyWire: '{"s":"simple"}',
      keyPreview: '"simple"',
    });

    // The wire-less row is inert — no open request fires.
    onOpenRecord.mockClear();
    fireEvent.click(screen.getByText('Infinity'));
    expect(onOpenRecord).not.toHaveBeenCalled();
  });

  it('shows a delete only on rows carrying a wire key, and deleting never also opens', () => {
    const onOpenRecord = vi.fn();
    const idb = makeIdb({ selection: { database: 'oh-app', store: 'kv' }, recordsPage: RECORDS_PAGE });
    render(<IndexedDbSection idb={idb} filter={filterOf('')} onOpenRecord={onOpenRecord} />);

    expect(screen.queryByLabelText('Delete record Infinity')).toBeNull();
    fireEvent.click(screen.getByLabelText('Delete record "simple"'));
    expect(idb.deleteRecord).toHaveBeenCalledWith('{"s":"simple"}');
    expect(onOpenRecord).not.toHaveBeenCalled();
  });

  it('highlights exactly the active editor tab’s record row', () => {
    const idb = makeIdb({ selection: { database: 'oh-app', store: 'kv' }, recordsPage: RECORDS_PAGE });
    const isRecordActive = vi.fn(
      (database: string, store: string, wire: string) =>
        database === 'oh-app' && store === 'kv' && wire === '{"s":"simple"}',
    );
    render(<IndexedDbSection idb={idb} filter={filterOf('')} onOpenRecord={vi.fn()} isRecordActive={isRecordActive} />);

    const rows = screen.getAllByRole('row').filter((r) => r.classList.contains('dt-storage-row'));
    expect(rows[0]?.classList.contains('dt-storage-row--active')).toBe(true);
    expect(rows[1]?.classList.contains('dt-storage-row--active')).toBe(false);
  });
});

describe('IndexedDbSection index cursor selector', () => {
  const INDEXED_DB: IdbDatabase = {
    ...DB,
    objectStores: [{ name: 'kv', keyPath: 'id', autoIncrement: false, indexNames: ['by-user'] }],
  };

  it('offers the store indexes as cursor choices and routes the selection', () => {
    const idb = makeIdb({
      databases: [INDEXED_DB],
      selection: { database: 'oh-app', store: 'kv' },
      recordsPage: { records: [], truncated: false },
    });
    render(<IndexedDbSection idb={idb} filter={filterOf('')} onOpenRecord={vi.fn()} />);

    const select = screen.getByLabelText('Record cursor');
    fireEvent.change(select, { target: { value: 'by-user' } });
    expect(idb.setIndex).toHaveBeenCalledWith('by-user');
    fireEvent.change(select, { target: { value: '' } });
    expect(idb.setIndex).toHaveBeenCalledWith(null);
  });

  it('renders no cursor selector for a store without indexes', () => {
    const idb = makeIdb({
      selection: { database: 'oh-app', store: 'kv' },
      recordsPage: { records: [], truncated: false },
    });
    render(<IndexedDbSection idb={idb} filter={filterOf('')} onOpenRecord={vi.fn()} />);
    expect(screen.queryByLabelText('Record cursor')).toBeNull();
  });
});

describe('IndexedDbSection bulk deletes', () => {
  it('clears a store only on the second (armed) click', () => {
    const idb = makeIdb();
    render(<IndexedDbSection idb={idb} filter={filterOf('')} onOpenRecord={vi.fn()} />);

    const clear = screen.getByLabelText('Clear store kv');
    fireEvent.click(clear);
    expect(idb.clearStore).not.toHaveBeenCalled();
    fireEvent.click(clear);
    expect(idb.clearStore).toHaveBeenCalledWith('oh-app', 'kv');
  });

  it('deletes a database only on the second click, and blur disarms', () => {
    const idb = makeIdb();
    render(<IndexedDbSection idb={idb} filter={filterOf('')} onOpenRecord={vi.fn()} />);

    const del = screen.getByLabelText('Delete database oh-app');
    fireEvent.click(del);
    expect(idb.deleteDatabase).not.toHaveBeenCalled();

    fireEvent.blur(del);
    fireEvent.click(del);
    expect(idb.deleteDatabase).not.toHaveBeenCalled();

    fireEvent.click(del);
    expect(idb.deleteDatabase).toHaveBeenCalledWith('oh-app');
  });
});
