// @vitest-environment jsdom
/**
 * The merge editor's file rail: it renders whatever it is handed — one
 * file included, under its group — marks the open file, and hands a
 * click on any row back as that file's id.
 */

import { type MergeFile, MergeFileList } from '@openheaders/ui/shared/merge-editor';
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
});
