// @vitest-environment jsdom
/**
 * The selection hook over row numbers: the gestures route to the
 * model's transitions, and a selection made in one list is none in
 * another — in the same render, and for good.
 */

import { useRowSelection } from '@openheaders/ui/shared/selection';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const plain = { metaKey: false, ctrlKey: false, shiftKey: false };
const shift = { ...plain, shiftKey: true };
const meta = { ...plain, metaKey: true };

describe('useRowSelection', () => {
  it('routes click, step and contextMenu to the model', () => {
    const { result } = renderHook(() => useRowSelection('g1'));
    act(() => result.current.click(4, plain));
    act(() => result.current.click(7, shift));
    expect(result.current.selection.ranges).toEqual([{ first: 4, last: 7 }]);
    act(() => result.current.step(8, true));
    expect(result.current.selection.ranges).toEqual([{ first: 4, last: 8 }]);
    expect(result.current.selection.lead).toBe(8);
    act(() => result.current.contextMenu(6));
    expect(result.current.selection.ranges).toEqual([{ first: 4, last: 8 }]);
    act(() => result.current.contextMenu(20));
    expect(result.current.selection.ranges).toEqual([{ first: 20, last: 20 }]);
    act(() => result.current.click(2, meta));
    expect(result.current.isSelected(2)).toBe(true);
    expect(result.current.isSelected(20)).toBe(true);
    expect(result.current.isSelected(3)).toBe(false);
    act(() => result.current.clear());
    expect(result.current.selection.ranges).toEqual([]);
  });

  it('holds no selection in another list, in the same render', () => {
    const { result, rerender } = renderHook(({ list }) => useRowSelection(list), { initialProps: { list: 'g1' } });
    act(() => result.current.click(4, plain));
    rerender({ list: 'g2' });
    expect(result.current.selection.ranges).toEqual([]);
    expect(result.current.selection.lead).toBeNull();
    expect(result.current.isSelected(4)).toBe(false);
  });

  it('starts a gesture in another list from nothing, and forgets the list before', () => {
    const { result, rerender } = renderHook(({ list }) => useRowSelection(list), { initialProps: { list: 'g1' } });
    act(() => result.current.click(4, plain));
    rerender({ list: 'g2' });
    // The range has no anchor to grow from: the first list's is not this one's.
    act(() => result.current.click(9, shift));
    expect(result.current.selection.ranges).toEqual([{ first: 9, last: 9 }]);
    rerender({ list: 'g1' });
    expect(result.current.selection.ranges).toEqual([]);
  });
});
