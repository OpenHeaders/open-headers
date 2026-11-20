/**
 * In-memory `setTimeout` timer adapter — the always-on host's
 * substrate. Covers fire delivery, idempotent re-arm, cancel/clearAll
 * teardown, and the >2^31-1 ms chunking re-arm.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryRefreshTimer, MAX_TIMEOUT_MS } from '../../src/scheduling';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createInMemoryRefreshTimer', () => {
  it('fires the key when its target elapses and forgets it', async () => {
    const fired: string[] = [];
    const timer = createInMemoryRefreshTimer((key) => fired.push(key));
    timer.arm('k1', 1_000);
    await vi.advanceTimersByTimeAsync(999);
    expect(fired).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(fired).toEqual(['k1']);
    expect(await timer.listArmed()).toEqual([]);
  });

  it('re-arming a key replaces its previous target', async () => {
    const fired: string[] = [];
    const timer = createInMemoryRefreshTimer((key) => fired.push(key));
    timer.arm('k1', 1_000);
    timer.arm('k1', 5_000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fired).toEqual([]);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(fired).toEqual(['k1']);
  });

  it('a past target fires on the next tick (clamped to 0 delay)', async () => {
    vi.setSystemTime(10_000);
    const fired: string[] = [];
    const timer = createInMemoryRefreshTimer((key) => fired.push(key));
    timer.arm('k1', 5_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(fired).toEqual(['k1']);
  });

  it('cancel drops the key; clearAll drops everything', async () => {
    const fired: string[] = [];
    const timer = createInMemoryRefreshTimer((key) => fired.push(key));
    timer.arm('k1', 1_000);
    timer.arm('k2', 1_000);
    timer.cancel('k1');
    expect(await timer.listArmed()).toEqual(['k2']);
    timer.clearAll();
    expect(await timer.listArmed()).toEqual([]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fired).toEqual([]);
  });

  it('answers each armed key with the instant it is armed for, and drops it on fire, cancel and clearAll', async () => {
    const timer = createInMemoryRefreshTimer(() => undefined);
    timer.arm('k1', 1_000);
    timer.arm('k2', 4_000);
    timer.arm('k3', 9_000);
    timer.arm('k2', 5_000);
    expect([...timer.armedTargets()]).toEqual([
      ['k1', 1_000],
      ['k2', 5_000],
      ['k3', 9_000],
    ]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect([...timer.armedTargets().keys()]).toEqual(['k2', 'k3']);
    timer.cancel('k2');
    expect([...timer.armedTargets().keys()]).toEqual(['k3']);
    timer.clearAll();
    expect(timer.armedTargets().size).toBe(0);
  });

  it('keeps the far target of a chunked key through its re-arm', async () => {
    const timer = createInMemoryRefreshTimer(() => undefined);
    const target = MAX_TIMEOUT_MS + 60_000;
    timer.arm('k1', target);
    await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_MS);
    expect(timer.armedTargets().get('k1')).toBe(target);
  });

  it('a target beyond the setTimeout horizon chunks and re-arms toward the same instant', async () => {
    const fired: string[] = [];
    const timer = createInMemoryRefreshTimer((key) => fired.push(key));
    const target = MAX_TIMEOUT_MS + 60_000;
    timer.arm('k1', target);
    // First chunk elapses — still armed, not fired.
    await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_MS);
    expect(fired).toEqual([]);
    expect(await timer.listArmed()).toEqual(['k1']);
    // Remainder elapses — fires.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fired).toEqual(['k1']);
  });
});
