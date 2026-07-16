/**
 * VariableResolver — centralized {{VAR}} resolution across the 4-scope chain.
 *
 * Resolution priority (highest → lowest):
 *   1. Vault (per-user secrets, never synced)
 *   2. Active environment (switchable: dev/staging/prod)
 *   3. Default environment (falls back here when active misses — ARCHITECTURE §5)
 *   4. Collection (scoped to a collection, synced)
 *   5. Workspace (workspace-wide, synced)
 *
 * This is pure domain logic — no I/O, no framework deps.
 * Both the main process and renderer use this.
 */

export {
  buildPostResolveError,
  type ResolutionEnvSnapshot,
  type ResolutionError,
  type ResolutionErrorParams,
  type ResolutionErrorReason,
  type ScopedResolution,
} from './errors';
export {
  type DeferredVaultMode,
  EMPTY_LIVE_REGISTRY,
  EMPTY_TOTP_REGISTRY,
  type LiveRegistry,
  type ResolvedLiveValue,
  type StepCaptureContext,
  type TotpRegistry,
} from './registries';
export { resolveTemplate, resolveVariable, type ScopedLookupFn, type TemplateVariable } from './template';
export { VariableResolver } from './variable-resolver';
