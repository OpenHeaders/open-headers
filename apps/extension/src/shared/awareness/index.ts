/**
 * Shared awareness primitives — used by every renderer surface that
 * publishes or consumes presence signals (workbench RuleEditor, popup,
 * devpanel hover popover).
 */

export { default as PresenceBadge } from './PresenceBadge';
export type { PresenceBadgeProps } from './PresenceBadge';
export { default as FieldPresenceChip } from './FieldPresenceChip';
export type { FieldPresenceChipProps } from './FieldPresenceChip';
export { default as ConflictDiffChip } from './ConflictDiffChip';
export type { ConflictDiffChipProps } from './ConflictDiffChip';
export { useEntityPresence, useFieldPresence } from './use-entity-presence';
export { RULE_FIELD } from './rule-paths';
export { surfaceKindColor, surfaceKindInitial, surfaceKindLabel } from './surface-label';
export {
  resolveDevPanelIdentity,
  resolvePopupIdentity,
  resolveSidePanelIdentity,
  resolveWorkbenchIdentity,
  type SurfaceIdentityHandle,
} from './surface-identity';
export { isHandleCoLocated, isPeerNavigable, peerNavigate } from './peer-navigate';
export { openAwarenessLifeline, type AwarenessLifelineHandle } from './awareness-lifeline';
export { TabActiveProvider, useTabActive } from './TabActiveContext';
export { AwarenessIdentityProvider, useLocalInstanceId, useSurfaceIdentity } from './IdentityContext';
