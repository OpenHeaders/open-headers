// @vitest-environment jsdom
/**
 * StorageGrid keyboard navigation — the grid is a focusable `role="grid"`:
 * ArrowUp/ArrowDown walk the entries' display order and OPEN the entry
 * document like a click (the row highlight follows via the
 * active-editor-tab derivation — no grid-local selection state), Home/End
 * jump to the ends, and Enter starts the inline edit on the active row
 * (double-click parity). The nav handler stands down while an edit/add
 * row is mounted and for presses on interactive children — the edit-row
 * inputs' own Enter/Escape/⌘S handling must never fight the arrows.
 *
 * The harness mirrors the production wiring: opening an entry makes it
 * the ACTIVE document, exactly one row reads active at a time.
 */

import { StorageGrid } from '@openheaders/ui/panel/components/storage/StorageGrid';
import type { DomStorageEntry } from '@openheaders/ui/panel/data/storage/storage-inspector-host';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  // jsdom computes no layout and implements no scrollIntoView — the
  // reveal is a no-op stub here; the walk/clamp logic is what's under test.
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterEach(cleanup);

function entry(key: string, value: string): DomStorageEntry {
  return { key, value, valueLength: value.length };
}

const THREE = [entry('alpha', '1'), entry('beta', '2'), entry('gamma', '3')];

function Harness({
  entries,
  adding = false,
  onOpenSpy,
}: {
  entries: ReadonlyArray<DomStorageEntry>;
  adding?: boolean;
  onOpenSpy: (key: string) => void;
}) {
  // The production highlight derives from which entry document is the
  // ACTIVE editor tab; opening an entry activates it. Model exactly that.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  return (
    <StorageGrid
      area="local"
      entries={entries}
      adding={adding}
      onCloseAdd={() => {}}
      onCommit={vi.fn().mockResolvedValue(true)}
      onRemove={vi.fn().mockResolvedValue(true)}
      fetchFullValue={vi.fn().mockResolvedValue(null)}
      onOpenEntry={(key) => {
        onOpenSpy(key);
        setActiveKey(key);
      }}
      isEntryActive={(key) => key === activeKey}
    />
  );
}

function renderGrid(entries: ReadonlyArray<DomStorageEntry> = THREE, adding = false) {
  const onOpenSpy = vi.fn();
  const { container } = render(<Harness entries={entries} adding={adding} onOpenSpy={onOpenSpy} />);
  const grid = screen.getByRole('grid', { name: 'Storage entries' }) as HTMLDivElement;
  return { container, grid, onOpenSpy };
}

function activeRowKey(container: HTMLElement): string | null {
  const row = container.querySelector('.dt-storage-row[aria-selected="true"]');
  return row?.querySelector('.dt-storage-key')?.textContent ?? null;
}

describe('StorageGrid — keyboard navigation', () => {
  it('exposes the focusable grid anatomy with aria-selected rows', () => {
    const { container, grid } = renderGrid();
    expect(grid.getAttribute('tabindex')).toBe('0');
    const rows = container.querySelectorAll('.dt-storage-row[role="row"]');
    expect(rows.length).toBe(3);
    for (const row of rows) expect(row.getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowDown walks from the first row, opening the entry document per move, and clamps at the end', () => {
    const { container, grid, onOpenSpy } = renderGrid();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowKey(container)).toBe('alpha');
    expect(onOpenSpy).toHaveBeenLastCalledWith('alpha');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowKey(container)).toBe('beta');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowKey(container)).toBe('gamma');
    // Clamped at the end: no re-open of the same document.
    expect(onOpenSpy).toHaveBeenCalledTimes(3);
  });

  it('ArrowUp with no active row starts from the last row', () => {
    const { container, grid } = renderGrid();
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(activeRowKey(container)).toBe('gamma');
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(activeRowKey(container)).toBe('beta');
  });

  it('Home and End jump to the first and last row', () => {
    const { container, grid } = renderGrid();
    fireEvent.keyDown(grid, { key: 'End' });
    expect(activeRowKey(container)).toBe('gamma');
    fireEvent.keyDown(grid, { key: 'Home' });
    expect(activeRowKey(container)).toBe('alpha');
  });

  it('click-then-arrow hands off: a row click activates it and the next arrow moves on', () => {
    const { container, grid, onOpenSpy } = renderGrid();
    fireEvent.click(screen.getByTitle('beta'));
    expect(onOpenSpy).toHaveBeenLastCalledWith('beta');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowKey(container)).toBe('gamma');
  });

  it('Enter starts the inline edit on the active row and focuses its key input', () => {
    const { grid } = renderGrid();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    const keyInput = screen.getByLabelText('Entry key') as HTMLInputElement;
    expect(keyInput.value).toBe('alpha');
    expect(document.activeElement).toBe(keyInput);
  });

  it('Enter with no active row does nothing', () => {
    renderGrid();
    const grid = screen.getByRole('grid', { name: 'Storage entries' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(screen.queryByLabelText('Entry key')).toBeNull();
  });

  it('Escape closes the edit, parks focus back on the grid, and the arrows resume', () => {
    const { container, grid } = renderGrid();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    fireEvent.keyDown(screen.getByLabelText('Entry key'), { key: 'Escape' });
    expect(screen.queryByLabelText('Entry key')).toBeNull();
    expect(document.activeElement).toBe(grid);
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowKey(container)).toBe('beta');
  });

  it('arrows inside the edit row never move the selection or open documents', () => {
    const { container, grid, onOpenSpy } = renderGrid();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.keyDown(grid, { key: 'Enter' });
    const valueInput = screen.getByLabelText('Entry value');
    fireEvent.keyDown(valueInput, { key: 'ArrowDown' });
    fireEvent.keyDown(valueInput, { key: 'ArrowUp' });
    expect(onOpenSpy).not.toHaveBeenCalled();
    // The edit row is still mounted and still holds alpha — the arrows
    // neither closed it nor walked the selection; the active row
    // resurfaces intact once the edit closes.
    expect((screen.getByLabelText('Entry key') as HTMLInputElement).value).toBe('alpha');
    fireEvent.keyDown(screen.getByLabelText('Entry key'), { key: 'Escape' });
    expect(activeRowKey(container)).toBe('alpha');
  });

  it('never navigates or opens while the add row is mounted', () => {
    const { grid, onOpenSpy } = renderGrid(THREE, true);
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Entry key')).toBeNull();
    // Typing in the add row's inputs stays the add row's business.
    const addKey = screen.getByLabelText('New entry key');
    fireEvent.keyDown(addKey, { key: 'ArrowDown' });
    expect(onOpenSpy).not.toHaveBeenCalled();
  });

  it('presses on the row action lane belong to its buttons, not the grid nav', () => {
    const { grid, onOpenSpy } = renderGrid();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.keyDown(screen.getByLabelText('Delete alpha'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByLabelText('Edit alpha'), { key: 'ArrowDown' });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Entry key')).toBeNull();
  });

  it('ignores non-navigation keys and modified presses', () => {
    const { container, grid, onOpenSpy } = renderGrid();
    fireEvent.keyDown(grid, { key: 'a' });
    fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', metaKey: true });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(activeRowKey(container)).toBeNull();
  });
});
