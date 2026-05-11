/**
 * Diagram barrel — keeps the import shape `from './diagrams'` working
 * for sections.tsx while letting each diagram live in its own file.
 *
 * As we redo each section, the diagram(s) for that section move from
 * `_pending.tsx` into a dedicated per-section file (e.g.
 * `header-actions.tsx`) and the export gets relocated here.
 */

export {
  BodyInterceptDiagram,
  DelayRoutingDiagram,
  InjectTimingDiagram,
  MockFlowDiagram,
} from './_pending';
export { BlockDiagram, BlockWontApplyDiagram } from './block';
export {
  AppendDiagram,
  AppendWontApplyDiagram,
  HeaderOpsDiagram,
  MergeDiagram,
  MergeWontApplyDiagram,
  OverrideDiagram,
  OverrideWontApplyDiagram,
  RemoveDiagram,
  RemoveWontApplyDiagram,
} from './header-actions';
export {
  MultiTabLocalDiagram,
  MultiTabNavigationDiagram,
  MultiTabNumberingDiagram,
  MultiTabSyncDiagram,
  MultiTabSyncedDiagram,
} from './multi-tab';
export {
  ConditionsHostVsOriginDiagram,
  ConditionsMatchingDiagram,
  ConditionsRuleFiresDiagram,
  DomainTypeDiagram,
  ExcludeDomainsDiagram,
  HeadersConditionDiagram,
  InitiatorDomainsDiagram,
  MethodsDiagram,
  RequestDomainsDiagram,
  ResourceTypesDiagram,
  UrlPatternDiagram,
  UrlRegexDiagram,
} from './conditions';
export { DirectVsIndirectDiagram } from './direct-vs-indirect';
export { ExecutionDnrReachDiagram, ExecutionScriptReachDiagram, ExecutionStackDiagram } from './execution';
export {
  RequestTrackingDiagram,
  RequestTrackingPhasesDiagram,
  RequestTrackingUiDiagram,
} from './request-tracking';
export {
  LivePillAggregationDiagram,
  LiveWorkflowFreshnessDiagram,
  PermissionsAuditFlowDiagram,
  PermissionsImpactDiagram,
  RequestExecutorOutcomesDiagram,
  RequestExecutorScopeDiagram,
  RulesCapacityDiagram,
  RulesPipelineDiagram,
  SyncLifecycleDiagram,
  SyncTopologyDiagram,
  SystemStatusPopoverDiagram,
  SystemStatusPopupSurfaceDiagram,
  SystemStatusWorkbenchSurfaceDiagram,
  SystemStatusWorstLevelDiagram,
  VaultDriftDetailDiagram,
  VaultHydrationDiagram,
} from './system-status';
