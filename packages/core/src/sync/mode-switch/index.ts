export type {
  CoexistFailureReason,
  CoexistImportedWorkspace,
  CoexistPayload,
  CoexistResult,
  CoexistSourceWorkspace,
} from './coexist-types';
export type {
  ImportConflictRow,
  ImportFailureReason,
  ImportIgnoredWorkspace,
  ImportMergedWorkspace,
  ImportPayload,
  ImportResult,
  ImportSourceWorkspace,
} from './import-types';
export type {
  DiscardBackupArchive,
  DiscardBackupWorkspace,
  DiscardFailureReason,
  DiscardResult,
  DiscardedWorkspace,
} from './discard-types';
export { isPresenceEmpty, summarizeWorkspaces } from './data-presence';
export { decideModeSwitch } from './decide';
export type {
  DataPresenceSummary,
  EntityCounts,
  ModeSwitchInput,
  ModeSwitchVerdict,
  WorkspaceContentSnapshot,
} from './types';
