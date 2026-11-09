// @vitest-environment jsdom
/**
 * The log timeline's commit row menu (S47): the builder's anatomy on
 * this product's vocabulary (the live rows, the visible-disabled rows,
 * no history-rewriting row), the right-click selection rule on the
 * mounted list (an unselected row becomes the selection alone, a
 * selected row keeps the set and the menu covers it), the Left / Right
 * walk to the child / parent commit, and the neighbor model at the
 * window's edges.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import CommitList from '@openheaders/ui/workbench/components/panels/git/CommitList';
import {
  childInWindow,
  isFullCommitSha,
  parentInWindow,
} from '@openheaders/ui/workbench/components/panels/git/log-neighbors';
import {
  buildLogRowMenu,
  type LogRowMenuHandlers,
  type LogRowMenuTarget,
} from '@openheaders/ui/workbench/components/panels/git/log-row-menu';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MenuProps } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
  // antd's Dropdown measures its trigger.
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

const t: Translate = (key: string) => key;

function entry(sha: string, parents: string[]): WorkspaceTreeLogEntryWire {
  return {
    sha,
    parents,
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-09T10:00:00.000Z',
    subject: `commit ${sha}`,
    coAuthors: [],
    files: [{ path: `docs/${sha}.md`, status: 'M' }],
  };
}

// c4 -> c3 -> c2 -> c1, newest first (the list order).
const CHAIN = [entry('c4', ['c3']), entry('c3', ['c2']), entry('c2', ['c1']), entry('c1', [])];

type MockedHandlers = { [K in keyof LogRowMenuHandlers]: ReturnType<typeof vi.fn<LogRowMenuHandlers[K]>> };

function handlers(): MockedHandlers {
  return {
    onCopyRevision: vi.fn<LogRowMenuHandlers['onCopyRevision']>(),
    onNewBranchFrom: vi.fn<LogRowMenuHandlers['onNewBranchFrom']>(),
    onNavigate: vi.fn<LogRowMenuHandlers['onNavigate']>(),
  };
}

type Item = { key?: string | number | null; disabled?: boolean; onClick?: () => void } | null;

const itemsOf = (menu: MenuProps): (Item & { key: string })[] =>
  (menu.items ?? []).filter((item): item is Item & { key: string } => item !== null && typeof item.key === 'string');
const keysOf = (menu: MenuProps): string[] => itemsOf(menu).map((item) => item.key);
const disabledKeys = (menu: MenuProps): string[] =>
  itemsOf(menu)
    .filter((item) => item.disabled === true)
    .map((item) => item.key);
const clickKey = (menu: MenuProps, key: string): void =>
  itemsOf(menu)
    .find((item) => item.key === key)
    ?.onClick?.();

describe('buildLogRowMenu — the anatomy', () => {
  const single: LogRowMenuTarget = { shas: ['c3'], child: 'c4', parent: 'c2' };

  it('one commit: copy, new branch and the two walks live; the unbuilt verbs visible-disabled', () => {
    const h = handlers();
    const menu = buildLogRowMenu(single, t, h);
    expect(keysOf(menu)).toEqual([
      'copy-revision',
      'create-patch',
      'cherry-pick',
      'checkout-revision',
      'compare-with-local',
      'revert',
      'new-branch',
      'new-tag',
      'go-to-child',
      'go-to-parent',
    ]);
    expect(disabledKeys(menu)).toEqual([
      'create-patch',
      'cherry-pick',
      'checkout-revision',
      'compare-with-local',
      'revert',
      'new-tag',
    ]);
    clickKey(menu, 'copy-revision');
    expect(h.onCopyRevision).toHaveBeenCalledWith(['c3']);
    clickKey(menu, 'new-branch');
    expect(h.onNewBranchFrom).toHaveBeenCalledWith('c3');
    clickKey(menu, 'go-to-child');
    clickKey(menu, 'go-to-parent');
    expect(h.onNavigate.mock.calls).toEqual([['c4'], ['c2']]);
  });

  it('no history-rewriting row anywhere — the engine never rewrites history', () => {
    const keys = keysOf(buildLogRowMenu(single, t, handlers()));
    for (const word of ['reset', 'undo', 'fixup', 'squash', 'drop', 'rebase', 'edit']) {
      expect(keys.some((key) => key.includes(word))).toBe(false);
    }
  });

  it('a walk holds at the window’s edge', () => {
    const menu = buildLogRowMenu({ shas: ['c4'], child: null, parent: 'c3' }, t, handlers());
    expect(disabledKeys(menu)).toContain('go-to-child');
    expect(disabledKeys(menu)).not.toContain('go-to-parent');
  });

  it('several commits: copy covers the set; new branch and the walks hold', () => {
    const h = handlers();
    const menu = buildLogRowMenu({ shas: ['c4', 'c3'], child: null, parent: null }, t, h);
    clickKey(menu, 'copy-revision');
    expect(h.onCopyRevision).toHaveBeenCalledWith(['c4', 'c3']);
    expect(disabledKeys(menu)).toEqual(expect.arrayContaining(['new-branch', 'go-to-child', 'go-to-parent']));
  });
});

describe('log-neighbors', () => {
  it('the parent is the first parent when its row is in the window; the child the nearest newer row naming the commit', () => {
    expect(parentInWindow(CHAIN, 'c3')).toBe('c2');
    expect(childInWindow(CHAIN, 'c3')).toBe('c4');
    expect(parentInWindow(CHAIN, 'c1')).toBeNull();
    expect(childInWindow(CHAIN, 'c4')).toBeNull();
    // A parent outside the loaded window is no target.
    expect(parentInWindow(CHAIN.slice(0, 2), 'c3')).toBeNull();
    expect(parentInWindow(CHAIN, 'nope')).toBeNull();
    expect(childInWindow(CHAIN, 'nope')).toBeNull();
  });

  it('a full 40-hex id is a commit sha; a ref name or a short sha is not', () => {
    expect(isFullCommitSha('a'.repeat(40))).toBe(true);
    expect(isFullCommitSha('abc1234')).toBe(false);
    expect(isFullCommitSha('main')).toBe(false);
  });
});

/** The orchestrator's part: the tab remembers the commit the list reports and hands the rows a menu. */
const Harness: React.FC<{
  initial: string | null;
  rowMenu: (target: LogRowMenuTarget) => MenuProps;
  onSelect: (sha: string | null) => void;
}> = ({ initial, rowMenu, onSelect }) => {
  const [selectedSha, setSelectedSha] = useState(initial);
  return (
    <CommitList
      entries={CHAIN}
      graph={null}
      refsBySha={new Map()}
      headSha={null}
      selectedSha={selectedSha}
      onSelect={(sha) => {
        setSelectedSha(sha);
        onSelect(sha);
      }}
      filtersActive={false}
      onResetFilters={() => undefined}
      rowMenu={rowMenu}
    />
  );
};

const row = (sha: string): HTMLElement => {
  const found = screen.getAllByTestId('git-tool-row').find((el) => el.getAttribute('data-sha') === sha);
  if (!found) throw new Error(`no row ${sha}`);
  return found;
};

const selectedShas = (): string[] =>
  screen
    .getAllByTestId('git-tool-row')
    .filter((el) => el.getAttribute('data-selected') === 'true')
    .map((el) => el.getAttribute('data-sha') ?? '');

describe('CommitList — the row menu and the walks', () => {
  function renderList(initial: string | null) {
    const rowMenu = vi.fn<(target: LogRowMenuTarget) => MenuProps>(() => ({ items: [] }));
    const onSelect = vi.fn<(sha: string | null) => void>();
    render(<Harness initial={initial} rowMenu={rowMenu} onSelect={onSelect} />);
    return { rowMenu, onSelect };
  }

  const lastTarget = (rowMenu: ReturnType<typeof renderList>['rowMenu'], sha: string): LogRowMenuTarget | undefined => {
    const calls = rowMenu.mock.calls.filter(([target]) => target.shas[0] === sha || target.shas.includes(sha));
    return calls[calls.length - 1]?.[0];
  };

  it('a right-click on an unselected row selects it alone and reports it; its menu covers that commit', () => {
    const { rowMenu, onSelect } = renderList('c1');
    fireEvent.contextMenu(row('c3'));
    expect(selectedShas()).toEqual(['c3']);
    expect(onSelect).toHaveBeenLastCalledWith('c3');
    expect(lastTarget(rowMenu, 'c3')).toEqual({ shas: ['c3'], child: 'c4', parent: 'c2' });
  });

  it('a right-click on a selected row keeps the set and the menu covers it in list order', () => {
    const { rowMenu, onSelect } = renderList('c3');
    fireEvent.click(row('c1'), { shiftKey: true });
    expect(selectedShas()).toEqual(['c3', 'c2', 'c1']);
    onSelect.mockClear();
    fireEvent.contextMenu(row('c2'));
    expect(selectedShas()).toEqual(['c3', 'c2', 'c1']);
    expect(onSelect).not.toHaveBeenCalled();
    expect(lastTarget(rowMenu, 'c2')).toEqual({ shas: ['c3', 'c2', 'c1'], child: null, parent: null });
  });

  it('Right walks to the parent, Left back to the child; the edges hold', () => {
    const { onSelect } = renderList('c3');
    fireEvent.keyDown(row('c3'), { key: 'ArrowRight' });
    expect(selectedShas()).toEqual(['c2']);
    expect(onSelect).toHaveBeenLastCalledWith('c2');
    fireEvent.keyDown(row('c2'), { key: 'ArrowLeft' });
    expect(selectedShas()).toEqual(['c3']);
    fireEvent.keyDown(row('c3'), { key: 'ArrowLeft' });
    fireEvent.keyDown(row('c4'), { key: 'ArrowLeft' });
    expect(selectedShas()).toEqual(['c4']);
  });
});
