export type {
  ParseResult,
  ReservedNamespace,
  ScopeNamespace,
  VariableNamespace,
  VariableReference,
} from './namespaces';
export {
  describeNamespace,
  isVariableNamespace,
  parseReference,
  RESERVED_NAMESPACES,
  SCOPE_NAMESPACES,
} from './namespaces';
export type {
  ResolutionEnvSnapshot,
  ResolutionError,
  ResolutionErrorReason,
  TemplateVariable,
} from './resolver';
export { resolveTemplate, resolveVariable, VariableResolver } from './resolver';
export { resolveRule, resolveRules } from './rule-resolver';
export type { SystemVariable } from './system-variables';
export { SYSTEM_VARIABLES } from './system-variables';
