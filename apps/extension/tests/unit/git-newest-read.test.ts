/**
 * `useNewestRead` — a surface that reads again while a read is out
 * takes its newest read's answer alone: a read is superseded once a
 * newer one begins, and every read once the surface is gone.
 */

import { useNewestRead } from '@openheaders/ui/workbench/components/panels/git/use-newest-read';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('useNewestRead', () => {
  it('a read is superseded once a newer one begins', () => {
    const hook = renderHook(() => useNewestRead());
    const first = hook.result.current();
    expect(first()).toBe(false);
    const second = hook.result.current();
    expect(first()).toBe(true);
    expect(second()).toBe(false);
  });

  it('is one function across renders — a read keyed on it does not run again', () => {
    const hook = renderHook(() => useNewestRead());
    const begin = hook.result.current;
    hook.rerender();
    expect(hook.result.current).toBe(begin);
  });

  it('every read is superseded once the surface is gone', () => {
    const hook = renderHook(() => useNewestRead());
    const read = hook.result.current();
    hook.unmount();
    expect(read()).toBe(true);
  });
});
