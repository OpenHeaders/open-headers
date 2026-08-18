/**
 * Snapshot bootstrap threshold heuristic (Phase C/D §11.1, deliverable C6).
 *
 * Pure decision over "should the sender ship a snapshot blob before
 * the delta stream, or stream deltas alone?" Two factors compose:
 *
 * 1. **Peer freshness** — if `peerVector` is empty the peer is a cold
 *    receiver and a snapshot is always cheaper than re-applying the
 *    full local history.
 * 2. **Delta volume** — if the peer is not fresh but still severely
 *    lagged, a snapshot can still beat the delta stream. The caller
 *    supplies the estimated delta count (and optional byte size); the
 *    heuristic compares against the configured thresholds.
 *
 * The thresholds are policy, not engine math, so they live as a
 * separate input. v1 defaults come from the data-plane topologies design §11.1:
 * `> 1000` mutations OR `> 500ms` estimated replay. Replay-duration
 * estimation requires per-mutator timing data we don't yet collect;
 * the byte-size knob is the v1 stand-in (≈10kB per envelope ⇒ a few
 * hundred kB of deltas ≈ 500ms of replay on a warm engine).
 *
 * Pure: no I/O, no clock, no mutation. The companion helper in
 * oracle (`computeSnapshotThresholdInputs`) walks the log to fill in
 * the estimated delta count.
 */
import type { StateVector } from './types';

export interface SnapshotThresholds {
  /** Stream deltas if count is at or below this; snapshot if above. Default 1000. */
  readonly maxDeltaCount: number;
  /** Optional byte ceiling. `null` to disable. Default `null`. */
  readonly maxDeltaBytes: number | null;
}

export interface SnapshotThresholdInputs {
  /** Peer's advertised state vector. Empty `{}` = fully cold receiver. */
  readonly peerVector: StateVector;
  /** Number of envelopes the delta stream would carry against `peerVector`. */
  readonly estimatedDeltaCount: number;
  /** Optional pre-serialized byte estimate; pair with `maxDeltaBytes`. */
  readonly estimatedDeltaBytes?: number;
}

export const DEFAULT_SNAPSHOT_THRESHOLDS: SnapshotThresholds = {
  maxDeltaCount: 1000,
  maxDeltaBytes: null,
};

export function shouldBootstrapWithSnapshot(
  inputs: SnapshotThresholdInputs,
  thresholds: SnapshotThresholds = DEFAULT_SNAPSHOT_THRESHOLDS,
): boolean {
  // Cold receiver. Always cheaper to ship the snapshot than to make
  // them replay the full history we'd otherwise enumerate.
  if (Object.keys(inputs.peerVector).length === 0 && inputs.estimatedDeltaCount > 0) {
    return true;
  }
  // Severely-lagged warm receiver. Cross the count or byte ceiling
  // ⇒ snapshot wins.
  if (inputs.estimatedDeltaCount > thresholds.maxDeltaCount) return true;
  if (
    thresholds.maxDeltaBytes !== null &&
    inputs.estimatedDeltaBytes !== undefined &&
    inputs.estimatedDeltaBytes > thresholds.maxDeltaBytes
  ) {
    return true;
  }
  return false;
}
