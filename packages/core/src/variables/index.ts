export type {
  ParseResult,
  ReservedNamespace,
  ScopeNamespace,
  StepRefParts,
  VariableNamespace,
  VariableReference,
} from './namespaces';
export {
  describeNamespace,
  isVariableNamespace,
  parseReference,
  parseStepRefName,
  RESERVED_NAMESPACES,
  SCOPE_NAMESPACES,
} from './namespaces';
export type {
  LiveRegistry,
  ResolutionEnvSnapshot,
  ResolutionError,
  ResolutionErrorReason,
  ResolvedLiveValue,
  ScopedLookupFn,
  ScopedResolution,
  StepCaptureContext,
  TemplateVariable,
} from './resolver';
export { EMPTY_LIVE_REGISTRY, resolveTemplate, resolveVariable, VariableResolver } from './resolver';
export type { RuleResolution } from './rule-resolver';
export { resolveRule, resolveRules, resolveRuleWithDiagnostics } from './rule-resolver';
export type { SystemVariable } from './system-variables';
export { SYSTEM_VARIABLES } from './system-variables';
