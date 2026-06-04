import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePanelUiState } from '@openheaders/ui/panel/data/use-panel-ui-state';

describe('usePanelUiState', () => {
  it('defaults preserveLog=true + recording=true', () => {
    const { result } = renderHook(() => usePanelUiState({ resettables: [] }));
    expect(result.current.preserveLog).toBe(true);
    expect(result.current.recording).toBe(true);
  });

  it('honors defaults', () => {
    const { result } = renderHook(() =>
      usePanelUiState({ resettables: [], defaultPreserveLog: false, defaultRecording: false }),
    );
    expect(result.current.preserveLog).toBe(false);
    expect(result.current.recording).toBe(false);
  });

  it('setPreserveLog + setRecording update state', () => {
    const { result } = renderHook(() => usePanelUiState({ resettables: [] }));
    act(() => result.current.setPreserveLog(false));
    expect(result.current.preserveLog).toBe(false);
    act(() => result.current.setRecording(false));
    expect(result.current.recording).toBe(false);
  });

  it('clear() invokes every registered resettable in order', () => {
    const seen: string[] = [];
    const a = { clear: () => seen.push('a') };
    const b = { clear: () => seen.push('b') };
    const { result } = renderHook(() => usePanelUiState({ resettables: [a, b] }));
    act(() => result.current.clear());
    expect(seen).toEqual(['a', 'b']);
  });

  it('clear() swallows a resettable throwing so siblings still fire', () => {
    const bad = {
      clear: () => {
        throw new Error('boom');
      },
    };
    const after = { clear: vi.fn() };
    const { result } = renderHook(() => usePanelUiState({ resettables: [bad, after] }));
    expect(() => act(() => result.current.clear())).not.toThrow();
    expect(after.clear).toHaveBeenCalledTimes(1);
  });

  it('clearFloorMs starts at -1 and advances to now() on each clear', () => {
    let t = 5000;
    const { result } = renderHook(() => usePanelUiState({ resettables: [], now: () => t }));
    expect(result.current.clearFloorMs).toBe(-1);
    act(() => result.current.clear());
    expect(result.current.clearFloorMs).toBe(5000);
    t = 9000;
    act(() => result.current.clear());
    expect(result.current.clearFloorMs).toBe(9000);
  });

  it('clear() identity is stable across renders even when resettables list changes', () => {
    const a = { clear: vi.fn() };
    const b = { clear: vi.fn() };
    const { result, rerender } = renderHook(
      ({ list }: { list: { clear: () => void }[] }) => usePanelUiState({ resettables: list }),
      { initialProps: { list: [a] } },
    );
    const firstClear = result.current.clear;
    rerender({ list: [a, b] });
    expect(result.current.clear).toBe(firstClear);
    act(() => result.current.clear());
    expect(a.clear).toHaveBeenCalledTimes(1);
    expect(b.clear).toHaveBeenCalledTimes(1);
  });
});
