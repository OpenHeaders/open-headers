export { computeStateVectorFromLog, readWorkspaceStateVector } from './state-vector-reader';
export { readDeltaStreamFromLog, readWorkspaceDeltaStream } from './delta-stream-reader';
export {
  __resetMutationStreamBridgeForTests,
  __seenMutationStreamCountForTests,
  applyInboundMutationBatch,
  applyInboundMutationEnvelope,
  hasRecentlyApplied,
} from './mutation-stream-bridge';
export { buildSnapshotForWorkspace, buildSnapshotFromOracle } from './snapshot-builder';
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
