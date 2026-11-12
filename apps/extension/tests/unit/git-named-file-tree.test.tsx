// @vitest-environment jsdom
/**
 * A changed-files tree listed by what the files belong to in the
 * workbench. Pins the rows (a row that stands for one file keyed by its
 * path, one that holds others by its id, the sections folding without
 * being rows, the workspace's variables as a row that never folds, the
 * user's own files flat without Group By Directory), the change a row
 * reads as, and — mounted — what is drawn (the panels' names, never a
 * path for an entity's file), that the rows select, fold, open and take
 * the row menu as the path tree's do, and that the pane hears the one
 * file its verbs act on.
 */

import type { TreeNode } from '@openheaders/core/types';
import { type ListedWorkspace, workspaceFileTree } from '@openheaders/ui/shared/workspace-files';
import { NamedFileTree } from '@openheaders/ui/workbench/components/panels/git/NamedFileTree';
import {
  namedFoldKeys,
  namedRowStatus,
  namedSections,
  visibleNamedSections,
} from '@openheaders/ui/workbench/components/panels/git/named-file-tree';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const CREATE = 'requests/orders-col00001/create-order-req00003';
const LIST = 'requests/orders-col00001/list-orders-req00004';
const MANIFEST = `${CREATE}/request.yaml`;
const BODY = `${CREATE}/body.json`;
const LISTED = `${LIST}/request.yaml`;
const VARS = 'workspace-vars.yaml';
const NOTES = 'notes/orders.md';
const README = 'README.md';

const REQUESTS: TreeNode[] = [
  { type: 'request', uid: 'req00003', name: 'Create Order', path: CREATE, method: 'POST' },
  { type: 'request', uid: 'req00004', name: 'List Orders', path: LIST, method: 'GET' },
];

const WORKSPACE: ListedWorkspace = {
  ruleCollections: [],
  templateCollections: [],
  requestCollections: [{ uid: 'col00001', name: 'Orders', path: 'requests/orders-col00001', tree: REQUESTS }],
  specs: [],
  workflows: [],
  liveVariables: [],
  environments: [],
};

const FILES = [
  { path: MANIFEST, status: 'M' },
  { path: BODY, status: 'A' },
  { path: LISTED, status: 'D' },
  { path: VARS, status: 'M' },
  { path: NOTES, status: 'A' },
  { path: README, status: 'M' },
];
const SECTIONS = workspaceFileTree(
  FILES.map((file) => file.path),
  WORKSPACE,
);
const STATUS = new Map(FILES.map((file) => [file.path, file.status]));
const statusOf = (path: string): string | undefined => STATUS.get(path);

const keysOf = (collapsed: string[] = [], groupByDirectory = true): string[] =>
  visibleNamedSections(namedSections(SECTIONS, groupByDirectory), new Set(collapsed)).flatMap((section) =>
    section.rows.map((row) => `${'  '.repeat(row.depth)}${row.kind}:${row.key}`),
  );

describe('named-file-tree', () => {
  it('a row that stands for one file is keyed by its path, a row that holds others by its id', () => {
    expect(keysOf()).toEqual([
      'dir:requests:col00001',
      '  dir:requests:req00003',
      `    file:${MANIFEST}`,
      `    file:${BODY}`,
      `  file:${LISTED}`,
      `file:${VARS}`,
      'dir:dir:notes',
      `  file:${NOTES}`,
      `file:${README}`,
    ]);
  });

  it('a folded row hides what it holds, a folded section its rows — the workspace’s variables never fold', () => {
    expect(keysOf(['requests:req00003'])).not.toContain(`    file:${BODY}`);
    expect(keysOf(['section:requests', 'section:workspace-variables', 'section:files'])).toEqual([`file:${VARS}`]);
    expect(namedFoldKeys(namedSections(SECTIONS, true))).toEqual([
      'section:requests',
      'requests:col00001',
      'requests:req00003',
      'section:files',
      'dir:notes',
    ]);
  });

  it('without Group By Directory the user’s own files are one flat run, each by its full path', () => {
    expect(keysOf([], false).slice(-2)).toEqual([`file:${NOTES}`, `file:${README}`]);
    const [files] = namedSections(SECTIONS, false).slice(-1);
    expect(files.nodes.map((node) => (node.type === 'file' ? node.name : ''))).toEqual([NOTES, README]);
  });

  it('the user’s own files nest as the path tree nests any — directories first, a chain of lone directories folded into one row', () => {
    const own = ['scripts/ci/run.sh', 'docs/guides/auth/tokens.md', 'docs/guides/setup.md', 'docs/README.md', 'top.md'];
    const listed = namedSections(workspaceFileTree(own, WORKSPACE), true);
    expect(
      visibleNamedSections(listed, new Set()).flatMap((section) =>
        section.rows.map((row) => `${'>'.repeat(row.depth)}${row.node.type === 'directory' ? row.node.path : row.key}`),
      ),
    ).toEqual([
      'docs',
      '>guides',
      '>>auth',
      '>>>docs/guides/auth/tokens.md',
      '>>docs/guides/setup.md',
      '>docs/README.md',
      'scripts/ci',
      '>scripts/ci/run.sh',
      'top.md',
    ]);
    expect(namedFoldKeys(listed)).toEqual([
      'section:files',
      'dir:docs',
      'dir:docs/guides',
      'dir:docs/guides/auth',
      'dir:scripts/ci',
    ]);
  });

  it('a file’s row reads as its change; an entity that lists several as added or deleted only when all its files are', () => {
    const [requests] = SECTIONS;
    const [orders] = requests.nodes;
    if (orders.type !== 'entity') throw new Error('no collection');
    const [create, list] = orders.children;
    expect(namedRowStatus(orders, statusOf)).toBeUndefined();
    expect(namedRowStatus(create, statusOf)).toBe('M');
    expect(namedRowStatus(create, () => 'A')).toBe('A');
    expect(namedRowStatus(create, () => 'D')).toBe('D');
    expect(namedRowStatus(list, statusOf)).toBe('D');
  });
});

// jsdom lacks the CSS.escape the tree's keyboard scroll uses, scrollIntoView, and the observer antd's menu measures with.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  const scope = globalThis as unknown as { CSS?: { escape(v: string): string } };
  if (typeof scope.CSS === 'undefined' || typeof scope.CSS.escape !== 'function') {
    scope.CSS = { ...scope.CSS, escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) };
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
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
const labels = (): string[] =>
  [...document.querySelectorAll('.rules-sidebar-item-label')].map((label) => label.textContent ?? '');

function renderTree(selecting = true) {
  const onSelectFile = vi.fn<(path: string | null) => void>();
  const onOpenFile = vi.fn<(path: string) => void>();
  const onMenu = vi.fn<(path: string) => void>();
  render(
    <NamedFileTree
      sections={SECTIONS}
      files={FILES}
      loadingPath={null}
      onOpenFile={onOpenFile}
      handleRef={null}
      {...(selecting
        ? {
            selectedPath: null,
            onSelectFile,
            rowMenu: (path: string) => ({
              items: [
                { key: 'probe', label: <span data-testid="menu-probe">{path}</span>, onClick: () => onMenu(path) },
              ],
            }),
          }
        : {})}
    />,
  );
  return { onSelectFile, onOpenFile, onMenu };
}

describe('NamedFileTree', () => {
  it('lists the panels’ sections, the collections and entities by name and a part by its editor’s word — a path only for a file of the user’s own', () => {
    renderTree();
    expect(
      [...document.querySelectorAll('.rules-sidebar-section')].map((header) => header.getAttribute('data-testid')),
    ).toEqual(['git-tool-file-section-requests', null, 'git-tool-file-section-files']);
    expect(screen.getByText('WORKSPACE VARIABLES')).toBeTruthy();
    expect(labels()).toEqual([
      'Orders',
      'Create Order',
      'Details',
      'Body',
      'List Orders',
      'notes',
      'orders.md',
      'README.md',
    ]);
    expect(byKey(LISTED).textContent).toContain('GET');
    expect(document.body.textContent).not.toContain('request.yaml');
  });

  it('a row that stands for one file is that file to a probe and to the pane — its path on the row, its name in its change’s colour', () => {
    renderTree();
    expect(screen.getAllByTestId('git-tool-file').map((row) => row.getAttribute('data-path'))).toEqual([
      MANIFEST,
      BODY,
      LISTED,
      VARS,
      NOTES,
      README,
    ]);
    const colourOf = (key: string): string =>
      byKey(key).querySelector<HTMLElement>('.rules-sidebar-item-label')?.style.color ?? '';
    expect(colourOf(BODY)).not.toBe('');
    expect(colourOf(BODY)).not.toBe(colourOf(MANIFEST));
    expect(colourOf('requests:req00003')).toBe(colourOf(MANIFEST));
    expect(colourOf('requests:col00001')).toBe('');
  });

  it('a click selects a row and reports its file; Shift+click ranges across entities, parts and the opener', () => {
    const { onSelectFile } = renderTree();
    fireEvent.click(byKey(BODY));
    expect(selectedKeys()).toEqual([BODY]);
    expect(onSelectFile).toHaveBeenLastCalledWith(BODY);
    fireEvent.click(byKey(VARS), { shiftKey: true });
    expect(selectedKeys()).toEqual([BODY, LISTED, VARS]);
    expect(onSelectFile).toHaveBeenLastCalledWith(VARS);
    expect(byKey(VARS).querySelector('.rules-sidebar-section--selected')).toBeTruthy();
  });

  it('a row that holds others selects on a click and reports no file; its caret, or a double-click, folds it', () => {
    const { onSelectFile } = renderTree();
    fireEvent.click(byKey('requests:req00003'));
    expect(selectedKeys()).toEqual(['requests:req00003']);
    expect(onSelectFile).toHaveBeenLastCalledWith(null);
    expect(labels()).toContain('Body');
    const caret = byKey('requests:req00003').querySelector('.rules-sidebar-item-caret');
    if (!caret) throw new Error('no caret');
    fireEvent.click(caret);
    expect(labels()).not.toContain('Body');
    fireEvent.doubleClick(byKey('requests:req00003'));
    expect(labels()).toContain('Body');
  });

  it('a section folds on a click and is no row; a double-click or Enter opens a file, the keys walk and fold', () => {
    const { onOpenFile } = renderTree();
    fireEvent.click(screen.getByTestId('git-tool-file-section-requests'));
    expect(labels()).toEqual(['notes', 'orders.md', 'README.md']);
    expect(selectedKeys()).toEqual([]);
    fireEvent.click(screen.getByTestId('git-tool-file-section-requests'));

    fireEvent.doubleClick(byKey(LISTED));
    expect(onOpenFile).toHaveBeenLastCalledWith(LISTED);

    const tree = screen.getByTestId('git-tool-file-tree');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(selectedKeys()).toEqual(['requests:col00001']);
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    expect(selectedKeys()).toEqual([MANIFEST]);
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onOpenFile).toHaveBeenLastCalledWith(MANIFEST);
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(selectedKeys()).toEqual(['requests:req00003']);
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(labels()).not.toContain('Details');
  });

  it('a right-click selects the row and opens the file’s menu', async () => {
    const { onSelectFile, onMenu } = renderTree();
    fireEvent.contextMenu(byKey(LISTED));
    expect(selectedKeys()).toEqual([LISTED]);
    expect(onSelectFile).toHaveBeenLastCalledWith(LISTED);
    fireEvent.click(await screen.findByTestId('menu-probe'));
    expect(onMenu).toHaveBeenCalledWith(LISTED);
  });

  it('without a selection handler a click opens the file, a click on a row that holds others folds it, nothing selects', () => {
    const { onOpenFile } = renderTree(false);
    fireEvent.click(byKey(BODY));
    expect(onOpenFile).toHaveBeenCalledWith(BODY);
    fireEvent.click(byKey('requests:req00003'));
    expect(labels()).not.toContain('Body');
    expect(selectedKeys()).toEqual([]);
  });
});
