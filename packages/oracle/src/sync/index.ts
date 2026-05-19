export {
  InMemoryActivityLog,
  type ActivityLog,
  type ActivityLogListOptions,
} from './activity-log';
export { IdbActivityLog, __closeIdbActivityLogForTests } from './idb-activity-log';
export { SqliteActivityLog, ensureActivityLogSchema } from './sqlite-activity-log';
export {
  ACTIVITY_PRUNE_DEFAULT_PERIOD_MS,
  ACTIVITY_PRUNE_DEFAULT_RETENTION_MS,
  runActivityPruneSweep,
  type ActivityPruneSweepResult,
  type ActivityPruneWorkspaceResult,
  type RunActivityPruneSweepInput,
} from './activity-prune-scheduler';
export {
  InMemoryActivityMuteStore,
  type ActivityMuteStore,
} from './activity-mute-store';
export { IdbActivityMuteStore, __closeIdbActivityMuteStoreForTests } from './idb-activity-mute-store';
export { SqliteActivityMuteStore, ensureActivityMuteSchema } from './sqlite-activity-mute-store';
export {
  __resetActivityMuteCacheForTests,
  ensureMutesLoaded,
  isMutedForActivityFeed,
  listMutedActivityEntities,
  muteActivityEntity,
  setActivityMuteClockForTests,
  setActivityMuteStore,
  subscribeActivityMuteChanges,
  unmuteActivityEntity,
  type ActivityMuteChange,
} from './activity-mute-cache';
export {
  classifyEnvelopeForActivity,
  type ClassifyActivityInput,
} from './activity-classifier';
export {
  generateInverseMutation,
  type GenerateInverseInput,
  type GenerateInverseReason,
  type GenerateInverseResult,
} from './activity-revert';
export { makeOracleInverseAccess, type OracleInverseAccessInput } from './activity-inverse-builder';
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
  __activityPriorsSizeForTests,
  __resetActivityPriorsForTests,
  consumePriorForMutation,
  rememberPriorForMutation,
  type PriorCapture,
} from './activity-priors';
export {
  getAwarenessStoreForWorkspace,
  getOracleForWorkspace,
  snapshotAwarenessPresence,
} from './service';
export { applyInboundAwarenessFrame } from './awareness-inbound';
export type { ApplyInboundAwarenessFrameDeps } from './awareness-inbound';

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

export {
  COEXIST_IMPORTED_NAME_SUFFIX,
  USER_CONTENT_ENTITY_TYPES,
  applyCoexistPayload,
  applyDiscardRestoreArchive,
  applyImportPayload,
  collectCoexistPayload,
  collectDiscardArchive,
  collectImportPayload,
  collectLocalDataPresence,
  enumerateSnapshotEntities,
  getBackupWriter,
  getCoexistPeerPusher,
  getImportPeerPusher,
  orchestrateCoexistToPeer,
  orchestrateDiscardWithBackup,
  orchestrateImportToPeer,
  setBackupWriter,
  setCoexistPeerPusher,
  setImportPeerPusher,
  type ApplyCoexistPayloadDeps,
  type ApplyImportPayloadDeps,
  type ApplyRestoreDeps,
  type BackupWriter,
  type CollectCoexistPayloadInput,
  type CollectDiscardArchiveInput,
  type CollectImportPayloadInput,
  type CollectLocalDataPresenceInput,
  type CoexistPeerPusher,
  type CoexistSourceOracle,
  type CoexistTargetMinter,
  type DataPresenceOracle,
  type ImportPeerPusher,
  type ImportSourceOracle,
  type ImportTargetEntityReader,
  type ImportTargetWorkspaceLookup,
  type OrchestrateCoexistDeps,
  type OrchestrateDiscardDeps,
  type OrchestrateImportDeps,
  type RestoreTargetMinter,
} from './mode-switch';
