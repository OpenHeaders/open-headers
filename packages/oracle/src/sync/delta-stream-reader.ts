/**
 * Delta-stream reader for the host's mutation log.
 *
 * Walks the workspace's append-only mutation log and yields the
 * envelopes the given peer is missing — the data the handshake's
 * STATE_VECTOR exchange tells us to send. The yield is an async
 * generator so the WS sender can stream envelopes one at a time
 * without materializing the whole delta in memory, matching the
 * unbounded-history shape of the log.
 *
 * Two entry points:
 *
 * - {@link readDeltaStreamFromLog} — takes a {@link MutationLog}
 *   directly. Used by tests and callers that already hold a service
 *   handle.
 * - {@link readWorkspaceDeltaStream} — host-facing convenience that
 *   acquires the per-workspace service, hydrates, streams, and
 *   releases when the consumer either finishes the iteration or
 *   aborts it (the `try { ... } finally { ... }` around the yield
 *   loop covers `break` and thrown exceptions).
 *
 * Two filters compose at the transport boundary:
 *
 * 1. {@link filterEnvelopesByOrgAsync} drops envelopes whose `orgId`
 *    is not in the host's authorized Org set (UNIFIED_ORACLE_MODEL.md
 *    §6.1, §8.2). Cross-org envelopes that happen to live in the same
 *    workspace's log — historical envelopes stamped with the
 *    workspace's pre-flip `orgId`, per §6.5.3 — never reach the wire.
 * 2. {@link filterEnvelopesAgainstPeerAsync} drops envelopes the peer
 *    has already observed per its `StateVector`.
 *
 * The org filter runs first so the cheap "is this envelope mine to
 * send at all" predicate gates the more expensive HLC comparison.
 * Pre-bootstrap / null identity snapshot → empty authorized set →
 * empty stream (matches §6.5.3 step 4: new team peers see snapshot-
 * bootstrap, not history-replay).
 */
import { authorizedOrgIds, getIdentitySnapshot } from '@openheaders/core/identity';
import {
  filterEnvelopesAgainstPeerAsync,
  filterEnvelopesByOrgAsync,
  type MutationEnvelope,
  type StateVector,
} from '@openheaders/core/sync';

import type { MutationLog } from './mutation-log';
import { acquireScopeLog } from './scope-log-accessor';

export async function* readDeltaStreamFromLog(
  log: MutationLog,
  peer: StateVector,
): AsyncGenerator<MutationEnvelope> {
  const authorized = authorizedOrgIds(getIdentitySnapshot());
  yield* filterEnvelopesAgainstPeerAsync(
    filterEnvelopesByOrgAsync(log.readSince(null), authorized),
    peer,
  );
}

export async function* readWorkspaceDeltaStream(
  workspaceId: string,
  peer: StateVector,
): AsyncGenerator<MutationEnvelope> {
  const handle = acquireScopeLog(workspaceId);
  try {
    await handle.hydrated;
    yield* readDeltaStreamFromLog(handle.log, peer);
  } finally {
    handle.release();
  }
}
