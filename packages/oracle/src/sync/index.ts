export {
  type ClassifyActivityInput,
  classifyEnvelopeForActivity,
} from './activity-classifier';
export { makeOracleInverseAccess, type OracleInverseAccessInput } from './activity-inverse-builder';
export {
  type ActivityLog,
  type ActivityLogListOptions,
  InMemoryActivityLog,
} from './activity-log';
export {
  __resetActivityMuteCacheForTests,
  type ActivityMuteChange,
  ensureMutesLoaded,
  isMutedForActivityFeed,
  listMutedActivityEntities,
  muteActivityEntity,
  setActivityMuteClockForTests,
  setActivityMuteStore,
  subscribeActivityMuteChanges,
  unmuteActivityEntity,
} from './activity-mute-cache';
export {
  type ActivityMuteStore,
  InMemoryActivityMuteStore,
} from './activity-mute-store';
export {
  __activityPriorsSizeForTests,
  __resetActivityPriorsForTests,
  consumePriorForMutation,
  type PriorCapture,
  rememberPriorForMutation,
} from './activity-priors';
export {
  ACTIVITY_PRUNE_DEFAULT_PERIOD_MS,
  ACTIVITY_PRUNE_DEFAULT_RETENTION_MS,
  type ActivityPruneSweepResult,
  type ActivityPruneWorkspaceResult,
  type RunActivityPruneSweepInput,
  runActivityPruneSweep,
} from './activity-prune-scheduler';
export {
  type GenerateInverseInput,
  type GenerateInverseReason,
  type GenerateInverseResult,
  generateInverseMutation,
} from './activity-revert';
export {
  type AuditLog,
  type AuditLogAppendInput,
  type AuditLogListOptions,
  InMemoryAuditLog,
} from './audit-log';
export type { ApplyInboundAwarenessFrameDeps } from './awareness-inbound';
export { applyInboundAwarenessFrame } from './awareness-inbound';
export { readDeltaStreamFromLog, readWorkspaceDeltaStream } from './delta-stream-reader';
export {
  type HandshakeReply,
  type RespondToStateVectorOptions,
  type RespondToStateVectorResult,
  respondToStateVector,
} from './handshake-responder';
export {
  getOracleHostHooks,
  type OracleAwarenessBroadcast,
  type OracleHostHooks,
  type OracleStatusReport,
  type OracleSyncBroadcastEvent,
  peekActiveWorkspaceId,
  requireActiveWorkspaceId,
  setOracleHostHooks,
} from './host-hooks';
// Browser-coupled IDB-backed durable stores live in
// `@openheaders/oracle-host-browser/sync/idb-*` so this barrel stays
// host-neutral.
// See `docs/ORACLE_HOST_NEUTRALITY_AUDIT.md` §F-1.P.1.
export {
  __resetMutationStreamBridgeForTests,
  __seenMutationStreamCountForTests,
  applyInboundMutationBatch,
  applyInboundMutationEnvelope,
  hasRecentlyApplied,
} from './mutation-stream-bridge';
export {
  __resetOutboundGateForTests,
  evaluateOutboundEnvelope,
  type OutboundDropLayer,
  type OutboundVerdict,
  setOutboundEchoGuard,
  setOutboundReachGuard,
} from './outbound-gate';
export { type PrunePendingOutResult, prunePendingOutByPeerVector } from './pending-out-prune';
export {
  DEFAULT_REMOTE_ID,
  InMemoryPendingOutQueue,
  type PendingOutQueue,
} from './pending-out-queue';
export {
  getAwarenessStoreForWorkspace,
  getOracleForWorkspace,
  snapshotAwarenessPresence,
} from './service';
export type { ApplySnapshotOptions, ApplySnapshotResult } from './snapshot-applier';
export { applyWorkspaceSnapshot } from './snapshot-applier';
export { buildSnapshotForWorkspace, buildSnapshotFromOracle } from './snapshot-builder';
export type { ComputeSnapshotThresholdInputsOptions } from './snapshot-threshold-reader';
export {
  computeSnapshotThresholdInputsForWorkspace,
  computeSnapshotThresholdInputsFromLog,
} from './snapshot-threshold-reader';
// Node-coupled SQLite-backed durable stores live in
// `@openheaders/oracle-host-node/sync/sqlite-*` so this barrel — and
// oracle as a whole — stays host-neutral.
export { computeStateVectorFromLog, readWorkspaceStateVector } from './state-vector-reader';
