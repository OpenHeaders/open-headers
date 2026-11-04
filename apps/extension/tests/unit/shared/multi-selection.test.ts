/**
 * Pure-model suite for the shared multi-selection: the primitives
 * (toggle, the anchor-based range), then plain, toggled (Cmd/Ctrl)
 * and ranged (Shift) clicks over the visible order, the right-click
 * rule, Shift+step extension, and the prune after a collapse hides
 * members.
 */

import {
  clickModifiers,
  EMPTY_SELECTION,
  type MultiSelection,
  pruneSelection,
  rangeIds,
  selectOnClick,
  selectOnContextMenu,
  selectOnStep,
  toggleId,
} from '@openheaders/ui/shared/selection';
import { describe, expect, it } from 'vitest';

// col-a › folder-f › grpc-x · col-b › leaf-y  (placeholders are not rows)
const ROWS = ['col-a', 'folder-f', 'grpc-x', 'col-b', 'leaf-y'];
const ids = (selection: MultiSelection): string[] => [...selection.ids];
const plain = { toggle: false, range: false };
const toggle = { toggle: true, range: false };
const range = { toggle: false, range: true };

describe('clickModifiers', () => {
  it('reads Cmd or Ctrl as toggle and Shift as range', () => {
    expect(clickModifiers({ metaKey: true, ctrlKey: false, shiftKey: false })).toEqual(toggle);
    expect(clickModifiers({ metaKey: false, ctrlKey: true, shiftKey: false })).toEqual(toggle);
    expect(clickModifiers({ metaKey: false, ctrlKey: false, shiftKey: true })).toEqual(range);
    expect(clickModifiers({ metaKey: false, ctrlKey: false, shiftKey: false })).toEqual(plain);
  });
});

describe('toggleId', () => {
  it('adds an absent id and removes a present one, never mutating the input', () => {
    const base = new Set(['col-a']);
    expect([...toggleId(base, 'grpc-x')]).toEqual(['col-a', 'grpc-x']);
    expect([...toggleId(base, 'col-a')]).toEqual([]);
    expect([...base]).toEqual(['col-a']);
  });
});

describe('rangeIds', () => {
  it('selects the visible run between the anchor and the row, either direction', () => {
    const down = rangeIds(ROWS, { id: 'folder-f', base: new Set() }, 'col-b');
    expect([...down]).toEqual(['folder-f', 'grpc-x', 'col-b']);
    const up = rangeIds(ROWS, { id: 'leaf-y', base: new Set() }, 'grpc-x');
    expect([...up]).toEqual(['grpc-x', 'col-b', 'leaf-y']);
  });

  it('grows on the anchor base', () => {
    const next = rangeIds(ROWS, { id: 'col-a', base: new Set(['leaf-y']) }, 'grpc-x');
    expect([...next]).toEqual(['leaf-y', 'col-a', 'folder-f', 'grpc-x']);
  });

  it('a second range from the same anchor replaces the first, not extends it', () => {
    const anchor = { id: 'col-a', base: new Set<string>() };
    rangeIds(ROWS, anchor, 'col-b');
    expect([...rangeIds(ROWS, anchor, 'folder-f')]).toEqual(['col-a', 'folder-f']);
  });

  it('an anchor no longer visible falls back to picking the row alone on the base', () => {
    expect([...rangeIds(ROWS, { id: 'gone', base: new Set(['col-a']) }, 'leaf-y')]).toEqual(['col-a', 'leaf-y']);
  });
});

describe('selectOnClick', () => {
  it('a plain click selects the row alone and anchors there on an empty base', () => {
    const next = selectOnClick(EMPTY_SELECTION, ROWS, 'folder-f', plain);
    expect(ids(next)).toEqual(['folder-f']);
    expect(next.anchor).toEqual({ id: 'folder-f', base: new Set() });
    expect(next.lead).toBe('folder-f');
  });

  it('a toggled click adds a row, a second toggled click on it removes it; the anchor follows', () => {
    const one = selectOnClick(EMPTY_SELECTION, ROWS, 'col-a', plain);
    const two = selectOnClick(one, ROWS, 'grpc-x', toggle);
    expect(ids(two)).toEqual(['col-a', 'grpc-x']);
    expect(two.anchor?.id).toBe('grpc-x');
    const back = selectOnClick(two, ROWS, 'col-a', toggle);
    expect(ids(back)).toEqual(['grpc-x']);
    expect(back.lead).toBe('col-a');
  });

  it('a ranged click after a plain click is the pure run from the anchor, either direction, anchor kept', () => {
    const one = selectOnClick(EMPTY_SELECTION, ROWS, 'folder-f', plain);
    const down = selectOnClick(one, ROWS, 'leaf-y', range);
    expect(ids(down)).toEqual(['folder-f', 'grpc-x', 'col-b', 'leaf-y']);
    expect(down.anchor?.id).toBe('folder-f');
    expect(down.lead).toBe('leaf-y');
    const up = selectOnClick(down, ROWS, 'col-a', range);
    expect(ids(up)).toEqual(['col-a', 'folder-f']);
    expect(up.anchor?.id).toBe('folder-f');
  });

  it('a ranged click after toggled clicks adds the run to the set the anchor was made with', () => {
    const one = selectOnClick(EMPTY_SELECTION, ROWS, 'leaf-y', plain);
    const two = selectOnClick(one, ROWS, 'col-a', toggle);
    const three = selectOnClick(two, ROWS, 'folder-f', range);
    expect(ids(three)).toEqual(['leaf-y', 'col-a', 'folder-f']);
    expect(three.anchor?.id).toBe('col-a');
  });

  it('a ranged click with nothing selected selects the row alone and anchors there', () => {
    const next = selectOnClick(EMPTY_SELECTION, ROWS, 'grpc-x', range);
    expect(ids(next)).toEqual(['grpc-x']);
    expect(next.anchor?.id).toBe('grpc-x');
  });
});

describe('selectOnContextMenu', () => {
  it('keeps a selection the row sits in; a row outside becomes the only selection', () => {
    const two = selectOnClick(selectOnClick(EMPTY_SELECTION, ROWS, 'col-a', plain), ROWS, 'grpc-x', toggle);
    expect(selectOnContextMenu(two, 'col-a')).toBe(two);
    const other = selectOnContextMenu(two, 'folder-f');
    expect(ids(other)).toEqual(['folder-f']);
    expect(other.anchor?.id).toBe('folder-f');
  });
});

describe('selectOnStep', () => {
  it('a plain step collapses the selection onto the row; Shift extends the range from the anchor', () => {
    const one = selectOnClick(EMPTY_SELECTION, ROWS, 'folder-f', plain);
    const extended = selectOnStep(one, ROWS, 'grpc-x', true);
    expect(ids(extended)).toEqual(['folder-f', 'grpc-x']);
    expect(extended.anchor?.id).toBe('folder-f');
    expect(extended.lead).toBe('grpc-x');
    const collapsed = selectOnStep(extended, ROWS, 'col-b', false);
    expect(ids(collapsed)).toEqual(['col-b']);
    expect(collapsed.anchor?.id).toBe('col-b');
  });

  it('a Shift+step with no anchor ranges from the lead', () => {
    const cursor: MultiSelection = { ids: new Set(), anchor: null, lead: 'grpc-x' };
    const extended = selectOnStep(cursor, ROWS, 'leaf-y', true);
    expect(ids(extended)).toEqual(['grpc-x', 'col-b', 'leaf-y']);
    expect(extended.anchor?.id).toBe('grpc-x');
  });
});

describe('pruneSelection', () => {
  it('returns the same selection while every member is visible', () => {
    const one = selectOnClick(EMPTY_SELECTION, ROWS, 'folder-f', plain);
    expect(pruneSelection(one, ROWS)).toBe(one);
    expect(pruneSelection(EMPTY_SELECTION, ROWS)).toBe(EMPTY_SELECTION);
  });

  it('drops hidden members; a hidden anchor goes, a hidden lead falls back to the first survivor', () => {
    const run = selectOnClick(selectOnClick(EMPTY_SELECTION, ROWS, 'col-a', plain), ROWS, 'grpc-x', range);
    // col-a collapsed: its subtree is gone from the order.
    const gone = pruneSelection(run, ['col-a', 'col-b', 'leaf-y']);
    expect(ids(gone)).toEqual(['col-a']);
    expect(gone.anchor?.id).toBe('col-a');
    expect(gone.lead).toBe('col-a');
    const partial = pruneSelection(run, ['folder-f', 'grpc-x']);
    expect(ids(partial)).toEqual(['folder-f', 'grpc-x']);
    expect(partial.anchor).toBeNull();
    expect(partial.lead).toBe('grpc-x');
  });
});
