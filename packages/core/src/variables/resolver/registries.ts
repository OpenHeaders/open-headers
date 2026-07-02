// ── Live / step scope helpers ──────────────────────────────────────

/**
 * A snapshot of Live Variables currently available to the resolver.
 *
 * Keys are Live Variable names (referenced as `{{live.<name>}}`);
 * values carry the most recent cached extraction. Callers build this
 * once per compile pass from the live-cache-store + live-variable-store;
 * staleness + async-warm rebuild semantics live in the caller, not here.
 *
 * `isSensitive` defaults to `true` in {@link resolveScopedLive} because
 * live values are overwhelmingly auth tokens / session ids — masking in
 * UI previews is the safer default.
 */
export interface ResolvedLiveValue {
  value: string;
  /** Backing workflow uid — lets UI link back for navigation + ref-counting. */
  workflowUid: string;
  /** When true, the value is past its expiry but still served (async-warm). */
  stale?: boolean;
  /**
   * When true, an input to the value's production recipe changed (the
   * embedded request, workflow, or a resolved variable) and it has not
   * been re-extracted since. Distinct from {@link stale}: that flags an
   * expired-but-fine value; this flags a wrong-recipe one. Only manual-
   * trigger workflows carry it — automatic workflows self-heal on edit.
   */
  definitionallyStale?: boolean;
  /** Override the default `true` sensitivity. Rare — most LVs are tokens. */
  isSensitive?: boolean;
}

export type LiveRegistry = ReadonlyMap<string, ResolvedLiveValue>;

/** An empty {@link LiveRegistry} used as the default when callers haven't wired live vars. */
export const EMPTY_LIVE_REGISTRY: LiveRegistry = new Map();

// ── TOTP registry ──────────────────────────────────────────────────

/**
 * Snapshot of currently-valid TOTP codes, keyed by the vault entry's
 * `name`. Built once per request execution from every `kind: 'totp'`
 * vault entry; resolution looks the code up here instead of computing
 * synchronously (the resolver is sync, RFC-6238 needs async WebCrypto).
 *
 * Critically, callers that don't precompute (DNR rule compile) leave
 * the registry empty — TOTP-kind vault entries then surface as
 * `unset-in-scope` and the rule is dropped from DNR. This is the
 * architectural gate that prevents 30s-lifetime codes from being
 * baked into static rules.
 */
export type TotpRegistry = ReadonlyMap<string, string>;

/** An empty {@link TotpRegistry} — the DNR-compile default. */
export const EMPTY_TOTP_REGISTRY: TotpRegistry = new Map();

/**
 * How the resolver treats a `kind: 'totp'` vault entry whose code is
 * not in the {@link TotpRegistry}.
 *
 *   - `reject` (default) — return `null`. The reference surfaces as
 *     `unset-in-scope`. This is the DNR-compile contract: codes have
 *     ~30s lifetime, they can't be baked into static rules that live
 *     for hours.
 *   - `defer`             — return a {@link ResolvedVariable} with
 *     `deferred: true` and an empty `value`. Renderer-only contexts
 *     (template syntax highlighting, Inspector "exists?" check) opt
 *     into this so a TOTP reference that EXISTS in the vault renders
 *     as "resolvable" (the actual code is computed at request time
 *     in the SW's request-executor, not here).
 *
 * Switching modes is purely a caller policy — the resolver still
 * walks the same data structure. The default `reject` keeps the DNR
 * pipeline architecturally safe by construction; renderer surfaces
 * have to opt in explicitly.
 */
export type DeferredVaultMode = 'reject' | 'defer';

/**
 * Step-capture context — installed by the chain runner ONLY while a
 * Live Workflow step is being resolved. Keys are step ids; values are
 * the step's name → extracted-value map.
 *
 * Presence is the signal: `null` means "no chain context" and
 * `{{step.X.Y}}` surfaces a `step-out-of-context` error; a non-null
 * (even if empty) map means "chain context active" and a missing
 * stepId / captureName falls through to `unset-in-scope`.
 */
export type StepCaptureContext = ReadonlyMap<string, ReadonlyMap<string, string>> | null;
