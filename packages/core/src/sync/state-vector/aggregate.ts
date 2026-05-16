/**
 * Pure folder + step functions that build a {@link StateVector} from
 * mutation envelopes.
 *
 * Two entry points cover the two real call sites:
 *
 * - {@link foldStateVector} — bulk fold, used when a fresh peer reads
 *   the whole mutation log on handshake.
 * - {@link advanceStateVector} — streaming step, used when applying
 *   one envelope at a time so the in-memory vector stays current
 *   without rescanning the log.
 *
 * Both are total functions: no I/O, no clock, no allocation beyond the
 * returned object. The result is a new vector each call (no mutation),
 * matching the rest of the sync engine's immutable-fold discipline.
 *
 * Ordering rule: per-`nodeId` we keep the lexicographically-maximum
 * HLC string codec; that's identical to {@link compareHlc}'s ordering
 * because the codec is total-order-preserving by construction.
 * Comparing the codec strings avoids re-running the three-field
 * compare in a hot path.
 */
import { hlcToString, type HLC } from '../hlc';
import type { MutationEnvelope } from '../envelope';
import type { StateVector } from './types';

/** Returns the highest HLC seen per nodeId across the input. */
export function foldStateVector(envelopes: Iterable<MutationEnvelope>): StateVector {
  const out: StateVector = {};
  for (const env of envelopes) advanceStateVectorMut(out, env.hlc);
  return out;
}

/** Returns a new vector with `env`'s HLC merged in. Pure; `prev` is not modified. */
export function advanceStateVector(prev: StateVector, env: MutationEnvelope): StateVector {
  const existing = prev[env.hlc.nodeId];
  if (existing && hlcToString(existing) >= hlcToString(env.hlc)) return prev;
  return { ...prev, [env.hlc.nodeId]: env.hlc };
}

/**
 * Symmetric set-union of two vectors — per-nodeId max wins. Used by
 * the catch-up path: a node merges its own watermark with the peer's
 * `SYNCED` vector so the persisted "what the peer has seen of me"
 * record is current after the handshake completes.
 */
export function mergeStateVectors(a: StateVector, b: StateVector): StateVector {
  const out: StateVector = { ...a };
  for (const nodeId of Object.keys(b)) {
    const peer = b[nodeId];
    if (!peer) continue;
    const ours = out[nodeId];
    if (!ours || hlcToString(peer) > hlcToString(ours)) out[nodeId] = peer;
  }
  return out;
}

/**
 * Returns the set of `nodeId`s for which `peer` is behind `local` —
 * either missing entirely from `peer` or carrying a lower max-HLC.
 * The delta-stream computation (C4) consumes this to enumerate
 * envelopes the peer is missing.
 */
export function diffStateVectors(local: StateVector, peer: StateVector): Array<{ nodeId: string; sinceHlc: HLC | null }> {
  const out: Array<{ nodeId: string; sinceHlc: HLC | null }> = [];
  for (const nodeId of Object.keys(local)) {
    const ours = local[nodeId];
    if (!ours) continue;
    const theirs = peer[nodeId];
    if (!theirs) {
      out.push({ nodeId, sinceHlc: null });
      continue;
    }
    if (hlcToString(theirs) < hlcToString(ours)) {
      out.push({ nodeId, sinceHlc: theirs });
    }
  }
  return out;
}

function advanceStateVectorMut(target: StateVector, candidate: HLC): void {
  const existing = target[candidate.nodeId];
  if (existing && hlcToString(existing) >= hlcToString(candidate)) return;
  target[candidate.nodeId] = candidate;
}
