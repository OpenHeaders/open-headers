import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SNAPSHOT_THRESHOLDS,
  shouldBootstrapWithSnapshot,
  type SnapshotThresholds,
  type StateVector,
} from '../../../src/sync';

const populatedPeer: StateVector = { sw: { physicalMs: 100, logical: 0, nodeId: 'sw' } };

describe('shouldBootstrapWithSnapshot', () => {
  it('returns true for a cold peer with at least one missing envelope', () => {
    expect(
      shouldBootstrapWithSnapshot({ peerVector: {}, estimatedDeltaCount: 1 }),
    ).toBe(true);
  });

  it('returns false for a cold peer with zero deltas (nothing to send)', () => {
    expect(
      shouldBootstrapWithSnapshot({ peerVector: {}, estimatedDeltaCount: 0 }),
    ).toBe(false);
  });

  it('streams deltas below the count threshold for a warm peer', () => {
    expect(
      shouldBootstrapWithSnapshot({ peerVector: populatedPeer, estimatedDeltaCount: 999 }),
    ).toBe(false);
  });

  it('snapshots once the warm peer exceeds the count threshold', () => {
    expect(
      shouldBootstrapWithSnapshot({ peerVector: populatedPeer, estimatedDeltaCount: 1001 }),
    ).toBe(true);
  });

  it('honors a configured byte ceiling when provided', () => {
    const thresholds: SnapshotThresholds = { maxDeltaCount: 100_000, maxDeltaBytes: 50_000 };
    expect(
      shouldBootstrapWithSnapshot(
        { peerVector: populatedPeer, estimatedDeltaCount: 100, estimatedDeltaBytes: 49_999 },
        thresholds,
      ),
    ).toBe(false);
    expect(
      shouldBootstrapWithSnapshot(
        { peerVector: populatedPeer, estimatedDeltaCount: 100, estimatedDeltaBytes: 50_001 },
        thresholds,
      ),
    ).toBe(true);
  });

  it('ignores the byte ceiling when default thresholds are used (count-only)', () => {
    expect(DEFAULT_SNAPSHOT_THRESHOLDS.maxDeltaBytes).toBeNull();
    expect(
      shouldBootstrapWithSnapshot({
        peerVector: populatedPeer,
        estimatedDeltaCount: 5,
        estimatedDeltaBytes: 10_000_000,
      }),
    ).toBe(false);
  });
});
