// @vitest-environment jsdom
/**
 * StorageGrid write affordances — the DOM storage grid's add / inline
 * edit / delete plumbing, and the clipped-value edit gate: editing a
 * clipped entry MUST go through the lazy full-value fetch first (saving
 * the preview back would corrupt the value), and a value past the edit
 * ceiling blocks with a note instead of committing.
 */

import type { DomStorageEntry, DomStorageFullValue } from '@openheaders/ui/panel/data/storage/storage-inspector-host';
import { StorageGrid } from '@openheaders/ui/panel/components/storage/StorageGrid';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

function entry(overrides: Partial<DomStorageEntry> & { key: string }): DomStorageEntry {
  return { value: '', valueLength: 0, ...overrides };
}

interface Handlers {
  onCloseAdd?: () => void;
  onCommit?: (originalKey: string | null, key: string, value: string) => Promise<boolean>;
  onRemove?: (key: string) => Promise<boolean>;
  fetchFullValue?: (key: string) => Promise<DomStorageFullValue | null>;
}

function renderGrid(entries: DomStorageEntry[], adding = false, handlers: Handlers = {}) {
  const onCommit = handlers.onCommit ?? vi.fn().mockResolvedValue(true);
  const onRemove = handlers.onRemove ?? vi.fn().mockResolvedValue(true);
  const fetchFullValue = handlers.fetchFullValue ?? vi.fn().mockResolvedValue(null);
  const onCloseAdd = handlers.onCloseAdd ?? vi.fn();
  render(
    <StorageGrid
      entries={entries}
      adding={adding}
      onCloseAdd={onCloseAdd}
      onCommit={onCommit}
      onRemove={onRemove}
      fetchFullValue={fetchFullValue}
    />,
  );
  return { onCommit, onRemove, fetchFullValue, onCloseAdd };
}

describe('StorageGrid', () => {
  it('edits an unclipped row inline without a full-value fetch and commits on Enter', async () => {
    const { onCommit, fetchFullValue } = renderGrid([entry({ key: 'theme', value: 'dark', valueLength: 4 })]);

    fireEvent.doubleClick(screen.getByTitle('theme'));
    expect(fetchFullValue).not.toHaveBeenCalled();

    const valueInput = screen.getByLabelText('Entry value') as HTMLInputElement;
    expect(valueInput.value).toBe('dark');
    fireEvent.change(valueInput, { target: { value: 'light' } });
    fireEvent.keyDown(valueInput, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('theme', 'theme', 'light');
  });

  it('fetches the full value before editing a clipped row', async () => {
    const fetchFullValue = vi.fn().mockResolvedValue({ value: 'full-value', tooLarge: false });
    renderGrid([entry({ key: 'big', value: 'ful', valueLength: 100, clipped: true })], false, { fetchFullValue });

    fireEvent.doubleClick(screen.getByTitle('big'));
    expect(fetchFullValue).toHaveBeenCalledWith('big');
    await waitFor(() => {
      expect((screen.getByLabelText('Entry value') as HTMLInputElement).value).toBe('full-value');
    });
  });

  it('blocks the edit with a note when the full value is past the ceiling', async () => {
    const fetchFullValue = vi.fn().mockResolvedValue({ value: null, tooLarge: true });
    const onCommit = vi.fn().mockResolvedValue(true);
    renderGrid([entry({ key: 'huge', value: 'pre', valueLength: 9999999, clipped: true })], false, {
      fetchFullValue,
      onCommit,
    });

    fireEvent.doubleClick(screen.getByTitle('huge'));
    await waitFor(() => {
      expect(screen.getByText(/Too large to edit here/)).toBeTruthy();
    });
    const keyInput = screen.getByLabelText('Entry key') as HTMLInputElement;
    expect(keyInput.disabled).toBe(true);
    fireEvent.keyDown(keyInput, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits an add row with a null originalKey and closes it on success', async () => {
    const onCommit = vi.fn().mockResolvedValue(true);
    const onCloseAdd = vi.fn();
    renderGrid([], true, { onCommit, onCloseAdd });

    fireEvent.change(screen.getByLabelText('New entry key'), { target: { value: 'token' } });
    const valueInput = screen.getByLabelText('New entry value');
    fireEvent.change(valueInput, { target: { value: 'abc' } });
    fireEvent.keyDown(valueInput, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(null, 'token', 'abc');
    await waitFor(() => {
      expect(onCloseAdd).toHaveBeenCalled();
    });
  });

  it('does not commit an add row without a key', () => {
    const onCommit = vi.fn().mockResolvedValue(true);
    renderGrid([], true, { onCommit });

    const valueInput = screen.getByLabelText('New entry value');
    fireEvent.change(valueInput, { target: { value: 'orphan' } });
    fireEvent.keyDown(valueInput, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('deletes a row through its action lane', () => {
    const onRemove = vi.fn().mockResolvedValue(true);
    renderGrid([entry({ key: 'a', value: '1', valueLength: 1 })], false, { onRemove });

    fireEvent.click(screen.getByLabelText('Delete a'));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('cancels an edit on Escape without committing', () => {
    const onCommit = vi.fn().mockResolvedValue(true);
    renderGrid([entry({ key: 'k', value: 'v', valueLength: 1 })], false, { onCommit });

    fireEvent.doubleClick(screen.getByTitle('k'));
    const valueInput = screen.getByLabelText('Entry value');
    fireEvent.keyDown(valueInput, { key: 'Escape' });
    expect(screen.queryByLabelText('Entry value')).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
