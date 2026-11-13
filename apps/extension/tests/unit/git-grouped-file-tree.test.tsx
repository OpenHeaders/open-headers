// @vitest-environment jsdom
/**
 * A changed-files tree handed groups (a merge's files, by parent):
 * `FileTreeView` lists each group under a heading that folds, ONE
 * selection and one keyboard walk every heading and row, a file that
 * sits in two groups is two rows, and every file the tree reports
 * carries its group's base commit — what its diff reads against. Both
 * shapes: by path, and by what the files belong to (no workspace here,
 * so every file lists under Files).
 */

import type { WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';
import FileTreeView from '@openheaders/ui/workbench/components/panels/git/FileTreeView';
import type { FileTreeRow } from '@openheaders/ui/workbench/components/panels/git/file-tree';
import type { FileTreeGroup } from '@openheaders/ui/workbench/components/panels/git/file-tree-view-props';
import {
  type FileTreeGroupModel,
  groupCollapsed,
  groupedFoldKeys,
  groupedRows,
  groupMemberKey,
  groupRowKey,
} from '@openheaders/ui/workbench/components/panels/git/grouped-file-tree';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MenuProps } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const FIRST = 'a'.repeat(40);
const SECOND = 'b'.repeat(40);
const BOTH = 'docs/both.md';
const ADDED = 'docs/added.md';
const SIDE = 'side.md';

const GROUPS: FileTreeGroup[] = [
  {
    id: FIRST,
    base: FIRST,
    title: 'Changes to aaaaaaaa main: its change',
    files: [
      { path: BOTH, status: 'M' },
      { path: ADDED, status: 'A' },
    ],
  },
  {
    id: SECOND,
    base: SECOND,
    title: 'Changes to bbbbbbbb feature: its change',
    files: [
      { path: BOTH, status: 'M' },
      { path: SIDE, status: 'M' },
    ],
  },
];

// jsdom lacks the CSS.escape the tree's keyboard scroll uses, scrollIntoView, and the observer antd's menu wants.
beforeAll(() => {
  const scope = globalThis as unknown as { CSS?: { escape(v: string): string } };
  if (typeof scope.CSS === 'undefined' || typeof scope.CSS.escape !== 'function') {
    scope.CSS = { ...scope.CSS, escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) };
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(cleanup);

const byKey = (key: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('[data-row-key]')].find(
    (row) => row.getAttribute('data-row-key') === key,
  );
  if (!found) throw new Error(`no row ${key}`);
  return found;
};
const selectedKeys = (): string[] =>
  [...document.querySelectorAll('[data-row-key][data-selected="true"]')].map(
    (el) => el.getAttribute('data-row-key') ?? '',
  );
const filesIn = (group: string): string[] =>
  [...document.querySelectorAll(`[data-group="${group}"] [data-testid="git-tool-file"]`)].map(
    (row) => row.getAttribute('data-path') ?? '',
  );

type Select = (path: string | null, entity?: WorkspaceTreeEntityRefWire, base?: string) => void;
type Open = (path: string, entity?: WorkspaceTreeEntityRefWire, base?: string) => void;
type Menu = (path: string | null, entity?: WorkspaceTreeEntityRefWire, base?: string) => MenuProps;

function renderTree(options: { groupByWorkspace?: boolean; note?: string; groups?: FileTreeGroup[] } = {}) {
  const onSelectFile = vi.fn<Select>();
  const onOpenFile = vi.fn<Open>();
  const rowMenu = vi.fn<Menu>(() => ({ items: [] }));
  render(
    <FileTreeView
      files={[]}
      groups={options.groups ?? GROUPS}
      {...(options.note !== undefined ? { groupsNote: options.note } : {})}
      loadingPath={null}
      onOpenFile={onOpenFile}
      selectedPath={null}
      onSelectFile={onSelectFile}
      rowMenu={rowMenu}
      {...(options.groupByWorkspace === true ? { groupByWorkspace: true } : {})}
    />,
  );
  return { onSelectFile, onOpenFile, rowMenu };
}

describe('FileTreeView — groups, by path', () => {
  it('lists each group under its heading, with its count, and the line ahead of them', () => {
    renderTree({ note: 'No merged conflicts' });
    expect(screen.getByTestId('git-tool-file-groups-note').textContent).toBe('No merged conflicts');
    expect(screen.getAllByTestId('git-tool-file-group-row').map((row) => row.textContent)).toEqual([
      'Changes to aaaaaaaa main: its change2 files',
      'Changes to bbbbbbbb feature: its change2 files',
    ]);
    expect(filesIn(FIRST)).toEqual([ADDED, BOTH]);
    expect(filesIn(SECOND)).toEqual([BOTH, SIDE]);
  });

  it('a file in two groups is two rows: one selects, and it reports its own group’s base', () => {
    const { onSelectFile } = renderTree();
    fireEvent.click(byKey(groupMemberKey(SECOND, BOTH)));
    expect(selectedKeys()).toEqual([groupMemberKey(SECOND, BOTH)]);
    expect(onSelectFile).toHaveBeenLastCalledWith(BOTH, undefined, SECOND);
    fireEvent.click(byKey(groupMemberKey(FIRST, BOTH)));
    expect(selectedKeys()).toEqual([groupMemberKey(FIRST, BOTH)]);
    expect(onSelectFile).toHaveBeenLastCalledWith(BOTH, undefined, FIRST);
  });

  it('a heading selects and reports no file; its caret folds its rows alone', () => {
    const { onSelectFile } = renderTree();
    fireEvent.click(byKey(groupRowKey(FIRST)));
    expect(selectedKeys()).toEqual([groupRowKey(FIRST)]);
    expect(onSelectFile).toHaveBeenLastCalledWith(null);
    const caret = byKey(groupRowKey(FIRST)).querySelector('span');
    if (!caret) throw new Error('no caret');
    fireEvent.click(caret);
    expect(filesIn(FIRST)).toEqual([]);
    expect(filesIn(SECOND)).toEqual([BOTH, SIDE]);
  });

  it('the keys walk from one group into the next, and Enter opens against the cursor’s group', () => {
    const { onOpenFile } = renderTree();
    const tree = screen.getByTestId('git-tool-file-tree');
    const walked: string[] = [];
    for (let step = 0; step < 7; step += 1) {
      fireEvent.keyDown(tree, { key: 'ArrowDown' });
      walked.push(selectedKeys()[0]);
    }
    expect(walked).toEqual([
      groupRowKey(FIRST),
      groupMemberKey(FIRST, 'docs'),
      groupMemberKey(FIRST, ADDED),
      groupMemberKey(FIRST, BOTH),
      groupRowKey(SECOND),
      groupMemberKey(SECOND, 'docs'),
      groupMemberKey(SECOND, BOTH),
    ]);
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onOpenFile).toHaveBeenLastCalledWith(BOTH, undefined, SECOND);
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(selectedKeys()).toEqual([groupRowKey(SECOND)]);
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(filesIn(SECOND)).toEqual([]);
  });

  it('a row’s menu is built with its group’s base', () => {
    const { rowMenu } = renderTree();
    expect(rowMenu).toHaveBeenCalledWith(BOTH, undefined, FIRST);
    expect(rowMenu).toHaveBeenCalledWith(BOTH, undefined, SECOND);
    expect(rowMenu).toHaveBeenCalledWith(SIDE, undefined, SECOND);
  });

  it('a group read against the first parent reports no base', () => {
    const { onSelectFile } = renderTree({
      groups: [{ id: 'merged', title: 'Merged with conflicts', files: [{ path: BOTH, status: 'M' }] }, GROUPS[1]],
    });
    fireEvent.click(byKey(groupMemberKey('merged', BOTH)));
    expect(onSelectFile).toHaveBeenLastCalledWith(BOTH, undefined, undefined);
  });

  it('no group at all leaves the line', () => {
    renderTree({ groups: [], note: 'No merged conflicts' });
    expect(screen.getByTestId('git-tool-file-groups-note').textContent).toBe('No merged conflicts');
    expect(screen.queryAllByTestId('git-tool-file-group')).toEqual([]);
  });
});

describe('FileTreeView — groups, by what the files belong to', () => {
  it('lists each group on its own, in the panels’ rows, and reports the group’s base', () => {
    const { onSelectFile } = renderTree({ groupByWorkspace: true });
    expect(filesIn(FIRST)).toEqual([ADDED, BOTH]);
    expect(filesIn(SECOND)).toEqual([BOTH, SIDE]);
    expect(document.querySelectorAll(`[data-group="${FIRST}"] .rules-sidebar-section`)).toHaveLength(1);
    fireEvent.click(byKey(groupMemberKey(SECOND, BOTH)));
    expect(selectedKeys()).toEqual([groupMemberKey(SECOND, BOTH)]);
    expect(onSelectFile).toHaveBeenLastCalledWith(BOTH, undefined, SECOND);
  });

  it('a section folds inside its group alone', () => {
    renderTree({ groupByWorkspace: true });
    const header = document.querySelector<HTMLElement>(`[data-group="${FIRST}"] .rules-sidebar-section`);
    if (!header) throw new Error('no section');
    fireEvent.click(header);
    expect(filesIn(FIRST)).toEqual([]);
    expect(filesIn(SECOND)).toEqual([BOTH, SIDE]);
  });
});

describe('grouped-file-tree', () => {
  const row = (key: string, kind: FileTreeRow['kind'], parentKey: string | null = null): FileTreeRow => ({
    key,
    kind,
    depth: parentKey === null ? 0 : 1,
    parentKey,
    ...(kind === 'dir' ? { expanded: true } : {}),
  });
  const model = (id: string): FileTreeGroupModel<FileTreeRow, null> => ({
    id,
    title: id,
    fileCount: 1,
    rowsOf: (collapsed) =>
      collapsed.has('docs')
        ? [{ ...row('docs', 'dir'), expanded: false }]
        : [row('docs', 'dir'), row(BOTH, 'file', 'docs')],
    foldKeys: ['docs'],
    shape: null,
  });
  const groups = [model('one'), model('two')];

  it('keys every row with its group, one step under the heading', () => {
    expect(groupedRows(groups, new Set()).map((entry) => [entry.key, entry.depth, entry.parentKey])).toEqual([
      [groupRowKey('one'), 0, null],
      [groupMemberKey('one', 'docs'), 1, groupRowKey('one')],
      [groupMemberKey('one', BOTH), 2, groupMemberKey('one', 'docs')],
      [groupRowKey('two'), 0, null],
      [groupMemberKey('two', 'docs'), 1, groupRowKey('two')],
      [groupMemberKey('two', BOTH), 2, groupMemberKey('two', 'docs')],
    ]);
  });

  it('a fold is its group’s own; a folded heading leaves the heading alone', () => {
    const collapsed = new Set([groupMemberKey('one', 'docs'), groupRowKey('two')]);
    expect(groupedRows(groups, collapsed).map((entry) => entry.key)).toEqual([
      groupRowKey('one'),
      groupMemberKey('one', 'docs'),
      groupRowKey('two'),
    ]);
    expect([...groupCollapsed(collapsed, 'one')]).toEqual(['docs']);
    expect([...groupCollapsed(collapsed, 'two')]).toEqual([]);
  });

  it('Collapse All folds every heading and every group’s own', () => {
    expect(groupedFoldKeys(groups)).toEqual([
      groupRowKey('one'),
      groupMemberKey('one', 'docs'),
      groupRowKey('two'),
      groupMemberKey('two', 'docs'),
    ]);
  });
});
