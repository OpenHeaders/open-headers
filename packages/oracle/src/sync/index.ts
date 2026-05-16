export {
  InMemoryActivityLog,
  type ActivityLog,
  type ActivityLogListOptions,
} from './activity-log';
export { computeStateVectorFromLog, readWorkspaceStateVector } from './state-vector-reader';
export { readDeltaStreamFromLog, readWorkspaceDeltaStream } from './delta-stream-reader';
export {
  __resetMutationStreamBridgeForTests,
  __seenMutationStreamCountForTests,
  applyInboundMutationBatch,
  applyInboundMutationEnvelope,
  hasRecentlyApplied,
} from './mutation-stream-bridge';

export {
  DEFAULT_REMOTE_ID,
  InMemoryPendingOutQueue,
  type PendingOutQueue,
} from './pending-out-queue';
export { IdbPendingOutQueue, __closeIdbPendingOutQueueForTests } from './idb-pending-out-queue';
export { SqlitePendingOutQueue, ensurePendingOutQueueSchema } from './sqlite-pending-out-queue';
export { prunePendingOutByPeerVector, type PrunePendingOutResult } from './pending-out-prune';
export { buildSnapshotForWorkspace, buildSnapshotFromOracle } from './snapshot-builder';
export {
  respondToStateVector,
  type HandshakeReply,
  type RespondToStateVectorOptions,
  type RespondToStateVectorResult,
} from './handshake-responder';
export { applyWorkspaceSnapshot } from './snapshot-applier';
export type { ApplySnapshotOptions, ApplySnapshotResult } from './snapshot-applier';
export {
  computeSnapshotThresholdInputsForWorkspace,
  computeSnapshotThresholdInputsFromLog,
} from './snapshot-threshold-reader';
export type { ComputeSnapshotThresholdInputsOptions } from './snapshot-threshold-reader';

export {
  getOracleHostHooks,
  peekActiveWorkspaceId,
  requireActiveWorkspaceId,
  setOracleHostHooks,
  type OracleAwarenessBroadcast,
  type OracleHostHooks,
  type OracleStatusReport,
  type OracleSyncBroadcastEvent,
} from './host-hooks';
