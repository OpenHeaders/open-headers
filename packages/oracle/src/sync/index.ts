export { computeStateVectorFromLog, readWorkspaceStateVector } from './state-vector-reader';
export { readDeltaStreamFromLog, readWorkspaceDeltaStream } from './delta-stream-reader';
export { buildSnapshotForWorkspace, buildSnapshotFromOracle } from './snapshot-builder';

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
