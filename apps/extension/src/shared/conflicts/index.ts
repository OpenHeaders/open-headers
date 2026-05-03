/**
 * Entity-agnostic conflict-resolution surfaces shared across editors.
 *
 * Per-entity tracker hooks (`useRuleConflicts` today; `useRequestConflicts`,
 * `useTemplateConflicts`, … as they migrate) project their schema into a
 * `Record<path, string>` baseline + lookup; everything UI-side reads
 * through these primitives.
 */

export type { ConflictBridge, ConflictRemoteInfo, PathConflict } from './types';
export { default as EntityConflictBanner } from './EntityConflictBanner';
export type { EntityConflictBannerProps } from './EntityConflictBanner';
export { default as EntityConflictDialog } from './EntityConflictDialog';
export type { EntityConflictDialogProps, ConflictResolution } from './EntityConflictDialog';
