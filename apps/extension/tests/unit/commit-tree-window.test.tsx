// @vitest-environment jsdom
/**
 * The Commit tree over a working tree far larger than its viewport: it
 * mounts the rows in view and no others — on its first draw, where it
 * is scrolled to, and while it stands hidden (a kept-alive tool window
 * behind another); the keyboard brings a row into view by its place in
 * the list, mounted or not. The scroller's numbers are set by hand.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import CommitChangesTree from '@openheaders/ui/workbench/components/panels/git/commit/CommitChangesTree';
import {
  EMPTY_CHECKED_STATE,
  splitChangeGroups,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-model';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FILES = 2_000;
const ROW = 24;
const pad = (n: number): string => String(n).padStart(4, '0');
const ROWS: WorkspaceTreeWorkingChangeWire[] = Array.from({ length: FILES }, (_, n) => ({
  path: `requests/r${pad(n)}.yaml`,
  status: 'D',
  unversioned: false,
  ignored: false,
}));
const GROUPS = splitChangeGroups(ROWS);

/** The tree's scroller as an engine lays it out; 0 is a scroller that is not shown. */
const viewport = { px: 0 };
/** The observers the tree's window made, so a test resizes its scroller. */
let observers: { fire: () => void; disconnected: boolean }[] = [];
const resize = (): void =>
  act(() => {
    for (const entry of observers) if (!entry.disconnected) entry.fire();
  });

beforeEach(() => {
  observers = [];
  viewport.px = 240;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly entry: { fire: () => void; disconnected: boolean };
      constructor(callback: () => void) {
        this.entry = { fire: callback, disconnected: false };
        observers.push(this.entry);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        this.entry.disconnected = true;
      }
    },
  );
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === 'commit-tool-tree' ? viewport.px : 0;
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
});

function renderTree(): HTMLElement {
  render(
    <AntApp>
      <CommitChangesTree
        groups={GROUPS}
        checked={EMPTY_CHECKED_STATE}
        onSetChecked={() => undefined}
        onOpenFile={() => undefined}
        groupByDirectory={false}
        showIgnored={false}
        rowMenu={() => null}
      />
    </AntApp>,
  );
  return screen.getByTestId('commit-tool-tree');
}

const mountedFiles = (): string[] =>
  [...document.querySelectorAll('[data-testid="commit-tool-file"]')].map((row) => row.getAttribute('data-path') ?? '');

describe('the Commit tree over a large working tree', () => {
  it('mounts the rows in view on its first draw — the group’s header and the files under it, with the rest as padding', () => {
    const tree = renderTree();
    // 240 px shown and 600 px beyond it: 35 rows of 24 px — the header and 34 files.
    expect(mountedFiles()).toHaveLength(34);
    expect(mountedFiles()[0]).toBe('requests/r0000.yaml');
    expect(screen.getByTestId('commit-tool-group-changes')).toBeTruthy();
    const [above, below] = [tree.firstElementChild, tree.children[tree.children.length - 1]] as HTMLElement[];
    expect(above.style.height).toBe('0px');
    expect(below.style.height).toBe(`${(FILES + 1 - 35) * ROW}px`);
    // The padding holds its height where the scroller is a flex column, which squeezes an empty block to nothing.
    expect([above.style.flexShrink, below.style.flexShrink]).toEqual(['0', '0']);
  });

  it('follows the scroller: the rows where it stands are mounted, the first ones are not', () => {
    const tree = renderTree();
    tree.scrollTop = 1_000 * ROW;
    fireEvent.scroll(tree);
    // Row 1000 of the list is file 999; 25 rows are mounted above the viewport's top and 35 from it down.
    expect(mountedFiles()).toHaveLength(60);
    expect(mountedFiles()[0]).toBe('requests/r0974.yaml');
    expect(mountedFiles()).not.toContain('requests/r0000.yaml');
    expect(screen.queryByTestId('commit-tool-group-changes')).toBeNull();
  });

  it('hidden, it keeps the rows it had mounted — never the whole list', () => {
    const tree = renderTree();
    tree.scrollTop = 1_000 * ROW;
    fireEvent.scroll(tree);
    viewport.px = 0;
    resize();
    expect(mountedFiles()).toHaveLength(60);
  });

  it('the keyboard brings a row into view by its place in the list — one that is not mounted too', () => {
    const tree = renderTree();
    tree.scrollTop = 1_000 * ROW;
    fireEvent.scroll(tree);
    // With no row selected Up lands on the list's first row: the group's header, far above what is mounted.
    fireEvent.keyDown(tree, { key: 'ArrowUp' });
    expect(tree.scrollTop).toBe(0);
    fireEvent.scroll(tree);
    expect(document.querySelector('[data-testid="commit-tool-group-changes"].selected')).not.toBeNull();
  });
});
