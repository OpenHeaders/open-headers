import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistedLayout } from '@openheaders/ui/shared/merge-editor/use-persisted-layout';

describe('usePersistedLayout', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the fallback when storage is empty', () => {
    const { result } = renderHook(() => usePersistedLayout('test-surface', 'column'));
    expect(result.current[0]).toBe('column');
  });

  it('reads a previously persisted value', () => {
    globalThis.localStorage.setItem('oh.merge-editor.layout.test-surface', 'show-base-top');
    const { result } = renderHook(() => usePersistedLayout('test-surface', 'column'));
    expect(result.current[0]).toBe('show-base-top');
  });

  it('rejects an invalid stored value and falls back', () => {
    globalThis.localStorage.setItem('oh.merge-editor.layout.test-surface', 'not-a-real-layout');
    const { result } = renderHook(() => usePersistedLayout('test-surface', 'column'));
    expect(result.current[0]).toBe('column');
  });

  it('writes through on update', () => {
    const { result } = renderHook(() => usePersistedLayout('test-surface', 'column'));
    act(() => result.current[1]('show-base-center'));
    expect(result.current[0]).toBe('show-base-center');
    expect(globalThis.localStorage.getItem('oh.merge-editor.layout.test-surface')).toBe('show-base-center');
  });

  it('namespaces storage by surfaceId', () => {
    globalThis.localStorage.setItem('oh.merge-editor.layout.entity-conflict', 'show-base-top');
    globalThis.localStorage.setItem('oh.merge-editor.layout.import', 'show-base-center');
    const a = renderHook(() => usePersistedLayout('entity-conflict', 'column'));
    const b = renderHook(() => usePersistedLayout('import', 'column'));
    expect(a.result.current[0]).toBe('show-base-top');
    expect(b.result.current[0]).toBe('show-base-center');
  });

  it('uses the default surfaceId when none is supplied', () => {
    globalThis.localStorage.setItem('oh.merge-editor.layout.default', 'show-base-center');
    const { result } = renderHook(() => usePersistedLayout());
    expect(result.current[0]).toBe('show-base-center');
  });

  it('falls back gracefully when localStorage reads throw', () => {
    const original = globalThis.localStorage.getItem.bind(globalThis.localStorage);
    vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation((key) => {
      if (key.startsWith('oh.merge-editor.layout.')) throw new Error('locked storage');
      return original(key);
    });
    const { result } = renderHook(() => usePersistedLayout('test-surface', 'column'));
    expect(result.current[0]).toBe('column');
  });

  it('falls back gracefully when localStorage writes throw (state still updates in-memory)', () => {
    vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const { result } = renderHook(() => usePersistedLayout('test-surface', 'column'));
    act(() => result.current[1]('show-base-top'));
    expect(result.current[0]).toBe('show-base-top');
  });

  it('re-reads storage when surfaceId changes', () => {
    globalThis.localStorage.setItem('oh.merge-editor.layout.surface-a', 'show-base-top');
    globalThis.localStorage.setItem('oh.merge-editor.layout.surface-b', 'show-base-center');
    const { result, rerender } = renderHook(({ id }: { id: string }) => usePersistedLayout(id, 'column'), {
      initialProps: { id: 'surface-a' },
    });
    expect(result.current[0]).toBe('show-base-top');
    rerender({ id: 'surface-b' });
    expect(result.current[0]).toBe('show-base-center');
  });
});
