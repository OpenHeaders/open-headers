// @vitest-environment jsdom
/**
 * The Commit tree with its files listed by what they belong to in the
 * workbench (Group By Workspace). Pins the model — each git group lists
 * its own files, every file once and nothing across groups; a row that
 * stands for one file keeps the tree's `file:<path>` key, a row that
 * holds others and a section's fold are keyed under their group; a
 * row's checkbox set is the files under it; a deleted entity's files
 * are named from HEAD under Changes alone — and, mounted, what is drawn
 * (the panels' names under each group's header, a one-file row still
 * `commit-tool-file` with its path), that a row's and a section's
 * checkbox flips exactly the files under it and reads tri-state, that
 * the tree's own selection, keys and Space serve the named rows, and
 * that a named row's menu commits its files and jumps to its entity.
 */

import type { WorkspaceTreeEntityRefWire, WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import type { TreeNode } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { type FormerFiles, type ListedWorkspace, listedWorkspaceFiles } from '@openheaders/ui/shared/workspace-files';
import CommitChangesTree from '@openheaders/ui/workbench/components/panels/git/commit/CommitChangesTree';
import {
  type CheckedState,
  EMPTY_CHECKED_STATE,
  setPathsChecked,
  splitChangeGroups,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-model';
import {
  commitNamedFoldKeys,
  commitNamedGroups,
  commitNamedPaths,
  commitNamedSections,
  commitNamedTone,
  visibleCommitNamedRows,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-named-tree';
import {
  buildCommitRowMenu,
  buildIgnoredRowMenu,
  type CommitRowMenuHandlers,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-row-menu';
import { namedSections } from '@openheaders/ui/workbench/components/panels/git/named-file-tree';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const ORDERS_DIR = 'requests/orders-col00001';
const CREATE = `${ORDERS_DIR}/create-order-req00003`;
const MANIFEST = `${CREATE}/request.yaml`;
const BODY = `${CREATE}/body.json`;
const LISTED = `${ORDERS_DIR}/list-orders-req00004/request.yaml`;
const REFUND = `${ORDERS_DIR}/refund-order-req00005/request.yaml`;
const CANCEL = `${ORDERS_DIR}/cancel-order-req00009/request.yaml`;
const STAGING = 'environments/staging-env00001.yaml';
const STAGING_SECRETS = 'environments/staging-env00001.secret.yaml';
const WORKSPACE_FILE = 'workspace.yaml';
const README = 'docs/readme.md';
const NEW_NOTE = 'notes/new.md';

const REQUESTS: TreeNode[] = [
  { type: 'request', uid: 'req00003', name: 'Create Order', path: CREATE, method: 'POST' },
  { type: 'request', uid: 'req00004', name: 'List Orders', path: `${ORDERS_DIR}/list-orders-req00004`, method: 'GET' },
  {
    type: 'request',
    uid: 'req00005',
    name: 'Refund Order',
    path: `${ORDERS_DIR}/refund-order-req00005`,
    method: 'POST',
  },
];

const WORKSPACE: ListedWorkspace = {
  ruleCollections: [],
  templateCollections: [],
  requestCollections: [{ uid: 'col00001', name: 'Orders', path: ORDERS_DIR, tree: REQUESTS }],
  specs: [],
  workflows: [],
  liveVariables: [],
  environments: [{ uid: 'env00001', name: 'Staging' }],
};

function row(overrides: Partial<WorkspaceTreeWorkingChangeWire> & { path: string }): WorkspaceTreeWorkingChangeWire {
  return { status: 'M', unversioned: false, ignored: false, ...overrides };
}

const ROWS: WorkspaceTreeWorkingChangeWire[] = [
  row({ path: MANIFEST }),
  row({ path: BODY }),
  row({ path: LISTED, status: 'D' }),
  row({ path: STAGING }),
  row({ path: WORKSPACE_FILE }),
  row({ path: README }),
  row({ path: REFUND, status: '?', unversioned: true }),
  row({ path: NEW_NOTE, status: '?', unversioned: true }),
  row({
    path: STAGING_SECRETS,
    status: '!',
    ignored: true,
    ignoreSource: { kind: 'gitignore', source: '.gitignore', pattern: '*.secret.yaml', removable: false },
  }),
];
const GROUPS = splitChangeGroups(ROWS);
const NAMED = commitNamedGroups(GROUPS, WORKSPACE);
const SPECS = [
  { key: 'changes' as const, rows: GROUPS.changes },
  { key: 'unversioned' as const, rows: GROUPS.unversioned },
  { key: 'ignored' as const, rows: GROUPS.ignored },
];

const CREATE_ORDER: WorkspaceTreeEntityRefWire = {
  kind: 'request',
  tree: null,
  uid: 'req00003',
  name: 'Create Order',
  method: 'POST',
};

const changes = (groupByDirectory = true) => namedSections(NAMED.get('changes') ?? [], groupByDirectory);
const keysOf = (collapsed: string[] = []): string[] =>
  commitNamedSections('changes', changes(), new Set(collapsed)).flatMap((section) =>
    section.rows.map((line) => `${'  '.repeat(line.depth)}${line.key}`),
  );

describe('commit-named-tree', () => {
  it('each git group lists its own files, every file once — nothing crosses a group', () => {
    for (const { key, rows } of SPECS) {
      const sections = NAMED.get(key) ?? [];
      const listed = listedWorkspaceFiles(sections).map((file) => file.path);
      expect([...listed].sort()).toEqual(rows.map((line) => line.path).sort());
      expect(new Set(listed).size).toBe(listed.length);
    }
    // One collection, listed under each group that holds a file of it.
    const collectionsOf = (key: 'changes' | 'unversioned') =>
      commitNamedSections(key, namedSections(NAMED.get(key) ?? [], true), new Set())
        .flatMap((section) => section.rows)
        .filter((line) => line.named.entity?.kind === 'collection')
        .map((line) => line.key);
    expect(collectionsOf('changes')).toEqual(['changes:requests:col00001']);
    expect(collectionsOf('unversioned')).toEqual(['unversioned:requests:col00001']);
  });

  it('a row that stands for one file keeps the tree’s file key; a row that holds others is keyed under its group', () => {
    expect(keysOf()).toEqual([
      'changes:requests:col00001',
      '  changes:requests:req00003',
      `    file:${MANIFEST}`,
      `    file:${BODY}`,
      `  file:${LISTED}`,
      `file:${STAGING}`,
      `file:${WORKSPACE_FILE}`,
      'changes:dir:docs',
      `  file:${README}`,
    ]);
    const [requests] = commitNamedSections('changes', changes(), new Set());
    expect(requests.key).toBe('changes:section:requests');
    expect(requests.rows[0]).toMatchObject({
      kind: 'dir',
      parentKey: 'changes',
      collapseKey: 'changes:requests:col00001',
    });
    expect(requests.rows[1].parentKey).toBe('changes:requests:col00001');
    expect(requests.rows[2]).toMatchObject({ kind: 'file', path: MANIFEST, parentKey: 'changes:requests:req00003' });
  });

  it('a fold is the group’s own — the same row under another group stays as it was', () => {
    expect(keysOf(['changes:requests:req00003'])).not.toContain(`    file:${BODY}`);
    expect(keysOf(['unversioned:requests:col00001'])).toContain(`    file:${BODY}`);
    expect(keysOf(['changes:section:requests', 'changes:section:workspace'])).toEqual([
      `file:${STAGING}`,
      `file:${WORKSPACE_FILE}`,
      'changes:dir:docs',
      `  file:${README}`,
    ]);
    expect(commitNamedFoldKeys('changes', changes())).toEqual([
      'changes:section:requests',
      'changes:requests:col00001',
      'changes:requests:req00003',
      'changes:section:environments',
      'changes:section:files',
      'changes:dir:docs',
    ]);
  });

  it('a checkbox’s set is the files under its row or its section', () => {
    const paths = commitNamedPaths('changes', changes());
    expect(paths.get('changes:section:requests')).toEqual([MANIFEST, BODY, LISTED]);
    expect(paths.get('changes:requests:col00001')).toEqual([MANIFEST, BODY, LISTED]);
    expect(paths.get('changes:requests:req00003')).toEqual([MANIFEST, BODY]);
    expect(paths.get('changes:section:environments')).toEqual([STAGING]);
    expect(paths.get('changes:section:workspace')).toEqual([WORKSPACE_FILE]);
    expect(paths.get('changes:dir:docs')).toEqual([README]);
    const sectionFiles = [...paths].filter(([key]) => key.startsWith('changes:section:')).flatMap(([, files]) => files);
    expect([...sectionFiles].sort()).toEqual(GROUPS.changes.map((line) => line.path).sort());
  });

  it('the selectable rows are each group’s header, then its rows — a section is no row, a folded or empty group lists none', () => {
    const shown = (collapsed: string[]) =>
      new Map(
        SPECS.map(({ key }) => [
          key,
          commitNamedSections(key, namedSections(NAMED.get(key) ?? [], true), new Set(collapsed)),
        ]),
      );
    const all = visibleCommitNamedRows(SPECS, shown([]), new Set()).map((line) => line.key);
    expect(all.slice(0, 2)).toEqual(['changes', 'changes:requests:col00001']);
    expect(all.filter((key) => key.includes(':section:'))).toEqual([]);
    expect(all).toContain('unversioned');
    expect(all).toContain(`file:${STAGING_SECRETS}`);
    const folded = visibleCommitNamedRows(SPECS, shown(['changes']), new Set(['changes'])).map((line) => line.key);
    expect(folded.slice(0, 2)).toEqual(['changes', 'unversioned']);
    const empty = [{ key: 'changes' as const, rows: [] }];
    expect(visibleCommitNamedRows(empty, shown([]), new Set())).toEqual([]);
  });

  it('a name wears its change — an entity that lists several by its own files, a group the index does not know in its one colour', () => {
    const status = new Map(ROWS.map((line) => [line.path, line.status]));
    const statusOf = (path: string) => status.get(path);
    const [requests] = NAMED.get('changes') ?? [];
    const [orders] = requests.nodes;
    if (orders.type !== 'entity') throw new Error('no collection');
    const [create, list] = orders.children;
    expect(commitNamedTone('changes', orders, statusOf)).toBeUndefined();
    expect(commitNamedTone('changes', create, statusOf)).toBe('modified');
    expect(commitNamedTone('changes', create, () => 'A')).toBe('added');
    expect(commitNamedTone('changes', list, statusOf)).toBe('deleted');
    expect(commitNamedTone('unversioned', create, statusOf)).toBe('unversioned');
    expect(commitNamedTone('ignored', list, statusOf)).toBe('ignored');
  });

  it('a deleted entity’s tracked files are named from HEAD under Changes — the other groups are listed without it', () => {
    const groups = splitChangeGroups([
      row({ path: CANCEL, status: 'D' }),
      row({ path: NEW_NOTE, status: '?', unversioned: true }),
    ]);
    const former: FormerFiles = new Map([
      [
        CANCEL,
        {
          entity: { kind: 'request', uid: 'req00009', name: 'Cancel Order', method: 'DELETE' },
          containers: [{ kind: 'collection', uid: 'col00001', name: 'Orders' }],
        },
      ],
    ]);
    expect(
      commitNamedGroups(groups, WORKSPACE)
        .get('changes')
        ?.map((section) => section.id),
    ).toEqual(['files']);
    const named = commitNamedGroups(groups, WORKSPACE, former);
    expect(named.get('changes')?.map((section) => section.id)).toEqual(['requests']);
    const [cancel] = listedWorkspaceFiles(named.get('changes') ?? []);
    expect(cancel.entity).toEqual({ kind: 'former', was: former.get(CANCEL)?.entity });
    expect(named.get('unversioned')?.map((section) => section.id)).toEqual(['files']);
  });
});

// jsdom lacks the CSS.escape the tree's selection scroll uses, scrollIntoView, and the observer antd's menu measures with.
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

const t: Translate = (key: string) => key;

function handlers(): CommitRowMenuHandlers {
  return {
    onCommitPaths: vi.fn(),
    onShowDiff: vi.fn(),
    onRefresh: vi.fn(),
    onPush: vi.fn(),
    onPull: vi.fn(),
    onFetch: vi.fn(),
    onCompareWithBranch: vi.fn(),
    onBranches: vi.fn(),
    onNewBranch: vi.fn(),
    onManageRemotes: vi.fn(),
    onIgnorePaths: vi.fn(),
    onAddToVcs: vi.fn(),
    onRollbackPaths: vi.fn(),
    onDeletePaths: vi.fn(),
    onUnignorePath: vi.fn(),
    onJumpToSource: vi.fn(),
  };
}

const byKey = (key: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('[data-row-key]')].find(
    (line) => line.getAttribute('data-row-key') === key,
  );
  if (!found) throw new Error(`no row ${key}`);
  return found;
};
const boxOf = (host: Element): HTMLInputElement => {
  const box = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!box) throw new Error('no checkbox');
  return box;
};
const partial = (host: Element): boolean => host.querySelector('.ant-checkbox-indeterminate') !== null;
const labelsIn = (group: string): string[] =>
  [...screen.getByTestId(`commit-tool-named-${group}`).querySelectorAll('.rules-sidebar-item-label')].map(
    (label) => label.textContent ?? '',
  );
const selectedKeys = (): string[] =>
  [...document.querySelectorAll('[data-row-key][data-selected="true"]')].map(
    (line) => line.getAttribute('data-row-key') ?? '',
  );
/** The newest open menu's item — antd keeps a closed dropdown's popup in the DOM. */
const menuItem = async (label: string): Promise<Element> => (await screen.findAllByText(label)).at(-1) as Element;
const held = (item: Element): boolean =>
  item.closest('li')?.classList.contains('ant-dropdown-menu-item-disabled') === true;

function renderTree(named: boolean = true) {
  const h = handlers();
  const onOpenFile = vi.fn<(path: string) => void>();
  const onSetChecked = vi.fn<(paths: readonly string[], checked: boolean) => void>();
  const Harness = () => {
    const [checked, setChecked] = useState<CheckedState>(EMPTY_CHECKED_STATE);
    return (
      <AntApp>
        <CommitChangesTree
          groups={GROUPS}
          checked={checked}
          onSetChecked={(paths, value) => {
            onSetChecked(paths, value);
            setChecked((prev) => setPathsChecked(ROWS, prev, paths, value));
          }}
          onOpenFile={onOpenFile}
          groupByDirectory
          showIgnored
          {...(named ? { named: NAMED } : {})}
          rowMenu={(target) =>
            target.kind === 'file' && target.row.ignored
              ? buildIgnoredRowMenu(target.row, t, h)
              : buildCommitRowMenu(target, t, h)
          }
        />
      </AntApp>
    );
  };
  render(<Harness />);
  return { h, onOpenFile, onSetChecked };
}

describe('CommitChangesTree, by what the files belong to', () => {
  it('lists the panels’ sections and names under each git group’s header — a path only for a file of the user’s own', () => {
    renderTree();
    expect(screen.getByTestId('commit-tool-group-changes')).toBeTruthy();
    const sectionsIn = (group: string) =>
      [...screen.getByTestId(`commit-tool-named-${group}`).querySelectorAll('.rules-sidebar-section')].map((header) =>
        header.getAttribute('data-testid'),
      );
    expect(sectionsIn('changes')).toEqual([
      'commit-tool-section-changes-requests',
      'commit-tool-section-changes-environments',
      null,
      'commit-tool-section-changes-files',
    ]);
    expect(labelsIn('changes')).toEqual([
      'Orders',
      'Create Order',
      'Details',
      'Body',
      'List Orders',
      'Staging',
      'docs',
      'readme.md',
    ]);
    expect(labelsIn('unversioned')).toEqual(['Orders', 'Refund Order', 'notes', 'new.md']);
    expect(labelsIn('ignored')).toEqual(['Staging']);
    expect(screen.getByTestId('commit-tool-named-changes').textContent).not.toContain('request.yaml');
    expect(byKey(`file:${STAGING_SECRETS}`).textContent).toContain('.gitignore');
  });

  it('a row that stands for one file is that file to the suite — commit-tool-file, its path, the tree’s file key', () => {
    renderTree();
    expect(
      screen
        .getAllByTestId('commit-tool-file')
        .map((line) => [line.getAttribute('data-path'), line.getAttribute('data-row-key')]),
    ).toEqual(ROWS.map((line) => [line.path, `file:${line.path}`]));
    expect(byKey('changes:dir:docs').getAttribute('data-testid')).toBe('commit-tool-dir');
    expect(byKey('changes:dir:docs').getAttribute('data-key')).toBe('docs');
    expect(byKey('changes:requests:req00003').getAttribute('data-testid')).toBe('commit-tool-named');
  });

  it('a page’s title wears its change, as a row’s name does', () => {
    renderTree();
    const staging = byKey(`file:${STAGING}`).querySelector<HTMLElement>('.rules-sidebar-item-label')?.style.color ?? '';
    expect(staging).not.toBe('');
    expect(within(byKey(`file:${WORKSPACE_FILE}`)).getByText('Workspace').style.color).toBe(staging);
  });

  it('a row’s checkbox flips exactly the files under it and reads tri-state up its containers; the ignored group carries none', () => {
    const { onSetChecked } = renderTree();
    expect(boxOf(byKey('changes:requests:req00003')).checked).toBe(true);
    fireEvent.click(boxOf(byKey(`file:${BODY}`)));
    expect(onSetChecked).toHaveBeenLastCalledWith([BODY], false);
    expect(partial(byKey('changes:requests:req00003'))).toBe(true);
    expect(partial(byKey('changes:requests:col00001'))).toBe(true);
    expect(partial(screen.getByTestId('commit-tool-section-changes-requests'))).toBe(true);
    expect(partial(screen.getByTestId('commit-tool-group-changes'))).toBe(true);
    expect(partial(screen.getByTestId('commit-tool-section-changes-environments'))).toBe(false);
    fireEvent.click(boxOf(byKey('changes:requests:req00003')));
    expect(onSetChecked).toHaveBeenLastCalledWith([MANIFEST, BODY], true);
    expect(boxOf(byKey(`file:${BODY}`)).checked).toBe(true);
    // An unversioned entity starts unchecked; its collection's box checks it.
    expect(boxOf(byKey(`file:${REFUND}`)).checked).toBe(false);
    fireEvent.click(boxOf(byKey('unversioned:requests:col00001')));
    expect(onSetChecked).toHaveBeenLastCalledWith([REFUND], true);
    expect(screen.getByTestId('commit-tool-named-ignored').querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('a section’s checkbox flips its files and does not fold it; a click on the section folds it', () => {
    const { onSetChecked } = renderTree();
    const section = screen.getByTestId('commit-tool-section-changes-requests');
    fireEvent.click(boxOf(section));
    expect(onSetChecked).toHaveBeenLastCalledWith([MANIFEST, BODY, LISTED], false);
    expect(labelsIn('changes')).toContain('Create Order');
    fireEvent.click(section);
    expect(labelsIn('changes')).toEqual(['Staging', 'docs', 'readme.md']);
    // The page is a row of the tree, with the checkbox of its one file.
    fireEvent.click(boxOf(byKey(`file:${WORKSPACE_FILE}`)));
    expect(onSetChecked).toHaveBeenLastCalledWith([WORKSPACE_FILE], false);
  });

  it('the tree’s own selection, keys and Space serve the named rows', () => {
    const { onSetChecked, onOpenFile } = renderTree();
    const tree = screen.getByTestId('commit-tool-tree');
    fireEvent.doubleClick(byKey(`file:${LISTED}`));
    expect(onOpenFile).toHaveBeenLastCalledWith(LISTED);
    fireEvent.click(byKey('changes:requests:req00003'));
    expect(selectedKeys()).toEqual(['changes:requests:req00003']);
    fireEvent.keyDown(tree, { key: ' ' });
    expect(onSetChecked).toHaveBeenLastCalledWith([MANIFEST, BODY], false);
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(selectedKeys()).toEqual([`file:${MANIFEST}`]);
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onOpenFile).toHaveBeenLastCalledWith(MANIFEST);
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(selectedKeys()).toEqual(['changes:requests:req00003']);
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(labelsIn('changes')).not.toContain('Details');
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    // Past its collection a row's parent is the git group — a section is no row.
    expect(document.querySelector('[data-testid="commit-tool-group-changes"].selected')).not.toBeNull();
  });

  it('a named row that holds several files commits them and jumps to its entity; a part jumps with its file', async () => {
    const { h } = renderTree();
    fireEvent.contextMenu(byKey('changes:requests:req00003'));
    fireEvent.click(await menuItem('workbench.commitTool.menu.commitFiles'));
    expect(h.onCommitPaths).toHaveBeenLastCalledWith([MANIFEST, BODY]);
    expect(held(await menuItem('workbench.commitTool.menu.showDiff'))).toBe(true);
    fireEvent.contextMenu(byKey('changes:requests:req00003'));
    fireEvent.click(await menuItem('workbench.commitTool.menu.jumpToSource'));
    expect(h.onJumpToSource).toHaveBeenLastCalledWith(null, CREATE_ORDER);
    fireEvent.contextMenu(byKey(`file:${BODY}`));
    fireEvent.click(await menuItem('workbench.commitTool.menu.jumpToSource'));
    expect(h.onJumpToSource).toHaveBeenLastCalledWith(BODY, CREATE_ORDER);
  });

  it('a directory of the user’s own keeps Commit Directory… and has nothing to jump to; a file of theirs jumps by its path', async () => {
    const { h } = renderTree();
    fireEvent.contextMenu(byKey('changes:dir:docs'));
    fireEvent.click(await menuItem('workbench.commitTool.menu.commitDirectory'));
    expect(h.onCommitPaths).toHaveBeenLastCalledWith([README]);
    fireEvent.contextMenu(byKey('changes:dir:docs'));
    expect(held(await menuItem('workbench.commitTool.menu.jumpToSource'))).toBe(true);
    fireEvent.contextMenu(byKey(`file:${README}`));
    fireEvent.click(await menuItem('workbench.commitTool.menu.jumpToSource'));
    expect(h.onJumpToSource).toHaveBeenLastCalledWith(README, undefined);
  });

  it('listed by path, a file’s row jumps by its path too', async () => {
    const { h } = renderTree(false);
    expect(document.querySelector('[data-testid^="commit-tool-named-"]')).toBeNull();
    fireEvent.contextMenu(byKey(`file:${MANIFEST}`));
    fireEvent.click(await menuItem('workbench.commitTool.menu.jumpToSource'));
    expect(h.onJumpToSource).toHaveBeenLastCalledWith(MANIFEST, undefined);
  });
});
