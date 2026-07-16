/**
 * Shared awareness primitives — used by every renderer surface that
 * publishes or consumes presence signals (workbench RuleEditor, popup,
 * devpanel hover popover).
 */

export type { ActionPathsProviderProps } from './ActionPathsContext';
export { ActionPathsProvider, useActionPaths } from './ActionPathsContext';
export type { ActiveEditorDirtyValue } from './ActiveEditorDirty';
export {
  ActiveEditorDirtyProvider,
  useActiveEditorDirty,
  useSetActiveEditorDirty,
} from './ActiveEditorDirty';
export type { ActiveEditorLifecycleValue } from './ActiveEditorLifecycle';
export {
  ActiveEditorLifecycleProvider,
  useActiveEditorLifecycle,
  useSetActiveEditorLifecycle,
} from './ActiveEditorLifecycle';
export type { ActiveFieldFocusValue } from './ActiveFieldFocus';
export {
  ActiveFieldFocusProvider,
  useActiveFieldFocus,
  useSetActiveFieldFocus,
} from './ActiveFieldFocus';
export type { ActiveTabEntityValue } from './ActiveTabEntity';
export { ActiveTabEntityProvider, useActiveTabEntity, useSetActiveTabEntity } from './ActiveTabEntity';
export type { AwarenessPillProps } from './AwarenessPill';
export { default as AwarenessPill } from './AwarenessPill';
export { type AwarenessLifelineHandle, openAwarenessLifeline } from './awareness-lifeline';
export type { ConflictDiffChipProps } from './ConflictDiffChip';
export { default as ConflictDiffChip } from './ConflictDiffChip';
export type { EntityFieldProps } from './EntityField';
export { EntityField } from './EntityField';
export type { EntityScopeValue } from './EntityScope';
export { EntityScopeProvider, useEntityScope } from './EntityScope';
export type { FieldPresenceChipProps } from './FieldPresenceChip';
export { default as FieldPresenceChip } from './FieldPresenceChip';
export { formatAgo } from './format-ago';
export {
  AwarenessIdentityProvider,
  useLocalInstanceId,
  useOptionalLocalInstanceId,
  useSurfaceIdentity,
} from './IdentityContext';
export { LIVE_VARIABLE_FIELD, LIVE_WORKFLOW_FIELD } from './live-paths';
export type { PresenceBadgeProps } from './PresenceBadge';
export { default as PresenceBadge } from './PresenceBadge';
export { isHandleCoLocated, isPeerNavigable, peerNavigate } from './peer-navigate';
export { REQUEST_PATHS, type RequestPathBundle, type RequestTabKey } from './request-paths';
export {
  type ActionPathBundle,
  type ActionPathsOptions,
  createActionPaths,
  RULE_ACTION_PATHS,
  RULE_FIELD,
  TEMPLATE_ACTION_PATHS,
} from './rule-paths';
export type { SetRowConflictChipProps } from './SetRowConflictChip';
export { default as SetRowConflictChip } from './SetRowConflictChip';
export type { SurfaceAwarenessPublisherProps } from './SurfaceAwarenessPublisher';
export { SurfaceAwarenessPublisher } from './SurfaceAwarenessPublisher';
export type { SurfaceChipProps, SurfaceDotProps } from './SurfaceChip';
export { default as SurfaceChip, SurfaceDot } from './SurfaceChip';
export { SPEC_PATHS, type SpecFileLeaf, type SpecPathBundle, type SpecScalarLeaf } from './spec-paths';
export type { SurfaceIdentityHandle } from './surface-identity';
export { surfaceDisplayLabel, surfaceKindColor, surfaceKindLabel } from './surface-label';
export { TabActiveProvider, useTabActive } from './TabActiveContext';
export type { TabPresenceBadgeProps } from './TabPresenceBadge';
export { default as TabPresenceBadge } from './TabPresenceBadge';
export { useEditorDirty } from './use-editor-dirty';
export { useEditorLifecycle } from './use-editor-lifecycle';
export { useEntityPresence, useFieldPresence, usePathPrefixPresence } from './use-entity-presence';
export { VARIABLE_PATHS, type VariableLeaf, type VariablePathBundle } from './variable-paths';
