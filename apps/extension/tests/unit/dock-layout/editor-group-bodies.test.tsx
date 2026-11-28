// @vitest-environment jsdom
/**
 * EditorGroupRenderer — a tab's body outlives the leaf it is drawn in.
 * A split, an orientation flip, a fold and a move between groups all
 * rebuild leaves; the editor in a tab keeps its state through each, and
 * is drawn inside the leaf that holds its tab.
 */

// The tab bar's hints read the keyboard settings.
import '@openheaders/ui/workbench/settings/schema/keyboard';
import { DndContext } from '@dnd-kit/core';
import EditorGroupRenderer from '@openheaders/ui/workbench/components/shell/EditorGroupRenderer';
import {
  activateTabInLeaf,
  allTabs,
  type EditorNode,
  findLeaf,
  findLeafContainingTab,
  firstLeaf,
  flipParentSplit,
  makeLeaf,
  removeTabFromLeaf,
  splitLeafWithTab,
  unsplitLeaf,
} from '@openheaders/ui/workbench/editor-groups';
import type { UseEditorGroupsApi } from '@openheaders/ui/workbench/hooks/useEditorGroups';
import type { WorkbenchTab } from '@openheaders/ui/workbench/types';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  // jsdom ships neither the observer the split panes size themselves
  // with, nor the scroll calls the tab bar makes, nor `window.CSS`.
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
  if (typeof window.CSS === 'undefined') {
    Object.defineProperty(window, 'CSS', {
      configurable: true,
      value: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`) },
    });
  }
});

afterEach(cleanup);

const noop = (): void => {};

const WORKFLOW: WorkbenchTab = {
  id: 'live-wf-wfreboot',
  label: 'Device reboot',
  ruleType: '',
  dirty: false,
  mode: 'live-workflow-edit',
  liveWorkflowUid: 'wfreboot',
};
const REQUEST: WorkbenchTab = {
  id: 'request-reqgetd1',
  label: 'Get dev-1',
  ruleType: 'GET',
  dirty: false,
  mode: 'request-edit',
  requestUid: 'reqgetd1',
};

const mounted: string[] = [];
const unmounted: string[] = [];

beforeEach(() => {
  mounted.length = 0;
  unmounted.length = 0;
});

/** An editor that holds what was typed into it in its own state. */
const Body: React.FC<{ tabId: string }> = ({ tabId }) => {
  const [text, setText] = useState('');
  useEffect(() => {
    mounted.push(tabId);
    return () => {
      unmounted.push(tabId);
    };
  }, [tabId]);
  return <input data-body={tabId} value={text} onChange={(event) => setText(event.target.value)} />;
};

function groupsOf(root: EditorNode, focusedLeafId: string, focusLeaf: (leafId: string) => void): UseEditorGroupsApi {
  const focusedLeaf = findLeaf(root, focusedLeafId) ?? firstLeaf(root);
  return {
    root,
    focusedLeafId,
    focusedLeaf,
    allTabs: allTabs(root),
    tabs: focusedLeaf.tabs,
    activeTabId: focusedLeaf.activeTabId,
    recentlyClosed: [],
    dirtyMap: { current: new Map() },
    saveRefMap: { current: new Map() },
    findTabLeafId: (tabId) => findLeafContainingTab(root, tabId)?.id ?? null,
    addTab: noop,
    closeTab: noop,
    switchTab: noop,
    updateTab: noop,
    replaceTab: noop,
    reorderTab: noop,
    reopenTab: noop,
    focusLeaf,
    closeOtherTabs: noop,
    closeAllTabs: noop,
    closeUnmodifiedTabs: noop,
    closeTabsToLeft: noop,
    closeTabsToRight: noop,
    splitAndMoveRight: noop,
    splitAndMoveLeft: noop,
    splitAndMoveDown: noop,
    splitAndMoveUp: noop,
    moveToOppositeGroup: noop,
    changeSplitterOrientation: noop,
    unsplit: noop,
    unsplitAll: noop,
    moveTabToLeaf: noop,
    splitLeafWithDrop: noop,
  };
}

function tree(root: EditorNode, focusedLeafId: string, focusLeaf: (leafId: string) => void = noop) {
  return (
    <DndContext>
      <EditorGroupRenderer
        groups={groupsOf(root, focusedLeafId, focusLeaf)}
        rules={[]}
        templates={[]}
        requests={[]}
        pausedUids={new Set()}
        renderTabBody={({ tab }) => <Body tabId={tab.id} />}
        renderLeafHeader={() => null}
        renderEmpty={() => null}
        onCreateRule={noop}
        onCreateRequest={noop}
        onCloseTab={noop}
        onCloseOther={noop}
        onCloseAll={noop}
        onCloseUnmodified={noop}
        onCloseToLeft={noop}
        onCloseToRight={noop}
        recentlyClosed={[]}
      />
    </DndContext>
  );
}

const ROOT = 'leaf-root';
const SIDE = 'leaf-1';

/** One group of two tabs, the request's shown. */
const oneGroup = makeLeaf(ROOT, [WORKFLOW, REQUEST], REQUEST.id);
/** The same group with the workflow's shown. */
const oneGroupOnWorkflow = activateTabInLeaf(oneGroup, ROOT, WORKFLOW.id);
/** The request's tab moved into a group of its own, at the right. */
const splitRight = splitLeafWithTab(oneGroupOnWorkflow, ROOT, 'right', REQUEST, SIDE, 'split-1').root;
/** The same two groups, one over the other. */
const splitDown = flipParentSplit(splitRight, ROOT);
/** The two groups folded into the workflow's. */
const folded = unsplitLeaf(splitDown, ROOT);

function bodyOf(container: HTMLElement, tab: WorkbenchTab): HTMLInputElement {
  const body = container.querySelector<HTMLInputElement>(`[data-body="${tab.id}"]`);
  if (body === null) throw new Error(`no body for ${tab.id}`);
  return body;
}

function leafOf(container: HTMLElement, leafId: string): HTMLElement {
  const leaf = container.querySelector<HTMLElement>(`[data-leaf-id="${leafId}"]`);
  if (leaf === null) throw new Error(`no leaf ${leafId}`);
  return leaf;
}

/** Both editors typed into, in one group — the request's first, then the workflow's. */
function renderBothEdited() {
  const view = render(tree(oneGroup, ROOT));
  fireEvent.change(bodyOf(view.container, REQUEST), { target: { value: 'a header typed' } });
  view.rerender(tree(oneGroupOnWorkflow, ROOT));
  fireEvent.change(bodyOf(view.container, WORKFLOW), { target: { value: 'a note typed' } });
  return view;
}

describe('EditorGroupRenderer — a body outlives the leaf it is drawn in', () => {
  it('keeps both editors as they are when a tab is split away to the right', () => {
    const { container, rerender } = renderBothEdited();

    rerender(tree(splitRight, SIDE));

    expect(bodyOf(container, WORKFLOW).value).toBe('a note typed');
    expect(bodyOf(container, REQUEST).value).toBe('a header typed');
    expect(mounted).toEqual([REQUEST.id, WORKFLOW.id]);
    expect(unmounted).toEqual([]);
  });

  it('keeps them through an orientation flip and through the fold back into one group', () => {
    const { container, rerender } = renderBothEdited();

    rerender(tree(splitRight, SIDE));
    rerender(tree(splitDown, SIDE));
    expect(bodyOf(container, WORKFLOW).value).toBe('a note typed');
    expect(bodyOf(container, REQUEST).value).toBe('a header typed');

    rerender(tree(folded, ROOT));
    expect(bodyOf(container, WORKFLOW).value).toBe('a note typed');
    expect(bodyOf(container, REQUEST).value).toBe('a header typed');
    expect(mounted).toEqual([REQUEST.id, WORKFLOW.id]);
    expect(unmounted).toEqual([]);
  });

  it('draws each body inside the leaf that holds its tab', () => {
    const { container, rerender } = renderBothEdited();
    expect(leafOf(container, ROOT).contains(bodyOf(container, REQUEST))).toBe(true);

    rerender(tree(splitRight, SIDE));

    expect(leafOf(container, ROOT).contains(bodyOf(container, WORKFLOW))).toBe(true);
    expect(leafOf(container, SIDE).contains(bodyOf(container, REQUEST))).toBe(true);
    expect(leafOf(container, ROOT).contains(bodyOf(container, REQUEST))).toBe(false);
  });

  it('shows the active tab of each group and hides the others', () => {
    const { container, rerender } = renderBothEdited();
    const panelOf = (tab: WorkbenchTab) => bodyOf(container, tab).closest<HTMLElement>('.rules-editor-tab-panel');

    expect(panelOf(WORKFLOW)?.style.display).toBe('');
    expect(panelOf(REQUEST)?.style.display).toBe('none');

    rerender(tree(splitRight, SIDE));

    expect(panelOf(WORKFLOW)?.style.display).toBe('');
    expect(panelOf(REQUEST)?.style.display).toBe('');
  });

  it('focuses the leaf of the body that is pressed', () => {
    const focusLeaf = vi.fn<(leafId: string) => void>();
    const { container } = render(tree(splitRight, SIDE, focusLeaf));

    fireEvent.pointerDown(bodyOf(container, WORKFLOW));
    expect(focusLeaf).toHaveBeenLastCalledWith(ROOT);

    fireEvent.pointerDown(bodyOf(container, REQUEST));
    expect(focusLeaf).toHaveBeenLastCalledWith(SIDE);
  });

  it('mounts no body for a tab that was never shown', () => {
    const { container } = render(tree(oneGroupOnWorkflow, ROOT));

    expect(container.querySelector(`[data-body="${REQUEST.id}"]`)).toBeNull();
    expect(mounted).toEqual([WORKFLOW.id]);
  });

  it('takes a closed tab’s body away, and that body alone', () => {
    const { container, rerender } = renderBothEdited();
    rerender(tree(splitRight, SIDE));

    rerender(tree(unsplitLeaf(removeTabFromLeaf(splitRight, SIDE, REQUEST.id), ROOT), ROOT));

    expect(container.querySelector(`[data-body="${REQUEST.id}"]`)).toBeNull();
    expect(bodyOf(container, WORKFLOW).value).toBe('a note typed');
    expect(unmounted).toEqual([REQUEST.id]);
  });
});
