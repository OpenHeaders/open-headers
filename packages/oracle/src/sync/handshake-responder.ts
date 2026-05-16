/**
 * State-vector handshake responder — Yjs-style catch-up over a single
 * peer connection.
 *
 * Triggered by an inbound `oh.sync.stateVector` frame. Decides whether
 * the cheapest catch-up is a snapshot bootstrap or a delta stream
 * against the peer's vector ({@link shouldBootstrapWithSnapshot}, C6),
 * streams the chosen shape via the caller-supplied
 * {@link HandshakeReply.send}, and terminates with `oh.sync.synced`
 * carrying the sender's vector as the receiver's new watermark.
 *
 * **Pure of transport.** The responder doesn't know it's a WS, an IPC
 * channel, or an in-memory test harness — only that `reply.send`
 * accepts one frame at a time and returns `false` when the underlying
 * transport has gone away. Streaming loops MUST honor that signal and
 * stop iterating; the workspace service refcount around the reads
 * makes a partial drain safe (the next handshake re-walks the log).
 *
 * **Sensitivity (Phase D seam).** `options.redactSensitive` strips
 * vault + oauth-bundle arrays from the snapshot before send for
 * cross-trust-zone transports per `docs/DATA_PLANE_TOPOLOGIES.md §11.1`.
 * Phase C localhost is same-user same-process — defaults to off.
 *
 * **What this does NOT do:**
 *   - validate the inbound message (the caller already did, against
 *     {@link SyncStateVectorMessageSchema})
 *   - send WELCOME / receive HELLO — that's the handshake dispatcher's
 *     job; this responder only handles the catch-up phase
 *   - dedup envelopes against the peer's seen-set — the peer's wire
 *     vector already accounts for what they have, and C11's
 *     `mutationId` dedup catches any residual overlap (snapshot +
 *     delta share an envelope, reconnect replays the same mutation,
 *     etc.)
 *   - update peer-side pending-out — the *initiator* side of the
 *     handshake fires `applyPeerStateVectorToPendingOut` on inbound
 *     SYNCED; this responder is the responding peer
 */
import {
  SYNC_MUTATION_TYPE,
  SYNC_SNAPSHOT_TYPE,
  SYNC_SYNCED_TYPE,
  redactSensitiveSnapshotKeys,
  type SyncMutationMessage,
  type SyncSnapshotMessage,
  type SyncStateVectorMessage,
  type SyncSyncedMessage,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import {
  DEFAULT_SNAPSHOT_THRESHOLDS,
  shouldBootstrapWithSnapshot,
  type SnapshotThresholds,
} from '@openheaders/core/sync';

import { readWorkspaceDeltaStream } from './delta-stream-reader';
import { buildSnapshotForWorkspace } from './snapshot-builder';
import { computeSnapshotThresholdInputsForWorkspace } from './snapshot-threshold-reader';
import { readWorkspaceStateVector } from './state-vector-reader';

/**
 * Output sink for handshake frames. Implementations wrap whatever
 * underlying transport the host owns — a WebSocket for ws-server, an
 * in-memory buffer for tests, an IPC channel for an Electron host
 * that hairpins through main. `send` returns false when the transport
 * is closed; the responder stops streaming on the first false.
 */
export interface HandshakeReply {
  send(frame: SyncSnapshotMessage | SyncMutationMessage | SyncSyncedMessage): boolean;
}

export interface RespondToStateVectorOptions {
  /**
   * Strip vault + oauth-bundle arrays from the snapshot before send
   * (cross-trust-zone transports). Defaults to `false` — Phase C
   * localhost is same-user same-process.
   */
  readonly redactSensitive?: boolean;
  /**
   * Override the snapshot-vs-delta threshold. Defaults to
   * {@link DEFAULT_SNAPSHOT_THRESHOLDS}. Test seam + future per-peer
   * tuning (large-history daemon → mobile client may want a tighter
   * count to favor snapshot delivery).
   */
  readonly thresholds?: SnapshotThresholds;
}

export interface RespondToStateVectorResult {
  /** True if a snapshot frame led the response. */
  readonly sentSnapshot: boolean;
  /** Number of delta envelopes streamed. */
  readonly deltasSent: number;
  /** Whether the closing SYNCED frame made it onto the wire. */
  readonly syncedSent: boolean;
  /** Sender's state vector at the close of the catch-up window. */
  readonly stateVectorAfter: SyncSyncedMessage['stateVectorAfter'];
}

export async function respondToStateVector(
  message: SyncStateVectorMessage,
  reply: HandshakeReply,
  options: RespondToStateVectorOptions = {},
): Promise<RespondToStateVectorResult> {
  const workspaceId = message.workspaceId;
  const peerVector = message.perNodeMaxHlc;
  const thresholds = options.thresholds ?? DEFAULT_SNAPSHOT_THRESHOLDS;

  const inputs = await computeSnapshotThresholdInputsForWorkspace(workspaceId, peerVector);
  const useSnapshot = shouldBootstrapWithSnapshot(inputs, thresholds);

  let deltasSent = 0;
  let resumeFromVector = peerVector;

  if (useSnapshot) {
    let snapshot: WorkspaceSnapshot = await buildSnapshotForWorkspace(workspaceId);
    if (options.redactSensitive) snapshot = redactSensitiveSnapshotKeys(snapshot);
    const snapshotFrame: SyncSnapshotMessage = {
      type: SYNC_SNAPSHOT_TYPE,
      workspaceId,
      snapshot,
    };
    if (!reply.send(snapshotFrame)) {
      return { sentSnapshot: true, deltasSent: 0, syncedSent: false, stateVectorAfter: snapshot.takenAtHlc };
    }
    resumeFromVector = snapshot.takenAtHlc;
  }

  for await (const envelope of readWorkspaceDeltaStream(workspaceId, resumeFromVector)) {
    const frame: SyncMutationMessage = {
      type: SYNC_MUTATION_TYPE,
      workspaceId,
      envelope,
    };
    if (!reply.send(frame)) {
      const partialVector = await readWorkspaceStateVector(workspaceId);
      return { sentSnapshot: useSnapshot, deltasSent, syncedSent: false, stateVectorAfter: partialVector };
    }
    deltasSent++;
  }

  const stateVectorAfter = await readWorkspaceStateVector(workspaceId);
  const syncedFrame: SyncSyncedMessage = {
    type: SYNC_SYNCED_TYPE,
    workspaceId,
    stateVectorAfter,
  };
  const syncedSent = reply.send(syncedFrame);
  return { sentSnapshot: useSnapshot, deltasSent, syncedSent, stateVectorAfter };
}
