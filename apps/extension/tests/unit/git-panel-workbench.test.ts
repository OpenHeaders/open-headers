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
});
