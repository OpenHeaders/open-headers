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
export { effectiveDependsOn, runChain } from './chain-runner';
export type { CircuitSnapshot, CircuitState } from './circuit-breaker';
export {
  BACKOFF_MULTIPLIER,
  BASE_TIMEOUT_MS,
  CONSECUTIVE_OPENINGS_DECAY_MS,
  canAttempt,
  computeBackoffMs,
  computePreBreakerDelayMs,
  FAILURE_THRESHOLD,
  HALF_OPEN_MAX_ATTEMPTS,
  initialCircuitSnapshot,
  MAX_TIMEOUT_MS,
  markManualBypass,
  onCircuitFailure,
  onCircuitSuccess,
  PRE_BREAKER_BASE_MS,
  PRE_BREAKER_JITTER_MS,
  resetCircuit,
  TIMEOUT_JITTER,
  transitionOpenToHalfOpen,
} from './circuit-breaker';
export type { CycleEdge, CycleReport, RequestTemplateProvider as CycleRequestTemplateProvider } from './cycle-detect';
export { detectCycles } from './cycle-detect';
export type { DraftCapture, DraftStep, DraftWorkflow, LvCreateOp, LvReconcilePlan, LvUpdateOp } from './editor-draft';
export {
  draftFromWorkflow,
  newDraftCapture,
  pickPrimaryLv,
  planLiveVariableReconcile,
  stripDraftSteps,
  toDraftCapture,
} from './editor-draft';
export type { ExtractorFailureKind, ExtractorResult, StepResponse, StepResponseHeader } from './extractor';
export { applyExtractor } from './extractor';
export { evaluateClause, evaluateGate, matchStatus } from './gate-evaluator';
export type { PriorityValue } from './priority-evaluator';
export { comparePriority, PRIORITY_LAST, priorityValue } from './priority-evaluator';
export type { CacheSummary } from './refresh-cadence';
export { computeNextFireAt, DEFAULT_REFRESH_LEAD_MS, MAX_BACKOFF_SECONDS, MIN_ALARM_DELAY_MS } from './refresh-cadence';
export { collectRequestTemplateStrings, requestExecutableFingerprint } from './request-scan';
export type { RequestInfoProvider, StepRequestInfo, StructuralError, StructuralIssue } from './step-validation';
export {
  computeTransitiveAncestors,
  validateStepReferences,
  validateStepRequestsExist,
  validateWorkflowShape,
} from './step-validation';
export type { StepRef, TemplateScanResult } from './template-scan';
export { scanTemplateReferences, scanTemplateReferencesMany } from './template-scan';
export type { VariableFingerprint, VariableScopeSnapshot } from './variable-scan';
export { workflowVariableFingerprint } from './variable-scan';
export { isLiveVariableDraft, isLiveVariableEffective } from './variable-state';
export { workflowDefinitionFingerprint } from './workflow-scan';
export {
  isWorkflowComplete,
  isWorkflowDraft,
  isWorkflowEffective,
  workflowStepsResolvable,
} from './workflow-state';
