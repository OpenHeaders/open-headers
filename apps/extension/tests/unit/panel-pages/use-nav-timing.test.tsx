/**
 * useNavTiming — derives a flat `InspectorNavTiming` from the latest
 * page in a `PageClientSnapshot`. Pure projection; quick sanity tests
 * over the four shapes the status bar branches on.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PageClientSnapshot } from '@openheaders/ui/panel/data/page-client-store';
import { useNavTiming } from '@openheaders/ui/panel/data/use-nav-timing';

function snapshot(pages: PageClientSnapshot['pages']): PageClientSnapshot {
  return { pages };
}

describe('useNavTiming', () => {
  it('returns null when no pages exist', () => {
    const { result } = renderHook(() => useNavTiming(snapshot([])));
    expect(result.current).toBeNull();
  });

  it('returns null when latest page has no url + no timing', () => {
    const { result } = renderHook(() =>
      useNavTiming(snapshot([{ id: 'page_1', startedAtMs: 1, url: null }])),
    );
    expect(result.current).toBeNull();
  });

  it('projects pageOrigin + dclMs + loadMs from the latest page', () => {
    const { result } = renderHook(() =>
      useNavTiming(
        snapshot([
          { id: 'page_1', startedAtMs: 1, url: 'https://openheaders.io', dclMs: 30, loadMs: 90 },
        ]),
      ),
    );
    expect(result.current).toEqual({
      pageOrigin: 'https://openheaders.io',
      dclMs: 30,
      loadMs: 90,
    });
  });

  it('omits undefined timing fields rather than emitting them', () => {
    const { result } = renderHook(() =>
      useNavTiming(snapshot([{ id: 'page_1', startedAtMs: 1, url: 'https://openheaders.io' }])),
    );
    expect(result.current).toEqual({ pageOrigin: 'https://openheaders.io' });
  });

  it('selects the most-recent page when multiple exist', () => {
    const { result } = renderHook(() =>
      useNavTiming(
        snapshot([
          { id: 'page_1', startedAtMs: 1, url: 'https://openheaders.io/old', dclMs: 5 },
          { id: 'page_2', startedAtMs: 10, url: 'https://openheaders.io/new', dclMs: 25 },
        ]),
      ),
    );
    expect(result.current).toEqual({ pageOrigin: 'https://openheaders.io/new', dclMs: 25 });
  });
});
