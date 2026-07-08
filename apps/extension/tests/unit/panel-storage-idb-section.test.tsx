// @vitest-environment jsdom
/**
 * IndexedDbSection delete affordances — record deletes are gated on the
 * lossless wire key (a record without one renders no delete), and the
 * bulk gestures (store clear, database delete) use the two-step
 * arm/confirm idiom: the first click must never commit.
 */

import { IndexedDbSection } from '@openheaders/ui/panel/components/storage/IndexedDbSection';
import type { IdbDatabase } from '@openheaders/ui/panel/data/storage/storage-inspector-host';
import type { IdbBrowserState } from '@openheaders/ui/panel/data/storage/use-idb-browser';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  it('shows a delete only on rows carrying a wire key and routes it through', () => {
    const idb = makeIdb({
      selection: { database: 'oh-app', store: 'kv' },
      recordsPage: {
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
      },
    });
    render(<IndexedDbSection idb={idb} filter="" />);

    expect(screen.queryByLabelText('Delete record Infinity')).toBeNull();
    fireEvent.click(screen.getByLabelText('Delete record "simple"'));
    expect(idb.deleteRecord).toHaveBeenCalledWith('{"s":"simple"}');
  });
});

describe('IndexedDbSection bulk deletes', () => {
  it('clears a store only on the second (armed) click', () => {
    const idb = makeIdb();
    render(<IndexedDbSection idb={idb} filter="" />);

    const clear = screen.getByLabelText('Clear store kv');
    fireEvent.click(clear);
    expect(idb.clearStore).not.toHaveBeenCalled();
    fireEvent.click(clear);
    expect(idb.clearStore).toHaveBeenCalledWith('oh-app', 'kv');
  });

  it('deletes a database only on the second click, and blur disarms', () => {
    const idb = makeIdb();
    render(<IndexedDbSection idb={idb} filter="" />);

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
