/**
 * Generic merge-editor — Phase 1 surface.
 *
 * Outer shell + Column 3-pane / 2-pane fallback only. Hunk arrows,
 * layout switcher, file list, bulk ops, multi-file shell, and the
 * resolution-state-machine wiring land in subsequent phases per
 * the merge-conflict-editor plan §10.
 *
 * Lift-readiness rules (bake-off doc §3.7):
 *   - This subtree imports only from `@openheaders/core` + npm
 *     packages. Shell-specific concerns belong in adapters.
 *   - Adapters absorb the entity / import / git domain shape and
 *     produce a `MergeSession`.
 *   - Future shared-UI package extraction lifts this directory
 *     unchanged.
 */

export type { MergeConflictModalProps } from './components/MergeConflictModal';
export { default as MergeConflictModal } from './components/MergeConflictModal';
export type { MergeFileListProps, MergeFileRowState, MergeFileStatus } from './components/MergeFileList';
export { default as MergeFileList } from './components/MergeFileList';
export type { HunkStats, MergeLayout, MergePaneHandle, MergePaneProps } from './components/MergePane';
export { default as MergePane } from './components/MergePane';
export type {
  DecorationKind,
  FindPathRegion,
  HunkSide,
  MergePaneEvents,
  MergePaneOps,
  ParseError,
  Range,
  TablePickChoice,
} from './renderer-interface';
export type {
  MergeApplyOutcome,
  MergeApplyStatus,
  MergeBadge,
  MergeFile,
  MergeFileKind,
  MergeSession,
} from './types';
export { usePersistedLayout } from './use-persisted-layout';
