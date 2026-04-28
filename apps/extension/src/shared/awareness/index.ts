/**
 * Shared awareness primitives — used by every renderer surface that
 * publishes or consumes Phase A presence signals (workbench RuleEditor,
 * popup, devpanel hover popover).
 */

export { default as PresenceBadge } from './PresenceBadge';
export type { PresenceBadgeProps } from './PresenceBadge';
export { default as FieldPresenceChip } from './FieldPresenceChip';
export type { FieldPresenceChipProps } from './FieldPresenceChip';
export { default as ConflictDiffChip } from './ConflictDiffChip';
export type { ConflictDiffChipProps } from './ConflictDiffChip';
export { useEntityPresence, useFieldPresence } from './use-entity-presence';
export { RULE_FIELD } from './rule-paths';
export { surfaceColor, surfaceInitial, surfaceLabel } from './surface-label';
