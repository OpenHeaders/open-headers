// @vitest-environment jsdom
/**
 * The merge editor's file rail: it renders whatever it is handed — one
 * file included, under its group — marks the open file, and hands a
 * click on any row back as that file's id. Collapsed, it is a strip of
 * one chip per file in the same order, wearing the caller's icon where
 * one is given and the kind glyph where none is.
 */

import { type MergeFile, MergeFileList, MergeFileStrip } from '@openheaders/ui/shared/merge-editor';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // The editor's barrel loads the code editor, which probes this jsdom-missing API at import.
  if (typeof document.queryCommandSupported !== 'function') {
    document.queryCommandSupported = () => false;
  }
});

const file = (id: string, group: string): MergeFile => ({
  id,
  label: id.slice(id.lastIndexOf('/') + 1),
  group,
  kind: 'modify',
  theirs: 'name: theirs\n',
  mine: 'name: mine\n',
  initialResult: 'name: mine\n',
});

const PROBE = file('requests/probe/request.yaml', 'requests/probe');
const ORDERS = file('notes/orders.md', 'notes');

afterEach(cleanup);

describe('MergeFileList', () => {
  it('lists a single file under its group, as the open one', () => {
    render(
      <MergeFileList
        files={[PROBE]}
        activeFileId={PROBE.id}
        hunkCounts={new Map([[PROBE.id, 2]])}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('requests/probe')).toBeTruthy();
    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toBe('·request.yaml2unresolved');
    expect(rows[0].getAttribute('aria-current')).toBe('true');
  });

  it('marks only the open file, and a click on another hands its id back', () => {
    const onSelect = vi.fn();
    render(<MergeFileList files={[PROBE, ORDERS]} activeFileId={PROBE.id} onSelect={onSelect} />);
    const [orders, probe] = screen.getAllByRole('button');
    expect(orders.textContent).toContain('orders.md');
    expect(orders.getAttribute('aria-current')).toBe('false');
    expect(probe.getAttribute('aria-current')).toBe('true');
    fireEvent.click(orders);
    expect(onSelect).toHaveBeenCalledWith(ORDERS.id);
  });

  it('wears the caller’s icon before the name, and the kind glyph where the caller gives none', () => {
    const renderIcon = (shown: MergeFile) => (shown.id === PROBE.id ? <i data-testid="own-icon" /> : null);
    render(
      <MergeFileList files={[PROBE, ORDERS]} activeFileId={PROBE.id} renderIcon={renderIcon} onSelect={vi.fn()} />,
    );
    const [orders, probe] = screen.getAllByRole('button');
    expect(probe.querySelector('[data-testid="own-icon"]')).not.toBeNull();
    expect(probe.textContent).toBe('request.yamlunresolved');
    expect(orders.textContent).toBe('·orders.mdunresolved');
  });
});

describe('MergeFileStrip', () => {
  it('is one chip per file in the rail’s order, named by its file, the open one marked', () => {
    const onSelect = vi.fn();
    const renderIcon = (shown: MergeFile) => <i data-testid={`icon-${shown.label}`} />;
    render(
      <MergeFileStrip files={[PROBE, ORDERS]} activeFileId={PROBE.id} renderIcon={renderIcon} onSelect={onSelect} />,
    );
    const chips = screen.getAllByRole('button');
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual(['orders.md', 'request.yaml']);
    expect(chips.map((chip) => chip.getAttribute('aria-current'))).toEqual(['false', 'true']);
    expect(chips[0].querySelector('[data-testid="icon-orders.md"]')).not.toBeNull();
    expect(chips[0].textContent).toBe('');
    fireEvent.click(chips[0]);
    expect(onSelect).toHaveBeenCalledWith(ORDERS.id);
  });
});
