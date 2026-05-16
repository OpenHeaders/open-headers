/**
 * Delta-stream computation — given a local stream of envelopes and a
 * peer's {@link StateVector}, enumerate the envelopes the peer is
 * missing.
 *
 * The math is per-`nodeId`: an envelope with `hlc = (p, l, nodeId)`
 * is missing on the peer iff `hlc > peer.vector[nodeId]` under the
 * total HLC ordering (where "peer has no entry for that nodeId"
 * counts as `-∞`).
 *
 * Two flavors:
 *
 * - {@link filterEnvelopesAgainstPeer} — synchronous, takes an
 *   iterable. For in-memory tests and the InMemoryMutationLog.
 * - {@link filterEnvelopesAgainstPeerAsync} — async generator over
 *   an `AsyncIterable<MutationEnvelope>`. Matches the
 *   {@link MutationLog.readSince} shape so a host can pipe its
 *   IDB/SQLite cursor through without materializing the whole log.
 *
 * Both make a single pass over the input. The single-pass filter is
 * faster than "for each behind node, scan log filtered by nodeId"
 * because IDB cursors are sequential anyway — re-walking once per
 * node pays the cursor open cost N times. The trade-off is reading
 * envelopes the peer has caught up on; for handshake-rate calls the
 * tail of post-peer-cutoff history dominates anyway.
 */
import { hlcToString } from '../hlc';
import type { MutationEnvelope } from '../envelope';
import type { StateVector } from './types';

export function* filterEnvelopesAgainstPeer(
  envelopes: Iterable<MutationEnvelope>,
  peer: StateVector,
): Generator<MutationEnvelope> {
  for (const env of envelopes) {
    if (peerIsBehindFor(env, peer)) yield env;
  }
}

export async function* filterEnvelopesAgainstPeerAsync(
  envelopes: AsyncIterable<MutationEnvelope>,
  peer: StateVector,
): AsyncGenerator<MutationEnvelope> {
  for await (const env of envelopes) {
    if (peerIsBehindFor(env, peer)) yield env;
  }
}

function peerIsBehindFor(env: MutationEnvelope, peer: StateVector): boolean {
  const seen = peer[env.hlc.nodeId];
  if (!seen) return true;
  return hlcToString(env.hlc) > hlcToString(seen);
}
