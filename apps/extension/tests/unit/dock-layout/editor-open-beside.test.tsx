// @vitest-environment jsdom
/**
 * A tab opened beside the tab it is opened from — the split action that
 * stands the shown tab in the next group, where that group stands, and
 * the opener that runs first.
 */

import {
  allLeaves,
  type EditorNode,
  findLeaf,
  findParentSplit,
  insertTabIntoLeaf,
  makeLeaf,
  splitLeafWithTab,
} from '@openheaders/ui/workbench/editor-groups';
import type { EditorGroupsState } from '@openheaders/ui/workbench/hooks/editor-groups-shared';
import { useEditorSplitActions } from '@openheaders/ui/workbench/hooks/use-editor-split-actions';
import { besideDirection, useOpenBeside } from '@openheaders/ui/workbench/hooks/use-open-beside';
import type { WorkbenchTab } from '@openheaders/ui/workbench/types';
import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const requestTab = (uid: string, label: string): WorkbenchTab => ({
  id: `request-${uid}`,
  label,
  ruleType: 'GET',
  dirty: false,
  mode: 'request-edit',
  requestUid: uid,
});

const WORKFLOW: WorkbenchTab = {
  id: 'live-wf-wfreboot',
  label: 'Device reboot',
  ruleType: '',
  dirty: false,
  mode: 'live-workflow-edit',
  liveWorkflowUid: 'wfreboot',
};
const SETTINGS: WorkbenchTab = { id: 'settings', label: 'Settings', ruleType: '', dirty: false, mode: 'settings' };
const GET_DEVICE = requestTab('reqgetd1', 'Get dev-1');
const REBOOT = requestTab('reqrebt1', 'Reboot dev-1');

const ROOT = 'leaf-root';

/** The split actions over a state the case can read. */
function actionsOver(root: EditorNode, focusedLeafId: string) {
  const held: { state: EditorGroupsState } = { state: { root, focusedLeafId, nextId: 1 } };
  const { result } = renderHook(() =>
    useEditorSplitActions({
      transform: (fn) => {
        held.state = fn(held.state);
      },
    }),
  );
  return { held, actions: result.current };
}

const tabIds = (root: EditorNode, leafId: string): string[] => findLeaf(root, leafId)?.tabs.map((tab) => tab.id) ?? [];
const shownIn = (root: EditorNode, leafId: string): string | null => findLeaf(root, leafId)?.activeTabId ?? null;

/** One group as an opener leaves it: the workflow's tab, another, and the request it just added and showed. */
const justOpened = makeLeaf(ROOT, [WORKFLOW, SETTINGS, GET_DEVICE], GET_DEVICE.id);

describe('moveShownTabBeside', () => {
  it('splits the shown tab off to the right, and the workflow is its group’s shown tab again', () => {
    const { held, actions } = actionsOver(justOpened, ROOT);

    actions.moveShownTabBeside(WORKFLOW.id, 'right');

    const { root, focusedLeafId, nextId } = held.state;
    expect(tabIds(root, ROOT)).toEqual([WORKFLOW.id, SETTINGS.id]);
    expect(shownIn(root, ROOT)).toBe(WORKFLOW.id);
    expect(tabIds(root, 'leaf-1')).toEqual([GET_DEVICE.id]);
    expect(shownIn(root, 'leaf-1')).toBe(GET_DEVICE.id);
    expect(focusedLeafId).toBe('leaf-1');
    expect(nextId).toBe(2);
    expect(findParentSplit(root, ROOT)).toMatchObject({ orientation: 'horizontal', b: { id: 'leaf-1' } });
  });

  it('splits it off under the workflow where that is the direction', () => {
    const { held, actions } = actionsOver(justOpened, ROOT);

    actions.moveShownTabBeside(WORKFLOW.id, 'bottom');

    expect(findParentSplit(held.state.root, ROOT)).toMatchObject({ orientation: 'vertical', b: { id: 'leaf-1' } });
  });

  it('adds a second request to the group that is already beside, with no third group', () => {
    const beside = splitLeafWithTab(justOpened, ROOT, 'right', GET_DEVICE, 'leaf-1', 'split-1').root;
    const opened = insertTabIntoLeaf(beside, ROOT, REBOOT);
    const { held, actions } = actionsOver(opened, ROOT);

    actions.moveShownTabBeside(WORKFLOW.id, 'bottom');

    const { root, focusedLeafId, nextId } = held.state;
    expect(allLeaves(root).map((leaf) => leaf.id)).toEqual([ROOT, 'leaf-1']);
    expect(tabIds(root, 'leaf-1')).toEqual([GET_DEVICE.id, REBOOT.id]);
    expect(shownIn(root, 'leaf-1')).toBe(REBOOT.id);
    expect(shownIn(root, ROOT)).toBe(WORKFLOW.id);
    expect(focusedLeafId).toBe('leaf-1');
    expect(nextId).toBe(1);
  });

  it('leaves a tab the opener showed in another group where it is', () => {
    const beside = splitLeafWithTab(justOpened, ROOT, 'right', GET_DEVICE, 'leaf-1', 'split-1').root;
    const { held, actions } = actionsOver(beside, 'leaf-1');
    const before = held.state;

    actions.moveShownTabBeside(WORKFLOW.id, 'right');

    expect(held.state).toBe(before);
  });

  it('moves nothing where the workflow is still its group’s shown tab', () => {
    const { held, actions } = actionsOver(makeLeaf(ROOT, [WORKFLOW, SETTINGS], WORKFLOW.id), ROOT);
    const before = held.state;

    actions.moveShownTabBeside(WORKFLOW.id, 'right');

    expect(held.state).toBe(before);
  });
});

describe('besideDirection', () => {
  it.each([
    [1101, 'right'],
    [1080, 'right'],
    [1079, 'bottom'],
    [632, 'bottom'],
    [0, 'bottom'],
  ] as const)('a group %i px wide takes its neighbour at the %s', (width, direction) => {
    expect(besideDirection(width)).toBe(direction);
  });
});

describe('useOpenBeside', () => {
  const page = (
    <div data-leaf-id={ROOT}>
      <div role="tab" tabIndex={0} data-tab-id={WORKFLOW.id} />
    </div>
  );

  it('runs the opener, then stands what it showed beside the anchor by its group’s width', () => {
    const { container } = render(page);
    const group = container.querySelector(`[data-leaf-id="${ROOT}"]`);
    if (group === null) throw new Error('no group');
    vi.spyOn(group, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1101, 879));
    const calls: string[] = [];
    const move = vi.fn<(anchorTabId: string, direction: 'right' | 'bottom') => void>(() => {
      calls.push('move');
    });
    const { result } = renderHook(() => useOpenBeside(move));

    result.current(WORKFLOW.id, () => calls.push('open'));

    expect(calls).toEqual(['open', 'move']);
    expect(move).toHaveBeenCalledExactlyOnceWith(WORKFLOW.id, 'right');
  });

  it('takes the group under the anchor where the anchor’s tab is not in the page', () => {
    const move = vi.fn<(anchorTabId: string, direction: 'right' | 'bottom') => void>();
    const { result } = renderHook(() => useOpenBeside(move));

    result.current(WORKFLOW.id, () => {});

    expect(move).toHaveBeenCalledExactlyOnceWith(WORKFLOW.id, 'bottom');
  });

  it('keeps one identity from render to render', () => {
    const move = vi.fn<(anchorTabId: string, direction: 'right' | 'bottom') => void>();
    const { result, rerender } = renderHook(() => useOpenBeside(move));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
