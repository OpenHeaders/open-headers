export type {
  CombinedWorkspace,
  CombineFailureReason,
  CombineResult,
} from './combine-types';
export { isPresenceEmpty, summarizeWorkspaces } from './data-presence';
export { decideModeSwitch } from './decide';
export type {
  DiscardBackupArchive,
  DiscardBackupWorkspace,
  DiscardedWorkspace,
  DiscardFailureReason,
  DiscardResult,
} from './discard-types';
export type {
  PublishedWorkspace,
  PublishFailureReason,
  PublishResult,
} from './publish-types';
export type {
  RestoredWorkspace,
  RestoreFailureReason,
  RestoreResult,
} from './restore-types';
export { isDiscardBackupArchiveShape } from './restore-types';
export type {
  DataPresenceSummary,
  EntityCounts,
  ModeSwitchInput,
  ModeSwitchVerdict,
  WorkspaceContentSnapshot,
} from './types';
