// @vitest-environment jsdom
/**
 * InspectorEditorGroupRenderer — lazy keep-alive tab bodies. A tab body
 * first mounts when its tab first becomes active and stays mounted from
 * then on (scroll memory, drafts). Opening a session with many tabs must
 * not pay the render cost of every body up front — only the active one.
 */

import { DndContext } from '@dnd-kit/core';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import InspectorEditorGroupRenderer, {
  type RenderLeafContext,
} from '@openheaders/ui/panel/components/InspectorEditorGroupRenderer';
import { makeLeaf } from '@openheaders/ui/panel/data/editor-groups';
import { buildInspectorTab, type InspectorTab } from '@openheaders/ui/panel/data/inspector-tab';
import type { UseInspectorEditorGroupsApi } from '@openheaders/ui/panel/data/use-inspector-editor-groups';
import { cleanup, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  // jsdom implements neither scroll API the tab bar's auto-scroll uses,
  // nor `window.CSS` (same stubs as panel-inspector-tab-bar.test.tsx).
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn() as unknown as Element['scrollTo'];
  if (typeof window.CSS === 'undefined') {
    Object.defineProperty(window, 'CSS', {
      configurable: true,
      value: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) },
    });
  }
});

afterEach(cleanup);

type BodySpy = (ctx: RenderLeafContext) => React.ReactNode;

function makeTab(n: number): InspectorTab {
  return buildInspectorTab({
    lifecycle: {
      requestId: `req-${n}`,
      url: `https://openheaders.io/api/${n}`,
      method: 'GET',
      statusCode: 200,
      startedAtMs: 1_770_000_000_000 + n,
    } as unknown as RequestLifecycle,
    displayId: n,
  });
}

/** Minimal groups API — the renderer only reads tree/focus state here;
 *  the action surface is inert. */
function makeGroups(tabs: InspectorTab[], activeTabId: string): UseInspectorEditorGroupsApi {
  const leaf = makeLeaf('leaf-root', tabs, activeTabId);
  const noop = () => {};
  return {
    root: leaf,
    focusedLeafId: leaf.id,
    focusedLeaf: leaf,
    allTabs: tabs,
    tabs,
    activeTabId,
    recentlyClosed: [],
    findTabLeafId: () => leaf.id,
    addTab: noop,
    closeTab: noop,
    switchTab: noop,
    updateTab: noop,
    reorderTab: noop,
    reopenTab: noop,
    focusLeaf: noop,
    closeOtherTabs: noop,
    closeAllTabs: noop,
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
  } as unknown as UseInspectorEditorGroupsApi;
}

function renderTree(tabs: InspectorTab[], activeTabId: string, renderTabBody: BodySpy) {
  const groups = makeGroups(tabs, activeTabId);
  return (
    <DndContext>
      <InspectorEditorGroupRenderer
        groups={groups}
        renderTabBody={renderTabBody}
        renderEmpty={() => null}
        onCloseTab={() => {}}
        onCloseOther={() => {}}
        onCloseAll={() => {}}
        onCloseToLeft={() => {}}
        onCloseToRight={() => {}}
        recentlyClosed={[]}
      />
    </DndContext>
  );
}

describe('InspectorEditorGroupRenderer — lazy keep-alive tab bodies', () => {
  it('mounts only the active tab body on first render, not every open tab', () => {
    const tabs = [makeTab(1), makeTab(2), makeTab(3)];
    const bodySpy: BodySpy = ({ tab }) => <div data-body-id={tab.id} />;
    const { container } = render(renderTree(tabs, tabs[0].id, bodySpy));

    expect(container.querySelectorAll('[data-body-id]')).toHaveLength(1);
    expect(container.querySelector(`[data-body-id="${tabs[0].id}"]`)).toBeTruthy();
  });

  it('an activated body stays mounted (keep-alive) after switching away', () => {
    const tabs = [makeTab(1), makeTab(2), makeTab(3)];
    const bodySpy: BodySpy = ({ tab }) => <div data-body-id={tab.id} />;
    const { container, rerender } = render(renderTree(tabs, tabs[0].id, bodySpy));

    rerender(renderTree(tabs, tabs[1].id, bodySpy));
    // Tab 2's body mounted on activation; tab 1's stayed alive hidden.
    expect(container.querySelectorAll('[data-body-id]')).toHaveLength(2);

    rerender(renderTree(tabs, tabs[0].id, bodySpy));
    expect(container.querySelectorAll('[data-body-id]')).toHaveLength(2);
    // Tab 3 was never active — still unmounted.
    expect(container.querySelector(`[data-body-id="${tabs[2].id}"]`)).toBeNull();
  });

  it('hides inactive mounted bodies via display:none, active one visible', () => {
    const tabs = [makeTab(1), makeTab(2)];
    const bodySpy: BodySpy = ({ tab }) => <div data-body-id={tab.id} />;
    const { container, rerender } = render(renderTree(tabs, tabs[0].id, bodySpy));
    rerender(renderTree(tabs, tabs[1].id, bodySpy));

    const panels = [...container.querySelectorAll<HTMLElement>('.dt-editor-tab-panel')];
    expect(panels).toHaveLength(2);
    expect(panels[0].style.display).toBe('none');
    expect(panels[1].style.display).not.toBe('none');
  });
});
