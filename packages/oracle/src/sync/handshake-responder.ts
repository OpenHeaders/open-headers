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
 * **Reach gate (WS-B B1).** `options.offDevicePeer` strips the vault
 * (same-device-only root secrets) from BOTH the snapshot blob and the
 * delta stream when the receiving peer is off-device (non-loopback), so
 * a reconnecting LAN peer can't bootstrap or replay seed history. The
 * transport sets it from the socket's loopback classification.
 *
 * **Sensitivity (Phase D seam).** `options.redactSensitive` is the
 * broader cross-trust-zone strip — vault + oauth-bundle (+ live values)
 * from the snapshot per `docs/DATA_PLANE_TOPOLOGIES.md §11.1`. Distinct
 * from `offDevicePeer`: that gate is reach-scoped (vault only); this one
 * is trust-zone-scoped (all sensitive entities). Phase C localhost is
 * same-user same-process — defaults to off.
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
  redactHostLocalSnapshotKeys,
  redactSameDeviceOnlySnapshotKeys,
  redactSensitiveSnapshotKeys,
  SYNC_MUTATION_TYPE,
  SYNC_SNAPSHOT_TYPE,
  SYNC_SYNCED_TYPE,
  type SyncMutationMessage,
  type SyncSnapshotMessage,
  type SyncStateVectorMessage,
  type SyncSyncedMessage,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import {
  DEFAULT_SNAPSHOT_THRESHOLDS,
  isHostLocalMutation,
  isSameDeviceOnlyMutation,
  type SnapshotThresholds,
  shouldBootstrapWithSnapshot,
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
   * Peer is off-device (non-loopback). Strips same-device-only secrets
   * (the vault) from both the snapshot blob and the delta stream — the
   * WS-B reach gate (B1). Distinct from {@link redactSensitive}, which
   * is the broader cross-trust-zone strip (vault + OAuth + live values);
   * an off-device peer still bootstraps derived OAuth/live values, only
   * the root-secret vault is withheld. Defaults to `false`.
   */
  readonly offDevicePeer?: boolean;
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
  const wantsSnapshot = shouldBootstrapWithSnapshot(inputs, thresholds);

  let deltasSent = 0;
  let resumeFromVector = peerVector;
  let sentSnapshot = false;

  // Snapshot builder returns `null` when the workspace's `orgId` is
  // outside the host's authorized Org set (UNIFIED_ORACLE_MODEL.md §6.1
  // / §6.5.3 step 4). In that case skip the snapshot frame — the
  // delta-stream reader applies the same org gate and will yield
  // nothing, so the responder falls through to a SYNCED frame with the
  // empty (post-filter) state vector. Cross-org peers see "you're
  // caught up against an empty workspace" instead of any historical
  // data stamped with the foreign Org.
  if (wantsSnapshot) {
    const built = await buildSnapshotForWorkspace(workspaceId);
    if (built !== null) {
      // Host-local UI state (layout) never rides the wire — every peer
      // keeps its own; unconditional, unlike the reach/trust strips.
      let snapshot: WorkspaceSnapshot = redactHostLocalSnapshotKeys(built);
      if (options.redactSensitive) snapshot = redactSensitiveSnapshotKeys(snapshot);
      else if (options.offDevicePeer) snapshot = redactSameDeviceOnlySnapshotKeys(snapshot);
      const snapshotFrame: SyncSnapshotMessage = {
        type: SYNC_SNAPSHOT_TYPE,
        workspaceId,
        snapshot,
      };
      if (!reply.send(snapshotFrame)) {
        return { sentSnapshot: true, deltasSent: 0, syncedSent: false, stateVectorAfter: snapshot.takenAtHlc };
      }
      sentSnapshot = true;
      resumeFromVector = snapshot.takenAtHlc;
    }
  }

  for await (const envelope of readWorkspaceDeltaStream(workspaceId, resumeFromVector)) {
    // Host-local UI state (layout) never rides the wire, any peer.
    if (isHostLocalMutation(envelope)) continue;
    // WS-B reach gate: an off-device peer's catch-up delta must omit
    // same-device-only secrets (vault), matching the snapshot strip above
    // and the live-broadcast gate — otherwise a reconnecting LAN peer
    // pulls seed history through the delta stream.
    if (options.offDevicePeer && isSameDeviceOnlyMutation(envelope)) continue;
    const frame: SyncMutationMessage = {
      type: SYNC_MUTATION_TYPE,
      workspaceId,
      envelope,
    };
    if (!reply.send(frame)) {
      const partialVector = await readWorkspaceStateVector(workspaceId);
      return { sentSnapshot, deltasSent, syncedSent: false, stateVectorAfter: partialVector };
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
  return { sentSnapshot, deltasSent, syncedSent, stateVectorAfter };
}
