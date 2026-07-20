/**
 * StatusCache — the §9 status authority discipline: movement
 * invalidates, readers share one in-flight compute and snapshot the
 * cached frame; a compute detached by mid-flight invalidation answers
 * its awaiters but never seeds the cache.
 */

import { describe, expect, it, vi } from 'vitest';
import { StatusCache } from '../../src/workspace-tree/status-cache';

interface Frame {
  branch: string;
}

describe('StatusCache', () => {
  it('computes once and snapshots for every later read', async () => {
    const cache = new StatusCache<Frame>();
    const compute = vi.fn(async () => ({ branch: 'main' }));
    expect(await cache.read(compute)).toEqual({ branch: 'main' });
    expect(await cache.read(compute)).toEqual({ branch: 'main' });
    expect(await cache.read(compute)).toEqual({ branch: 'main' });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight compute across concurrent readers', async () => {
    const cache = new StatusCache<Frame>();
    let resolveCompute!: (frame: Frame) => void;
    const compute = vi.fn(
      () =>
        new Promise<Frame>((resolve) => {
          resolveCompute = resolve;
        }),
    );
    const first = cache.read(compute);
    const second = cache.read(compute);
    resolveCompute({ branch: 'main' });
    expect(await first).toEqual({ branch: 'main' });
    expect(await second).toEqual({ branch: 'main' });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('recomputes after invalidation', async () => {
    const cache = new StatusCache<Frame>();
    let branch = 'main';
    const compute = vi.fn(async () => ({ branch }));
    expect(await cache.read(compute)).toEqual({ branch: 'main' });
    branch = 'feature';
    cache.invalidate();
    expect(await cache.read(compute)).toEqual({ branch: 'feature' });
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('a compute detached by mid-flight invalidation answers its awaiters but never seeds the cache', async () => {
    const cache = new StatusCache<Frame>();
    let resolveStale!: (frame: Frame) => void;
    const staleCompute = () =>
      new Promise<Frame>((resolve) => {
        resolveStale = resolve;
      });
    const staleRead = cache.read(staleCompute);
    cache.invalidate();
    resolveStale({ branch: 'pre-movement' });
    expect(await staleRead).toEqual({ branch: 'pre-movement' });

    const freshCompute = vi.fn(async () => ({ branch: 'post-movement' }));
    expect(await cache.read(freshCompute)).toEqual({ branch: 'post-movement' });
    expect(freshCompute).toHaveBeenCalledTimes(1);
    // The fresh frame is snapshotted; the stale one never was.
    expect(await cache.read(freshCompute)).toEqual({ branch: 'post-movement' });
    expect(freshCompute).toHaveBeenCalledTimes(1);
  });

  it('a failed compute propagates and the next read retries', async () => {
    const cache = new StatusCache<Frame>();
    const failing = vi.fn(async (): Promise<Frame> => {
      throw new Error('porcelain exploded');
    });
    await expect(cache.read(failing)).rejects.toThrow('porcelain exploded');
    const recovered = vi.fn(async () => ({ branch: 'main' }));
    expect(await cache.read(recovered)).toEqual({ branch: 'main' });
    expect(recovered).toHaveBeenCalledTimes(1);
  });
});
