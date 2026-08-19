/**
 * `callSnapshotRpc` — the mirror-bootstrap transport's boot-window retry.
 *
 * Pins:
 *   - a ready response resolves immediately, no timer armed
 *   - notReady answers are retried with capped exponential backoff
 *     until the host reports ready; the not-ready frame never escapes
 *   - transport rejections propagate immediately (no retry — they are
 *     structural, not a boot race)
 *   - a host that never becomes ready rejects after the total budget
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: mockCall,
    subscribe: vi.fn(),
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

import { callSnapshotRpc } from '@openheaders/ui/context';

const READY = { entries: [] };
const NOT_READY = { notReady: true };

describe('callSnapshotRpc', () => {
  beforeEach(() => {
    // Fake Date too — the helper's total-budget deadline reads Date.now(),
    // which must advance in lockstep with the faked setTimeout clock.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    mockCall.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately on a ready response', async () => {
    mockCall.mockResolvedValueOnce(READY);
    const resp = await callSnapshotRpc('oh.sync.snapshotRules', { workspaceId: 'ws-1' });
    expect(resp).toBe(READY);
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith('oh.sync.snapshotRules', { workspaceId: 'ws-1' });
  });

  it('retries notReady answers until the host reports ready', async () => {
    mockCall.mockResolvedValueOnce(NOT_READY).mockResolvedValueOnce(NOT_READY).mockResolvedValueOnce(READY);
    const promise = callSnapshotRpc('oh.sync.snapshotRules', { workspaceId: 'ws-1' });
    await vi.advanceTimersByTimeAsync(250); // first backoff
    await vi.advanceTimersByTimeAsync(500); // doubled
    await expect(promise).resolves.toBe(READY);
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it('caps the backoff delay at 2000ms', async () => {
    // 250 + 500 + 1000 + 2000 + 2000: the fifth wait must not exceed the cap.
    for (let i = 0; i < 5; i++) mockCall.mockResolvedValueOnce(NOT_READY);
    mockCall.mockResolvedValueOnce(READY);
    const promise = callSnapshotRpc('oh.sync.snapshotExtensionWorkspaces');
    for (const step of [250, 500, 1000, 2000, 2000]) {
      await vi.advanceTimersByTimeAsync(step);
    }
    await expect(promise).resolves.toBe(READY);
    expect(mockCall).toHaveBeenCalledTimes(6);
  });

  it('propagates a transport rejection without retrying', async () => {
    mockCall.mockRejectedValueOnce(new Error('no handler for this message type'));
    await expect(callSnapshotRpc('oh.sync.snapshotRules', { workspaceId: 'ws-1' })).rejects.toThrow(
      'no handler for this message type',
    );
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('gives up after the 30s budget with a descriptive error', async () => {
    mockCall.mockResolvedValue(NOT_READY);
    const promise = callSnapshotRpc('oh.sync.snapshotRules', { workspaceId: 'ws-1' });
    const assertion = expect(promise).rejects.toThrow('still not ready after 30000ms');
    // The last backoff sleep straddles the 30s deadline; advance far
    // enough for it to fire and the deadline check to reject.
    await vi.advanceTimersByTimeAsync(40_000);
    await assertion;
  });
});
