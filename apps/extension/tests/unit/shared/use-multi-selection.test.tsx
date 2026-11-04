// @vitest-environment jsdom
/**
 * The shared selection hook over a changing order: the live selection
 * is narrowed in the same render, the narrowing is stored so a hidden
 * member stays gone once its row reappears, and the gestures route to
 * the model's transitions.
 */

import { useMultiSelection } from '@openheaders/ui/shared/selection';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const FULL = ['changes', 'file:a', 'file:b', 'unversioned', 'file:c'];
const COLLAPSED = ['changes', 'unversioned', 'file:c'];
const plain = { metaKey: false, ctrlKey: false, shiftKey: false };
const shift = { ...plain, shiftKey: true };
const meta = { ...plain, metaKey: true };

describe('useMultiSelection', () => {
  it('routes click, step and contextMenu to the model', () => {
    const { result } = renderHook(() => useMultiSelection(FULL));
    act(() => result.current.click('file:a', plain));
    act(() => result.current.click('file:b', shift));
    expect([...result.current.selection.ids]).toEqual(['file:a', 'file:b']);
    act(() => result.current.step('unversioned', true));
    expect([...result.current.selection.ids]).toEqual(['file:a', 'file:b', 'unversioned']);
    act(() => result.current.contextMenu('file:c'));
    expect([...result.current.selection.ids]).toEqual(['file:c']);
    act(() => result.current.click('file:a', meta));
    expect(result.current.isSelected('file:a')).toBe(true);
    act(() => result.current.clear());
    expect(result.current.selection.ids.size).toBe(0);
  });

  it('a member hidden by the order is dropped and stays dropped when its row reappears', () => {
    const { result, rerender } = renderHook(({ order }) => useMultiSelection(order), {
      initialProps: { order: FULL },
    });
    act(() => result.current.click('file:a', plain));
    act(() => result.current.click('file:c', shift));
    expect([...result.current.selection.ids]).toEqual(['file:a', 'file:b', 'unversioned', 'file:c']);
    rerender({ order: COLLAPSED });
    expect([...result.current.selection.ids]).toEqual(['unversioned', 'file:c']);
    expect(result.current.selection.anchor).toBeNull();
    rerender({ order: FULL });
    expect([...result.current.selection.ids]).toEqual(['unversioned', 'file:c']);
  });
});
