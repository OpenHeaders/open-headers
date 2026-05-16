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
 */
import { filterEnvelopesAgainstPeerAsync, type MutationEnvelope, type StateVector } from '@openheaders/core/sync';

import type { MutationLog } from './mutation-log';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from './service';

export async function* readDeltaStreamFromLog(
  log: MutationLog,
  peer: StateVector,
): AsyncGenerator<MutationEnvelope> {
  yield* filterEnvelopesAgainstPeerAsync(log.readSince(null), peer);
}

export async function* readWorkspaceDeltaStream(
  workspaceId: string,
  peer: StateVector,
): AsyncGenerator<MutationEnvelope> {
  const svc = getOrCreateWorkspaceService(workspaceId);
  try {
    await svc.hydrated;
    yield* readDeltaStreamFromLog(svc.log, peer);
  } finally {
    releaseWorkspaceService(workspaceId);
  }
}
