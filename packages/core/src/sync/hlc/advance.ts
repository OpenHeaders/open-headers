import type { HLC } from './types';

/**
 * Advance an HLC. Pure — no clock reads, no allocations beyond the
 * returned HLC. Two flavors are folded together via the standard HLC
 * recurrence (Kulkarni et al. 2014 §3):
 *
 *   `local`    — the issuing node's last-known HLC.
 *   `now`      — fresh wall/monotonic reading at the issuing node.
 *   `observed` — optional remote HLC (e.g. inbound mutation envelope).
 *
 * Result invariant: returned HLC is strictly greater than `local` and
 * (if provided) strictly greater than `observed` under {@link compareHlc}.
 */
export function advanceHlc(local: HLC, now: number, observed?: HLC): HLC {
  const observedPhysical = observed?.physicalMs ?? Number.NEGATIVE_INFINITY;
  const observedLogical = observed?.logical ?? 0;
  const physical = Math.max(local.physicalMs, observedPhysical, now);

  let logical: number;
  if (physical === local.physicalMs && physical === observedPhysical) {
    logical = Math.max(local.logical, observedLogical) + 1;
  } else if (physical === local.physicalMs) {
    logical = local.logical + 1;
  } else if (physical === observedPhysical) {
    logical = observedLogical + 1;
  } else {
    logical = 0;
  }

  return { physicalMs: physical, logical, nodeId: local.nodeId };
}

/** Initial HLC for a node, anchored at a given wall reading. */
export function initialHlc(nodeId: string, now: number): HLC {
  return { physicalMs: now, logical: 0, nodeId };
}

/**
 * HLC for the i-th envelope of a batch minted from one context: same
 * wall reading, logical advanced by `steps`. Envelopes in a batch MUST
 * carry strictly increasing HLCs — the mutation log orders by
 * `(hlc, mutationId)`, so equal HLCs collapse a batch's replay order
 * to random mutationId sort and a peer can receive an `addToSet`
 * before its `create`.
 */
export function tickHlc(hlc: HLC, steps: number): HLC {
  if (steps === 0) return hlc;
  return { physicalMs: hlc.physicalMs, logical: hlc.logical + steps, nodeId: hlc.nodeId };
}
