// @vitest-environment jsdom
/**
 * The merge editor's files panel for a conflicted pass: the files as
 * the workbench's panels list what they belong to. Pins what is drawn
 * (the sections' titles one after another — no row names a surface,
 * the strip beside the panel does — the collections and entities by
 * name, a part by its editor's word, never a file path for an entity's
 * file), what a click does (a file's row opens it, any other
 * folds), what a row ends in (the count left, a check once none is, the
 * sum under a folded row or section), the unfolding to the open file,
 * the one-surface listing the strip's flyout shows, and the listing of
 * the step before the editor — the same names, nothing open, nothing
 * counted, a file's row opening nothing.
 */

import type { TreeNode } from '@openheaders/core/types';
import { type ConflictWorkspace, commitConflictTree } from '@openheaders/ui/shared/conflicts/commit-conflict-tree';
import type { MergeFileRowState } from '@openheaders/ui/shared/merge-editor';
import ConflictTree from '@openheaders/ui/workbench/components/panels/git/ConflictTree';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // jsdom has no layout: keeping the open row in view is a no-op here.
  Element.prototype.scrollIntoView = () => {};
});

const CREATE = 'requests/orders-col00001/create-order-req00003';
const LIST = 'requests/orders-col00001/list-orders-req00004';
const MANIFEST = `${CREATE}/request.yaml`;
const BODY = `${CREATE}/body.json`;
const LISTED = `${LIST}/request.yaml`;
const NOTES = 'notes/orders.md';
const VARS = 'workspace-vars.yaml';

const REQUESTS: TreeNode[] = [
  { type: 'request', uid: 'req00003', name: 'Create Order', path: CREATE, method: 'POST' },
  { type: 'request', uid: 'req00004', name: 'List Orders', path: LIST, method: 'GET' },
];

const WORKSPACE: ConflictWorkspace = {
  ruleCollections: [],
  templateCollections: [],
  requestCollections: [{ uid: 'col00001', name: 'Orders', path: 'requests/orders-col00001', tree: REQUESTS }],
  specs: [],
  workflows: [],
  liveVariables: [],
  environments: [],
};

const PATHS = [MANIFEST, BODY, LISTED, VARS, NOTES];
const TREE = commitConflictTree(PATHS, WORKSPACE);

const COUNTS = new Map([
  [MANIFEST, 4],
  [BODY, 2],
  [LISTED, 1],
  [VARS, 3],
  [NOTES, 2],
]);

interface HarnessProps {
  open?: string;
  /** A file the modal opens by itself — a chip of its strip — on the harness's button. */
  elsewhere?: string;
  section?: string;
  states?: ReadonlyMap<string, MergeFileRowState>;
  counts?: ReadonlyMap<string, number>;
  onSelect?: (path: string) => void;
}

/** The modal's part: the open file is state the panel reports into and is handed back. */
function Harness({ open = MANIFEST, elsewhere, section, states, counts = COUNTS, onSelect }: HarnessProps) {
  const [active, setActive] = useState(open);
  return (
    <>
      {elsewhere !== undefined ? (
        <button type="button" data-testid="open-elsewhere" onClick={() => setActive(elsewhere)}>
          open
        </button>
      ) : null}
      <ConflictTree
        tree={TREE}
        files={[]}
        activeFileId={active}
        states={states}
        hunkCounts={counts}
        section={section}
        onSelect={(path) => {
          onSelect?.(path);
          setActive(path);
        }}
      />
    </>
  );
}

const rowOf = (label: string): HTMLElement => {
  const row = screen.getByText(label, { selector: '.rules-sidebar-item-label' }).closest('.rules-sidebar-item');
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${label}`);
  return row;
};
const labels = (): string[] =>
  [...document.querySelectorAll('.rules-sidebar-item-label')].map((label) => label.textContent ?? '');
const endOf = (row: HTMLElement): string => row.querySelector('.rules-sidebar-item-badge')?.textContent ?? '';

afterEach(cleanup);

describe('ConflictTree', () => {
  it("lists the sections one after another, and under them the collections and entities by name — a part by its editor's word, no row for a surface", () => {
    render(<Harness />);
    expect(
      [...document.querySelectorAll('.rules-sidebar-section')].map((header) => header.getAttribute('data-testid')),
    ).toEqual(['git-conflict-tree-section-requests', null, 'git-conflict-tree-section-files']);
    expect(document.body.textContent).not.toContain('API Requests');
    expect(screen.getByTestId('git-conflict-tree-section-requests').textContent).toContain('REQUESTS');
    expect(screen.getByTestId('git-conflict-tree-section-files').textContent).toContain('Files');
    expect(screen.getByText('WORKSPACE VARIABLES')).toBeTruthy();
    expect(labels()).toEqual(['Orders', 'Create Order', 'Details', 'Body', 'List Orders', 'notes', 'orders.md']);
    expect(rowOf('Create Order').textContent).toContain('POST');
    expect(document.body.textContent).not.toContain('request.yaml');
  });

  it("a file's row opens it and is the selected one; a row that holds others folds and unfolds", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    expect(rowOf('Details').classList.contains('selected')).toBe(true);
    fireEvent.click(rowOf('Body'));
    expect(onSelect).toHaveBeenLastCalledWith(BODY);
    expect(rowOf('Body').classList.contains('selected')).toBe(true);
    fireEvent.click(rowOf('List Orders'));
    expect(onSelect).toHaveBeenLastCalledWith(LISTED);

    fireEvent.click(rowOf('Create Order'));
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(labels()).toEqual(['Orders', 'Create Order', 'List Orders', 'notes', 'orders.md']);
    fireEvent.click(rowOf('Create Order'));
    expect(labels()).toContain('Body');
  });

  it('a row ends in what is left to answer, a check once nothing is, and nothing while its rows are shown', () => {
    const states = new Map<string, MergeFileRowState>([[LISTED, { status: 'resolved' }]]);
    render(<Harness states={states} counts={new Map([...COUNTS, [LISTED, 0]])} />);
    expect(endOf(rowOf('Details'))).toBe('4');
    expect(endOf(rowOf('Body'))).toBe('2');
    expect(endOf(rowOf('Create Order'))).toBe('');
    expect(endOf(rowOf('List Orders'))).toBe('');
    expect(within(rowOf('List Orders')).getByTestId('git-conflict-tree-done')).toBeTruthy();
  });

  it('a folded row, and a folded section, end in the sum of what is under them', () => {
    render(<Harness open={NOTES} />);
    fireEvent.click(rowOf('Create Order'));
    expect(endOf(rowOf('Create Order'))).toBe('6');
    fireEvent.click(screen.getByTestId('git-conflict-tree-section-requests'));
    expect(labels()).toEqual(['notes', 'orders.md']);
    expect(screen.getByTestId('git-conflict-tree-section-requests').textContent).toContain('7');
  });

  it("the workspace's variables are one header-styled row that opens their file", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const opener = screen.getByText('WORKSPACE VARIABLES').closest('.rules-sidebar-section');
    if (!(opener instanceof HTMLElement)) throw new Error('no opener row');
    expect(opener.textContent).toContain('3');
    fireEvent.click(opener);
    expect(onSelect).toHaveBeenLastCalledWith(VARS);
    expect(opener.classList.contains('rules-sidebar-section--selected')).toBe(true);
  });

  it('a file opened from elsewhere is unfolded to — its rows and its section', () => {
    render(<Harness open={NOTES} elsewhere={BODY} />);
    fireEvent.click(rowOf('Create Order'));
    fireEvent.click(screen.getByTestId('git-conflict-tree-section-requests'));
    expect(labels()).not.toContain('Orders');
    fireEvent.click(screen.getByTestId('open-elsewhere'));
    expect(rowOf('Body').classList.contains('selected')).toBe(true);
    expect(labels()).toEqual(['Orders', 'Create Order', 'Details', 'Body', 'List Orders', 'notes', 'orders.md']);
  });

  it('handed one surface, it lists that surface alone', () => {
    render(<Harness section="api-requests" />);
    expect(labels()).toEqual(['Orders', 'Create Order', 'Details', 'Body', 'List Orders']);
    expect(screen.queryByText('WORKSPACE VARIABLES')).toBeNull();
  });

  it('as a listing it names the files the same way — nothing open, nothing counted, a row folding and no file opened', () => {
    const onSelect = vi.fn();
    render(<ConflictTree tree={TREE} files={[]} activeFileId="" hunkCounts={undefined} onSelect={onSelect} listing />);
    expect(labels()).toEqual(['Orders', 'Create Order', 'Details', 'Body', 'List Orders', 'notes', 'orders.md']);
    expect(document.querySelector('.git-conflict-tree--listing')).toBeTruthy();
    expect(document.querySelectorAll('.selected, .rules-sidebar-item-badge')).toHaveLength(0);
    fireEvent.click(rowOf('Body'));
    fireEvent.click(rowOf('Create Order'));
    expect(labels()).not.toContain('Body');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
