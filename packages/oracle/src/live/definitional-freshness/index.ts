/**
 * Definitional-freshness detectors (LF1–LF4) — host-neutral.
 *
 * A live workflow's cached token is a function of four recipe inputs:
 * the request its steps embed (LF1), the variable VALUES that request
 * resolves (LF2), the workflow DEFINITION itself (LF3), and any
 * UPSTREAM live value its request embeds (LF4). When any of those
 * changes, every value the workflow already cached was minted by a
 * recipe that no longer exists — and the resolver keeps serving that
 * wrong-recipe token until the next cadence tick. For env-gated auth
 * that is a hard blocker, not stale-but-fine.
 *
 * Each detector therefore flags the affected `(workflow, env)` cache
 * rows definitionally stale (`computeNextFireAt` then makes each row due
 * now, re-warming even a workflow not runnable at the instant of the
 * edit) and — for a non-manual workflow runnable right now — refreshes
 * the ACTIVE env immediately so the env the user is resolving has no
 * wrong-recipe window. Manual-trigger workflows never auto-run; the flag
 * is their whole treatment.
 *
 * This module owns the detector state (per-workspace fingerprint
 * baselines + debounce timers + the cascade bucket) and its own
 * subscriptions to the host-neutral oracle store events. A host wires it
 * once via {@link startDefinitionalFreshness}, passing the single
 * host-specific seam — `refreshNow`, a gated immediate refresh of one
 * `(workspace, workflow, env)` identity (the extension's sync-warm
 * adapter path / the desktop's gated fire). Both hosts share one
 * definition of "the recipe changed."
 */

export { startDefinitionalFreshness, stopDefinitionalFreshness } from './lifecycle';
export { __resetLiveCascadeBaseline, __setLiveCascadeRefreshDebounceMs } from './live-cascade';
export { __setRequestEditRefreshDebounceMs } from './request-edit';
export type { RefreshNow } from './shared';
export { __setVariableEditRefreshDebounceMs } from './variable-edit';
export { __resetWorkflowDefinitionBaseline } from './workflow-definition';
