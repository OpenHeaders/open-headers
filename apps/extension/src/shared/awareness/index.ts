/**
 * Shared awareness primitives — used by every renderer surface that
 * publishes or consumes presence signals (workbench RuleEditor, popup,
 * devpanel hover popover).
 */

export { default as PresenceBadge } from './PresenceBadge';
export type { PresenceBadgeProps } from './PresenceBadge';
export { default as FieldPresenceChip } from './FieldPresenceChip';
export type { FieldPresenceChipProps } from './FieldPresenceChip';
export { default as TabPresenceBadge } from './TabPresenceBadge';
export type { TabPresenceBadgeProps } from './TabPresenceBadge';
export { default as AwarenessPill } from './AwarenessPill';
export type { AwarenessPillProps } from './AwarenessPill';
export { default as ConflictDiffChip } from './ConflictDiffChip';
export type { ConflictDiffChipProps } from './ConflictDiffChip';
export { useEntityPresence, useFieldPresence, usePathPrefixPresence } from './use-entity-presence';
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
export { EntityScopeProvider, useEntityScope } from './EntityScope';
export type { EntityScopeValue } from './EntityScope';
export {
  ActiveFieldFocusProvider,
  useActiveFieldFocus,
  useSetActiveFieldFocus,
} from './ActiveFieldFocus';
export type { ActiveFieldFocusValue } from './ActiveFieldFocus';
export { ActiveTabEntityProvider, useActiveTabEntity, useSetActiveTabEntity } from './ActiveTabEntity';
export type { ActiveTabEntityValue } from './ActiveTabEntity';
export {
  ActiveEditorDirtyProvider,
  useActiveEditorDirty,
  useSetActiveEditorDirty,
} from './ActiveEditorDirty';
export type { ActiveEditorDirtyValue } from './ActiveEditorDirty';
export { useEditorDirty } from './use-editor-dirty';
export { EntityField } from './EntityField';
export type { EntityFieldProps } from './EntityField';
export { SurfaceAwarenessPublisher } from './SurfaceAwarenessPublisher';
export type { SurfaceAwarenessPublisherProps } from './SurfaceAwarenessPublisher';
