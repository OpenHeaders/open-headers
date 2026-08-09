/**
 * Git panel workbench suite: the git tab registry + the SHARED
 * pane-tabs store wiring (the terminal architecture the git panel now
 * rides) — reconcile on add/remove, the permanent primary-tab law,
 * split/move/unsplit verbs, and the visual-order push-back.
 */

import {
  GIT_PRIMARY_TAB_KEY,
  getGitPanelWorkbench,
} from '@openheaders/ui/workbench/components/panels/git/git-panel-view-store';
import { allLeaves, allTabs } from '@openheaders/ui/workbench/editor-groups';
import { describe, expect, it } from 'vitest';

let seq = 0;
const freshWorkbench = () => getGitPanelWorkbench(`ws-test-${seq++}`);

describe('git panel workbench (shared pane-tabs machinery)', () => {
  it('starts with the primary log tab in one root leaf', () => {
    const { registry, panes } = freshWorkbench();
    expect(registry.tabs().map((tab) => tab.kind)).toEqual(['log']);
    const leaves = allLeaves(panes.root());
    expect(leaves).toHaveLength(1);
    expect(leaves[0].tabs.map((ref) => ref.id)).toEqual([GIT_PRIMARY_TAB_KEY]);
    expect(leaves[0].activeTabId).toBe(GIT_PRIMARY_TAB_KEY);
  });

  it('new log tabs and the console land in the focused leaf and activate', () => {
    const { registry, panes } = freshWorkbench();
    registry.newLogTab();
    registry.openConsole();
    const leaf = allLeaves(panes.root())[0];
    expect(leaf.tabs.map((ref) => ref.id)).toEqual([GIT_PRIMARY_TAB_KEY, 'log:2', 'console']);
    expect(registry.activeId()).toBe('console');
    expect(leaf.activeTabId).toBe('console');
    // Re-opening an existing console only re-activates it.
    registry.openConsole();
    expect(allLeaves(panes.root())[0].tabs).toHaveLength(3);
  });

  it('closeTabs skips the permanent primary tab', () => {
    const { registry, panes } = freshWorkbench();
    registry.newLogTab();
    registry.openConsole();
    registry.closeTabs([GIT_PRIMARY_TAB_KEY, 'log:2', 'console']);
    expect(registry.tabs().map((tab) => tab.kind)).toEqual(['log']);
    const leaf = allLeaves(panes.root())[0];
    expect(leaf.tabs.map((ref) => ref.id)).toEqual([GIT_PRIMARY_TAB_KEY]);
    expect(registry.activeId()).toBe(GIT_PRIMARY_TAB_KEY);
  });

  it('splitAndMove opens a second pane; closing its tab folds the split away', () => {
    const { registry, panes } = freshWorkbench();
    registry.newLogTab();
    const rootLeaf = allLeaves(panes.root())[0];
    panes.splitAndMove(rootLeaf.id, 'log:2', 'right');

    expect(panes.root().kind).toBe('split');
    const leaves = allLeaves(panes.root());
    expect(leaves).toHaveLength(2);
    expect(leaves.map((leaf) => leaf.tabs.map((ref) => ref.id))).toEqual([[GIT_PRIMARY_TAB_KEY], ['log:2']]);
    // The created pane is focused; its tab is the registry's active.
    expect(panes.focusedLeafId()).toBe(leaves[1].id);
    expect(registry.activeId()).toBe('log:2');

    registry.closeTabs(['log:2']);
    expect(panes.root().kind).toBe('leaf');
    expect(allTabs(panes.root()).map((ref) => ref.id)).toEqual([GIT_PRIMARY_TAB_KEY]);
  });

  it('moveToOppositeGroup moves a tab across the split and refuses to strand a lone tab', () => {
    const { registry, panes } = freshWorkbench();
    registry.newLogTab();
    registry.newLogTab();
    const rootLeaf = allLeaves(panes.root())[0];
    panes.splitAndMove(rootLeaf.id, 'log:3', 'right');

    const [left, right] = allLeaves(panes.root());
    panes.moveToOppositeGroup(left.id, 'log:2');
    const after = allLeaves(panes.root());
    expect(after.map((leaf) => leaf.tabs.map((ref) => ref.id))).toEqual([[GIT_PRIMARY_TAB_KEY], ['log:3', 'log:2']]);
    expect(right.id).toBe(after[1].id);
  });

  it('unsplitAll folds every pane into one and keeps all tabs', () => {
    const { registry, panes } = freshWorkbench();
    registry.newLogTab();
    registry.newLogTab();
    const rootLeaf = allLeaves(panes.root())[0];
    panes.splitAndMove(rootLeaf.id, 'log:2', 'right');
    const remaining = allLeaves(panes.root())[0];
    panes.splitAndMove(remaining.id, 'log:3', 'bottom');
    expect(allLeaves(panes.root())).toHaveLength(3);

    panes.unsplitAll();
    expect(panes.root().kind).toBe('leaf');
    expect(
      allTabs(panes.root())
        .map((ref) => ref.id)
        .sort(),
    ).toEqual([GIT_PRIMARY_TAB_KEY, 'log:2', 'log:3']);
  });

  it('pane moves push the visual order back into the registry', () => {
    const { registry, panes } = freshWorkbench();
    registry.newLogTab();
    const leaf = allLeaves(panes.root())[0];
    panes.reorderTab(leaf.id, 'log:2', GIT_PRIMARY_TAB_KEY);
    expect(registry.tabs().map((tab) => (tab.kind === 'log' ? `log:${tab.id}` : 'console'))).toEqual([
      'log:2',
      GIT_PRIMARY_TAB_KEY,
    ]);
  });

  it('patchLogTab updates one tab and preserves the others', () => {
    const { registry } = freshWorkbench();
    registry.newLogTab();
    registry.patchLogTab('log:2', { filter: 'fix', selectedRef: 'main' });
    const tabs = registry.tabs();
    expect(tabs[0]).toMatchObject({ kind: 'log', id: 1, filter: '' });
    expect(tabs[1]).toMatchObject({ kind: 'log', id: 2, filter: 'fix', selectedRef: 'main' });
  });

  it('log tabs start with every toolbar filter off (the IDE default row)', () => {
    const { registry } = freshWorkbench();
    const [primary] = registry.tabs();
    expect(primary).toMatchObject({
      kind: 'log',
      filterRegex: false,
      filterCase: false,
      author: null,
      date: null,
      paths: [],
      sort: 'date',
      firstParent: false,
      noMerges: false,
    });
    registry.patchLogTab(GIT_PRIMARY_TAB_KEY, {
      author: { kind: 'me' },
      date: { kind: 'preset', preset: '7d' },
      paths: ['rules'],
      sort: 'topo',
      noMerges: true,
    });
    expect(registry.tabs()[0]).toMatchObject({
      author: { kind: 'me' },
      date: { kind: 'preset', preset: '7d' },
      paths: ['rules'],
      sort: 'topo',
      noMerges: true,
    });
  });

  it('log tabs carry the rail selection and start with the rail expanded', () => {
    const { registry } = freshWorkbench();
    const [primary] = registry.tabs();
    expect(primary).toMatchObject({ kind: 'log', refsCollapsed: false, railSelection: null });
    registry.patchLogTab(GIT_PRIMARY_TAB_KEY, {
      railSelection: { name: 'v5/data-model', kind: 'local' },
      refsCollapsed: true,
    });
    expect(registry.tabs()[0]).toMatchObject({
      railSelection: { name: 'v5/data-model', kind: 'local' },
      refsCollapsed: true,
    });
  });

  it('openCompare mints one closable tab per ref and re-activates on repeat', () => {
    const { registry, panes } = freshWorkbench();
    registry.openCompare('v5/data-model');
    const leaf = allLeaves(panes.root())[0];
    expect(leaf.tabs.map((ref) => ref.id)).toEqual([GIT_PRIMARY_TAB_KEY, 'compare:2']);
    expect(registry.activeId()).toBe('compare:2');
    expect(registry.tabs()[1]).toMatchObject({
      kind: 'compare',
      ref: 'v5/data-model',
      selectedInCurrent: null,
      selectedInRef: null,
    });

    // Same ref re-activates; a different ref opens a second tab.
    registry.newLogTab();
    registry.openCompare('v5/data-model');
    expect(registry.activeId()).toBe('compare:2');
    registry.openCompare('main');
    expect(registry.tabs().filter((tab) => tab.kind === 'compare')).toHaveLength(2);

    // Compare tabs close like any non-primary tab; per-side selections patch.
    registry.patchCompareTab('compare:2', { selectedInCurrent: 'abc' });
    expect(registry.tabs()[1]).toMatchObject({ kind: 'compare', selectedInCurrent: 'abc' });
    registry.closeTabs(['compare:2']);
    expect(registry.tabs().some((tab) => tab.kind === 'compare' && tab.ref === 'v5/data-model')).toBe(false);
  });
});
