/**
 * System Status diagrams — split by subsystem so each file stays small.
 *
 *   surfaces.tsx    — where the status pill renders (Workbench, Popup,
 *                     WorstLevel rollup, Popover layout).
 *   sync.tsx        — Sync subsystem (topology + lifecycle).
 *   rules.tsx       — Rules subsystem (pipeline + capacity).
 *   requests.tsx    — Request executor (outcomes + scope).
 *   permissions.tsx — Permissions (impact + audit flow).
 *   vault.tsx       — Vault (hydration + drift).
 *   live.tsx        — Live runners (workflow freshness + pill aggregation).
 *
 * Theme tokens, the SUBSYSTEMS canonical order, OhLogo and BrowserFrame
 * live in `_shared.tsx` and are imported by individual subsystem files.
 */

export {
  SystemStatusPopoverDiagram,
  SystemStatusPopupSurfaceDiagram,
  SystemStatusWorkbenchSurfaceDiagram,
  SystemStatusWorstLevelDiagram,
} from './surfaces';
export { SyncLifecycleDiagram, SyncTopologyDiagram } from './sync';
export { RulesCapacityDiagram, RulesPipelineDiagram } from './rules';
export { RequestExecutorOutcomesDiagram, RequestExecutorScopeDiagram } from './requests';
export { PermissionsAuditFlowDiagram, PermissionsImpactDiagram } from './permissions';
export { VaultDriftDetailDiagram, VaultHydrationDiagram } from './vault';
export { LivePillAggregationDiagram, LiveWorkflowFreshnessDiagram } from './live';
