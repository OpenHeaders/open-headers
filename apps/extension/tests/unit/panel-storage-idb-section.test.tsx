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
    index: null,
    setIndex: vi.fn(),
    page: 0,
    setPage: vi.fn(),
    recordsPage: null,
    refresh: vi.fn(),
    readRecordValue: vi.fn(() => Promise.resolve(null)),
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

describe('IndexedDbSection value tree', () => {
  it('expands a row into its one-shot value tree and collapses it again', async () => {
    const readRecordValue = vi.fn(() =>
      Promise.resolve({
        kind: 'object',
        preview: '{…1}',
        children: [{ kind: 'string', preview: '"deep"', label: 'note' }],
      }),
    );
    const idb = makeIdb({
      selection: { database: 'oh-app', store: 'kv' },
      readRecordValue,
      recordsPage: {
        records: [
          {
            keyPreview: '"simple"',
            primaryKeyPreview: '"simple"',
            valuePreview: '{…1}',
            primaryKeyWire: '{"s":"simple"}',
          },
        ],
        truncated: false,
      },
    });
    render(<IndexedDbSection idb={idb} filter="" />);

    fireEvent.click(screen.getByLabelText('Expand value for "simple"'));
    expect(readRecordValue).toHaveBeenCalledWith('{"s":"simple"}');
    expect(await screen.findByText('note:')).toBeTruthy();
    expect(screen.getByText('"deep"')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Expand value for "simple"'));
    expect(screen.queryByText('note:')).toBeNull();
    expect(readRecordValue).toHaveBeenCalledTimes(1);
  });

  it('renders the failure note when the record value is gone', async () => {
    const idb = makeIdb({
      selection: { database: 'oh-app', store: 'kv' },
      recordsPage: {
        records: [{ keyPreview: '1', primaryKeyPreview: '1', valuePreview: '1', primaryKeyWire: '{"n":1}' }],
        truncated: false,
      },
    });
    render(<IndexedDbSection idb={idb} filter="" />);

    fireEvent.click(screen.getByLabelText('Expand value for 1'));
    expect(await screen.findByText(/can’t be read/)).toBeTruthy();
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
    render(<IndexedDbSection idb={idb} filter="" />);

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
    render(<IndexedDbSection idb={idb} filter="" />);
    expect(screen.queryByLabelText('Record cursor')).toBeNull();
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
