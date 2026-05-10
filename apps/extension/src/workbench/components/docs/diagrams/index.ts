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
  HeaderOpsDiagram,
  InjectTimingDiagram,
  MockFlowDiagram,
} from './_pending';
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
  PermissionsAuditFlowDiagram,
  PermissionsImpactDiagram,
  RequestExecutorOutcomesDiagram,
  RequestExecutorScopeDiagram,
  RulesCapacityDiagram,
  RulesPipelineDiagram,
  SyncLifecycleDiagram,
  SyncTopologyDiagram,
  SystemStatusPopoverDiagram,
  SystemStatusSurfacesDiagram,
  SystemStatusWorstLevelDiagram,
} from './system-status';
