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
export { __closeIdbActivityLogForTests, IdbActivityLog } from './idb-activity-log';
export { __closeIdbActivityMuteStoreForTests, IdbActivityMuteStore } from './idb-activity-mute-store';
export { __closeIdbAuditLogForTests, IdbAuditLog } from './idb-audit-log';
export { __closeIdbPendingOutQueueForTests, IdbPendingOutQueue } from './idb-pending-out-queue';
export {
  type ApplyRestoreDeps,
  applyDiscardRestoreArchive,
  type BackupWriter,
  type CollectDiscardArchiveInput,
  type CollectLocalDataPresenceInput,
  collectDiscardArchive,
  collectLocalDataPresence,
  type DataPresenceOracle,
  enumerateSnapshotEntities,
  getBackupWriter,
  type OrchestrateDiscardDeps,
  type OrchestratePublishDeps,
  type OrchestrateUseTargetDeps,
  orchestrateDiscardWithBackup,
  orchestratePublish,
  orchestrateUseTarget,
  type PublishWorkspaceInput,
  type RestoreTargetMinter,
  setBackupWriter,
  USER_CONTENT_ENTITY_TYPES,
  type UseTargetWorkspaceInput,
} from './mode-switch';
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
export { ensureActivityLogSchema, SqliteActivityLog } from './sqlite-activity-log';
export { ensureActivityMuteSchema, SqliteActivityMuteStore } from './sqlite-activity-mute-store';
export { ensurePendingOutQueueSchema, SqlitePendingOutQueue } from './sqlite-pending-out-queue';
export { computeStateVectorFromLog, readWorkspaceStateVector } from './state-vector-reader';
