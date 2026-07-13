/**
 * `useResolvedFrames` — identity stability of the returned map.
 *
 * The map is held in render contexts whose identity gates row-level memo
 * (TrafficList's cellContext), so it must be referentially stable across
 * re-renders that change neither the frames nor the source-map cache — a
 * fresh map per render re-renders every mounted traffic row on every
 * scroll tick. A resolving fetch must still produce a NEW map so
 * consumers pick up the resolved positions.
 */

import type { CallFrameLike } from '@openheaders/ui/panel/data/initiator/call-frame-meta';
import {
  __resetSourceMapCacheForTests,
  setSourceMapFetcher,
} from '@openheaders/ui/panel/data/initiator/source-map-cache';
import {
  frameKey,
  type ResolvedFramePosition,
  useResolvedFrames,
} from '@openheaders/ui/panel/data/initiator/use-resolved-frames';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const JS_URL = 'https://openheaders.io/assets/bundle.js';

// Generated line 1, col 2 → app.ts line 1 col 2, name "handleClick"
// (same fixture shape as panel-source-map.test.ts).
const MAP_JSON = JSON.stringify({
  version: 3,
  sources: ['app.ts'],
  names: ['handleClick'],
  mappings: 'AAAA;AACA,EAAEA',
});

const FRAMES: readonly CallFrameLike[] = [{ url: JS_URL, lineNumber: 1, columnNumber: 2 }];

let results: ReadonlyMap<string, ResolvedFramePosition>[];

function Probe({ frames }: { frames: readonly CallFrameLike[] }) {
  results.push(useResolvedFrames(frames));
  return null;
}

beforeEach(() => {
  results = [];
  __resetSourceMapCacheForTests();
});

afterEach(() => {
  setSourceMapFetcher(null);
  __resetSourceMapCacheForTests();
});

describe('useResolvedFrames — map identity', () => {
  it('returns the same map across re-renders with unchanged frames and cache', async () => {
    setSourceMapFetcher(() => Promise.resolve(null));
    const { rerender } = render(<Probe frames={FRAMES} />);
    // Let the (null) fetch settle so the cache is quiescent.
    await act(async () => {});

    const settled = results[results.length - 1];
    rerender(<Probe frames={FRAMES} />);
    rerender(<Probe frames={FRAMES} />);

    expect(results[results.length - 1]).toBe(settled);
    expect(results[results.length - 2]).toBe(settled);
  });

  it('produces a new map with the resolved position when a fetch settles', async () => {
    let release: (text: string) => void = () => {};
    setSourceMapFetcher(() => new Promise((resolve) => (release = resolve)));

    render(<Probe frames={FRAMES} />);
    const pending = results[results.length - 1];
    expect(pending.size).toBe(0);

    await act(async () => release(MAP_JSON));

    const resolved = results[results.length - 1];
    expect(resolved).not.toBe(pending);
    const pos = resolved.get(frameKey(FRAMES[0]));
    expect(pos?.name).toBe('handleClick');
    expect(pos?.source).toBe('app.ts');
  });
});
