/**
 * Diagram barrel — keeps the import shape `from './diagrams'` working
 * for sections.tsx while letting each diagram live in its own file.
 *
 * As we redo each section, the diagram(s) for that section move from
 * `_pending.tsx` into a dedicated per-section file (e.g.
 * `header-actions.tsx`) and the export gets relocated here.
 */

export { ActionsRuleAnatomyDiagram, ActionsTaxonomyDiagram } from './actions';
export { BlockDiagram, BlockUseCasesDiagram, BlockWontApplyDiagram } from './block';
export {
  BodyDynamicDiagram,
  BodyGraphqlDiagram,
  BodyInterceptDiagram,
  BodyStaticDiagram,
  BodyUseCasesDiagram,
  BodyWontApplyDiagram,
} from './body';
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
export {
  DelayNavDiagram,
  DelayRoutingDiagram,
  DelayUseCasesDiagram,
  DelayWontApplyDiagram,
  DelayXhrDiagram,
} from './delay';
export { DirectVsIndirectDiagram } from './direct-vs-indirect';
export { ExecutionDnrReachDiagram, ExecutionScriptReachDiagram, ExecutionStackDiagram } from './execution';
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
  InjectCssDiagram,
  InjectScriptDiagram,
  InjectTimingDiagram,
  InjectUseCasesDiagram,
  InjectWontApplyDiagram,
} from './inject';
export { KeyboardRegionsDiagram } from './keyboard-shortcuts';
export { LimitationsOverviewDiagram } from './limitations';
export {
  MockDynamicDiagram,
  MockFlowDiagram,
  MockStaticDiagram,
  MockUseCasesDiagram,
  MockWontApplyDiagram,
} from './mock';
export {
  MultiTabLocalDiagram,
  MultiTabNavigationDiagram,
  MultiTabNumberingDiagram,
  MultiTabSyncDiagram,
  MultiTabSyncedDiagram,
} from './multi-tab';
export {
  ComparisonMatrixDiagram,
  ComparisonVsCloudDiagram,
  ComparisonVsHeaderOnlyDiagram,
  ComparisonVsProxyDiagram,
  ParadigmApiCatalogDiagram,
  ParadigmConvergenceDiagram,
  ParadigmFieldSyncDiagram,
  ParadigmFrontEndsDiagram,
  ParadigmLocalFirstDiagram,
  ParadigmRuleEngineDiagram,
  ParadigmShiftDiagram,
  RoadmapCliDiagram,
  RoadmapDaemonDiagram,
  RoadmapDesktopAppDiagram,
  RoadmapGitWorkspacesDiagram,
  RoadmapImportersDiagram,
  RoadmapMcpArchitectureDiagram,
  RoadmapMcpToolsDiagram,
  RoadmapMilestonesDiagram,
  RoadmapWebAppDiagram,
} from './open-headers';
export {
  QueryParamAddReplaceDiagram,
  QueryParamRemoveAllDiagram,
  QueryParamRemoveDiagram,
  QueryParamReplaceOnlyDiagram,
  QueryParamUseCasesDiagram,
  QueryParamWontApplyDiagram,
} from './query-params';
export {
  RedirectRegexDiagram,
  RedirectStaticDiagram,
  RedirectUseCasesDiagram,
  RedirectWontApplyDiagram,
} from './redirect';
export {
  RequestTrackingDiagram,
  RequestTrackingPhasesDiagram,
  RequestTrackingUiDiagram,
} from './request-tracking';
export { RESOURCE_TYPE_ICONS, ResourceTypesAnatomyDiagram } from './resource-types';
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
