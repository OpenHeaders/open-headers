/**
 * Per-node HLC sequencer for the harness. Every issuance from a given
 * node advances strictly — the same guarantee real {@link advanceHlc}
 * provides. Two distinct events at one node never produce equal HLCs.
 *
 * The harness occasionally needs equal-physical-different-node ties
 * to exercise the nodeId tiebreak — those use {@link issueAt}.
 */

import type { HLC } from '../../../src/sync';
import { advanceHlc, initialHlc } from '../../../src/sync';

export class HlcSequencer {
  private last = new Map<string, HLC>();

  /** Advance node `nodeId` past `now` and return a fresh HLC. */
  next(nodeId: string, now: number): HLC {
    const prev = this.last.get(nodeId) ?? initialHlc(nodeId, now - 1);
    const fresh = advanceHlc(prev, now);
    this.last.set(nodeId, fresh);
    return fresh;
  }

  /**
   * Issue HLCs at the same physical tick on different nodes — used
   * by the same-field-same-hlc generator to exercise the nodeId
   * tiebreak in compareHlc.
   */
  issueAt(physicalMs: number, logical: number, nodeId: string): HLC {
    const prev = this.last.get(nodeId);
    let fresh: HLC = { physicalMs, logical, nodeId };
    if (prev && (prev.physicalMs > physicalMs || (prev.physicalMs === physicalMs && prev.logical >= logical))) {
      fresh = advanceHlc(prev, physicalMs);
    }
    this.last.set(nodeId, fresh);
    return fresh;
  }
}
