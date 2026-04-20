/**
 * `@openheaders/core/live` — platform-agnostic building blocks for
 * Live Variables + Live Workflows.
 *
 * Everything here is pure: no `fetch`, no DOM, no extension APIs.
 * The extension + future desktop each build thin adapters on top.
 */

export type {
  ChainExecutionContext,
  ChainRunFailure,
  ChainRunOutcome,
  ChainRunSuccess,
  FetchAdapter,
} from './chain-runner';
export { runChain } from './chain-runner';
export type { CycleEdge, CycleReport, RequestTemplateProvider as CycleRequestTemplateProvider } from './cycle-detect';
export { detectCycles } from './cycle-detect';
export type { ExtractorFailureKind, ExtractorResult, StepResponse, StepResponseHeader } from './extractor';
export { applyExtractor } from './extractor';
export type { CacheSummary } from './refresh-cadence';
export { computeNextFireAt, DEFAULT_REFRESH_LEAD_MS, MAX_BACKOFF_SECONDS, MIN_ALARM_DELAY_MS } from './refresh-cadence';
export type { RequestTemplateProvider, StructuralError, StructuralIssue } from './step-validation';
export { validateStepReferences, validateWorkflowShape } from './step-validation';
export type { StepRef, TemplateScanResult } from './template-scan';
export { scanTemplateReferences, scanTemplateReferencesMany } from './template-scan';
