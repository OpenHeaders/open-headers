/**
 * Pure transport-boundary org filter (the unified-oracle model §6.1 +
 * §8.2). The state-vector reader, delta-stream reader, and snapshot
 * builder compose this over their per-workspace mutation log scan so
 * envelopes whose `orgId` is not in the host's authorized Org set are
 * dropped before they reach a wire or a peer-visible projection.
 *
 * Two flavors mirror the existing `filterEnvelopesAgainstPeer{,Async}`:
 * the sync generator is for tests and in-memory composition; the async
 * generator is for the IDB / SQLite cursor pipelines.
 *
 * The authorized set comes from `authorizedOrgIds(snapshot)` in
 * `@openheaders/core/identity`. An empty set deny-alls — that's the
 * pre-bootstrap / null-snapshot case from §6.5.3 step 4 (new team
 * peers must see snapshot-bootstrap, never history-replay of envelopes
 * stamped with an Org they aren't authorized for).
 */

import type { MutationEnvelope } from './types';

export function* filterEnvelopesByOrg(
  envelopes: Iterable<MutationEnvelope>,
  authorized: ReadonlySet<string>,
): Generator<MutationEnvelope> {
  for (const env of envelopes) {
    if (authorized.has(env.orgId)) yield env;
  }
}

export async function* filterEnvelopesByOrgAsync(
  envelopes: AsyncIterable<MutationEnvelope>,
  authorized: ReadonlySet<string>,
): AsyncGenerator<MutationEnvelope> {
  for await (const env of envelopes) {
    if (authorized.has(env.orgId)) yield env;
  }
}
