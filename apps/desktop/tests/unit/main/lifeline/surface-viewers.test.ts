import { describe, expect, it } from 'vitest';
import { createSurfaceViewers } from '@/main/lifeline/surface-viewers';

const SURFACE = 1;
const OTHER_SURFACE = 2;

/** Record what a promise does without awaiting it. */
function watch(promise: Promise<void>): { settled: boolean } {
  const state = { settled: false };
  void promise.then(() => {
    state.settled = true;
  });
  return state;
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('surface viewers', () => {
  it('counts a surface nobody spoke for as a viewer', async () => {
    const viewers = createSurfaceViewers();

    expect(viewers.isViewer(SURFACE)).toBe(true);
    await expect(viewers.whenViewer(SURFACE)).resolves.toBeUndefined();
  });

  it('stops counting a surface whose window closed, and only that one', () => {
    const viewers = createSurfaceViewers();

    viewers.set(SURFACE, false);

    expect(viewers.isViewer(SURFACE)).toBe(false);
    expect(viewers.isViewer(OTHER_SURFACE)).toBe(true);
  });

  it('releases what waits on a closed surface when its window opens', async () => {
    const viewers = createSurfaceViewers();
    viewers.set(SURFACE, false);
    const waiting = watch(viewers.whenViewer(SURFACE));
    await settle();
    expect(waiting.settled).toBe(false);

    viewers.set(SURFACE, true);
    await settle();

    expect(waiting.settled).toBe(true);
    expect(viewers.isViewer(SURFACE)).toBe(true);
  });

  it('releases the waiters in the order they started waiting', async () => {
    const viewers = createSurfaceViewers();
    viewers.set(SURFACE, false);
    const order: number[] = [];
    for (const n of [1, 2, 3]) void viewers.whenViewer(SURFACE).then(() => order.push(n));

    viewers.set(SURFACE, true);
    await settle();

    expect(order).toEqual([1, 2, 3]);
  });

  it('releases what waits on a surface that went away', async () => {
    const viewers = createSurfaceViewers();
    viewers.set(SURFACE, false);
    const waiting = watch(viewers.whenViewer(SURFACE));

    viewers.forget(SURFACE);
    await settle();

    expect(waiting.settled).toBe(true);
    expect(viewers.isViewer(SURFACE)).toBe(true);
  });

  it('announces a surface leaving once per closing', () => {
    const viewers = createSurfaceViewers();
    const left: number[] = [];
    viewers.onLeft((wcId) => left.push(wcId));

    viewers.set(SURFACE, false);
    viewers.set(SURFACE, false);
    viewers.set(SURFACE, true);
    viewers.set(SURFACE, true);
    viewers.set(SURFACE, false);

    expect(left).toEqual([SURFACE, SURFACE]);
  });

  it('stops announcing to a handler that unsubscribed', () => {
    const viewers = createSurfaceViewers();
    const left: number[] = [];
    const unsubscribe = viewers.onLeft((wcId) => left.push(wcId));

    unsubscribe();
    viewers.set(SURFACE, false);

    expect(left).toEqual([]);
  });
});
