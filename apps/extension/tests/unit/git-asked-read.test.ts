/**
 * `useAskedRead` — a read the person pressed Refresh for is counted
 * from the press until its answer is in; two presses out at once hold
 * until the last answers. The reads a window makes by itself never go
 * through it, so they say nothing.
 */

import { useAskedRead } from '@openheaders/ui/workbench/components/panels/git/use-asked-read';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function held(): { read: () => Promise<void>; answer: () => void } {
  let answer: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    answer = resolve;
  });
  return { read: () => promise, answer };
}

describe('useAskedRead', () => {
  it('is at rest until the person asks', () => {
    const read = vi.fn(() => Promise.resolve());
    const hook = renderHook(() => useAskedRead(read));
    expect(hook.result.current.asked).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it('holds from the press until the read answers', async () => {
    const first = held();
    const hook = renderHook(() => useAskedRead(first.read));
    act(() => hook.result.current.ask());
    expect(hook.result.current.asked).toBe(true);
    await act(async () => {
      first.answer();
      await first.read();
    });
    expect(hook.result.current.asked).toBe(false);
  });

  it('holds across two presses until the last read answers', async () => {
    const reads = [held(), held()];
    let next = 0;
    const read = (): Promise<void> => {
      const mine = reads[next];
      next += 1;
      return mine.read();
    };
    const hook = renderHook(() => useAskedRead(read));
    act(() => hook.result.current.ask());
    act(() => hook.result.current.ask());
    await act(async () => {
      reads[0].answer();
      await reads[0].read();
    });
    expect(hook.result.current.asked).toBe(true);
    await act(async () => {
      reads[1].answer();
      await reads[1].read();
    });
    expect(hook.result.current.asked).toBe(false);
  });
});
