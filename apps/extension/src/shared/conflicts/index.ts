/**
 * Entity-agnostic conflict-resolution surfaces shared across editors.
 *
 * The conflict stack splits along the editor / entity axis:
 *
 *   - **Editor / UI surfaces** — entity-agnostic. `EntityConflictBanner`,
 *     `EntityConflictDialog`, key-codec helpers, `prettyPathMap`,
 *     `useEntityConflicts` factory.
 *   - **Entity projection + resolution** — per-entity adapters. Each
 *     entity provides a `ConflictTrackingAdapter<E>` (read side) and a
 *     `ConflictResolveAdapter<E>` (write side). Pure data; consumed by
 *     the generic factory + UI helpers.
 *
 * Adding a new entity = define both adapters + a thin `useXConflicts`
 * shim binding them to `useEntityConflicts`. No infrastructure change.
 */

export type { ConflictBridge, ConflictRemoteInfo, PathConflict, PathConflictKind } from './types';
export { default as EntityConflictBanner, hasDialogOnlyConflict } from './EntityConflictBanner';
export type { EntityConflictBannerProps } from './EntityConflictBanner';
export { default as EntityConflictDialog } from './EntityConflictDialog';
export type { EntityConflictDialogProps, ConflictResolution } from './EntityConflictDialog';
export { default as ScalarConflictChip } from './ScalarConflictChip';
export type { ScalarConflictChipProps } from './ScalarConflictChip';
export {
  decodeReorderConflictKey,
  decodeSetConflictKey,
  isReorderConflictKey,
  isSetConflictKey,
  reorderConflictKey,
  setConflictKey,
} from './conflict-keys';
export {
  prettyPathMap,
  type ConflictResolveAdapter,
  type ConflictTrackingAdapter,
  type PathMap,
  type SetMember,
  type SetMemberSnapshot,
} from './conflict-adapters';
export { useEntityConflicts } from './use-entity-conflicts';
export type { EntityConflictsApi, UseEntityConflictsArgs } from './use-entity-conflicts';
export { useAutoMergeForm } from './use-auto-merge-form';
export type { UseAutoMergeFormArgs } from './use-auto-merge-form';
