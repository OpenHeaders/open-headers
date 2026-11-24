/**
 * Oversized-replay holds — which watch a close for frame size names.
 */

import { describe, expect, it } from 'vitest';
import { createOversizedReplayHolds } from '../../../src/daemon/telemetry/oversized-replay-holds';

const PEER = 'ext-1';

describe('createOversizedReplayHolds', () => {
  it('admits every subscribe of a peer that never closed for size', () => {
    const holds = createOversizedReplayHolds();
    expect(holds.admit(PEER, 1)).toBe('send');
    expect(holds.admit(PEER, 2)).toBe('send');
    expect(holds.admit(PEER, 3)).toBe('send');
  });

  it('a close for size with one awaited watch holds that watch', () => {
    const holds = createOversizedReplayHolds();
    holds.admit(PEER, 1);
    expect(holds.peerClosed(PEER, true)).toBe(1);
    expect(holds.isHeld(PEER, 1)).toBe(true);
    expect(holds.admit(PEER, 1)).toBe('held');
  });

  it('a watch that already answered is not the one a later close names', () => {
    const holds = createOversizedReplayHolds();
    holds.admit(PEER, 1);
    holds.admit(PEER, 2);
    holds.answered(PEER, 1);
    expect(holds.peerClosed(PEER, true)).toBe(2);
    expect(holds.isHeld(PEER, 1)).toBe(false);
  });

  it('a close for any other reason holds nothing', () => {
    const holds = createOversizedReplayHolds();
    holds.admit(PEER, 1);
    expect(holds.peerClosed(PEER, false)).toBeNull();
    expect(holds.admit(PEER, 1)).toBe('send');
  });

  it('a close for size with nothing awaited holds nothing', () => {
    const holds = createOversizedReplayHolds();
    holds.admit(PEER, 1);
    holds.answered(PEER, 1);
    expect(holds.peerClosed(PEER, true)).toBeNull();
    expect(holds.admit(PEER, 1)).toBe('send');
  });

  it('several awaited watches make the peer serial, and the next close names one', () => {
    const holds = createOversizedReplayHolds();
    holds.admit(PEER, 1);
    holds.admit(PEER, 2);
    holds.admit(PEER, 3);
    // Three awaited: the close cannot name one.
    expect(holds.peerClosed(PEER, true)).toBeNull();

    // The reconnect asks one at a time.
    expect(holds.admit(PEER, 1)).toBe('send');
    expect(holds.admit(PEER, 2)).toBe('queued');
    expect(holds.admit(PEER, 3)).toBe('queued');
    // Tab 1 answers — tab 2's turn.
    expect(holds.answered(PEER, 1)).toBe(2);
    // Tab 2's replay closes the wire: it alone was awaited.
    expect(holds.peerClosed(PEER, true)).toBe(2);

    // The next reconnect: tab 2 is held, the rest go one at a time.
    expect(holds.admit(PEER, 1)).toBe('send');
    expect(holds.admit(PEER, 2)).toBe('held');
    expect(holds.admit(PEER, 3)).toBe('queued');
    expect(holds.answered(PEER, 1)).toBe(3);
    // The last queued watch answered — the peer is no longer serial.
    expect(holds.answered(PEER, 3)).toBeNull();
    expect(holds.admit(PEER, 4)).toBe('send');
    expect(holds.admit(PEER, 5)).toBe('send');
  });

  it('a queued watch that ends passes its turn on', () => {
    const holds = createOversizedReplayHolds();
    holds.admit(PEER, 1);
    holds.admit(PEER, 2);
    holds.peerClosed(PEER, true);
    holds.admit(PEER, 1);
    holds.admit(PEER, 2);
    holds.admit(PEER, 3);
    // Tab 2 leaves while queued; tab 1 then answers — tab 3 is next.
    expect(holds.ended(PEER, 2)).toBeNull();
    expect(holds.answered(PEER, 1)).toBe(3);
  });

  it('an awaited watch that ends hands the turn to the next queued one', () => {
    const holds = createOversizedReplayHolds();
    holds.admit(PEER, 1);
    holds.admit(PEER, 2);
    holds.peerClosed(PEER, true);
    holds.admit(PEER, 1);
    holds.admit(PEER, 2);
    expect(holds.ended(PEER, 1)).toBe(2);
  });

  it('release frees one held watch; releasePeer forgets the peer', () => {
    const holds = createOversizedReplayHolds();
    holds.admit(PEER, 1);
    holds.peerClosed(PEER, true);
    expect(holds.release(PEER, 2)).toBe(false);
    expect(holds.release(PEER, 1)).toBe(true);
    expect(holds.admit(PEER, 1)).toBe('send');

    holds.peerClosed(PEER, true);
    expect(holds.isHeld(PEER, 1)).toBe(true);
    holds.releasePeer(PEER);
    expect(holds.isHeld(PEER, 1)).toBe(false);
    expect(holds.admit(PEER, 1)).toBe('send');
  });

  it('keeps peers apart', () => {
    const holds = createOversizedReplayHolds();
    holds.admit('ext-1', 1);
    holds.admit('ext-2', 1);
    expect(holds.peerClosed('ext-1', true)).toBe(1);
    expect(holds.isHeld('ext-2', 1)).toBe(false);
  });
});
