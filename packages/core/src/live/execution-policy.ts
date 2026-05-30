/**
 * Execution-policy derivation for Live Workflows.
 *
 * A workflow is either **idempotent** (safe to run on every host that
 * has a backend gone — N concurrent runs are at worst wasteful) or
 * **exclusive** (at most one run per refresh window, globally — a
 * concurrent run burns a single-use code or trips OAuth reuse-detection
 * and silently revokes the session). See `docs/LIVE_RUNNER_OWNERSHIP_PLAN.md`
 * §3–4 + §WS-C.4.
 *
 * The policy is **derived from a positive signal**, never assumed:
 *
 *   - **TOTP consumption.** A step references a `{{vault.X}}` whose entry
 *     is `kind: 'totp'` — directly, OR indirectly through an env /
 *     workspace / collection variable whose value resolves *from* that
 *     entry (concatenation, aliasing). A consumed TOTP code is single-use
 *     within its window.
 *   - **Refresh-capable OAuth.** A step authed by an OAuth2 credential
 *     whose flow mints a refresh token (`authorization-code-pkce`,
 *     `device-code`). Rotation behaviour is *unknown* from config, and a
 *     missed rotating-refresh is a silent session revoke — so we lean
 *     exclusive (high recall over precision). `client-credentials` mints
 *     no refresh token (N valid tokens, never a revoke) ⇒ idempotent.
 *   - **Opt-in.** The user marked the workflow "must not run concurrently"
 *     for the rare state-mutating POST that carries no credential signal.
 *
 * Recall is a correctness requirement: a *missed* exclusive workflow is a
 * worse failure than a false-positive (which only costs coherence). So
 * the TOTP scan walks **all** steps and follows variable indirection to a
 * fixpoint; OAuth leans exclusive when rotation is unknowable.
 *
 * Auto-detected exclusivity is **not user-downgradable** — `optInExclusive`
 * can only escalate idempotent → exclusive, never the reverse.
 *
 * Pure — no I/O, no framework deps. The host resolves the workflow's
 * requests + vault + variable scope from its stores and passes them in.
 */

import type { OAuth2Flow, Request, Vault } from '../types';
import { collectRequestTemplateStrings } from './request-scan';
import { scanTemplateReferencesMany } from './template-scan';
import type { VariableScopeSnapshot } from './variable-scan';

// ── Result + reasons ──────────────────────────────────────────────

export type ExecutionPolicy = 'idempotent' | 'exclusive';

/** OAuth2 flows that mint a refresh token and so may rotate it. */
export type RefreshableOAuthFlow = Extract<OAuth2Flow, 'authorization-code-pkce' | 'device-code'>;

/**
 * Why a workflow was classified exclusive. Surfaced read-only in the
 * editor ("won't run concurrently — consumes a TOTP secret") and asserted
 * by tests. Empty reasons ⇒ idempotent.
 */
export type ExclusivityReason =
  | {
      kind: 'totp';
      /** The root `kind: 'totp'` vault entry name the chain consumes. */
      vaultName: string;
      /** The intermediate variable name when reached indirectly; absent when the step references the vault entry directly. */
      indirectVia?: string;
    }
  | { kind: 'rotating-oauth'; credentialRef: string; flow: RefreshableOAuthFlow }
  | { kind: 'opt-in' };

export interface ExecutionPolicyResult {
  policy: ExecutionPolicy;
  /** Deduped, in discovery order. Empty when `policy === 'idempotent'`. */
  reasons: ExclusivityReason[];
  /**
   * Step ids that carry a credential/auth signal (consume a TOTP code, or
   * are OAuth-authed) — the byproduct of the same per-step scan that
   * derives `reasons`. The WS-C C7 refresh-health classifier reads this to
   * label a failure `auth-failing` when it halts on a credential step.
   * Only populated for steps whose input carries an `id`.
   */
  credentialStepIds: Set<string>;
}

export interface ExecutionPolicyInput {
  /** The workflow whose steps are classified. `id` (when present) keys `credentialStepIds`. */
  workflow: { steps: ReadonlyArray<{ id?: string; requestUid: string }> };
  /** Resolve a step's request by uid; a missing entry contributes no signal (the runner fails on it separately). */
  requestsByUid: ReadonlyMap<string, Request>;
  /** Workspace vault — classifies `{{vault.X}}` references by `kind`. */
  vault: Vault;
  /** Env / workspace / collection variable VALUE templates — scanned for indirect TOTP taint. */
  scope: VariableScopeSnapshot;
  /** User "must not run concurrently" toggle. Only escalates to exclusive; never downgrades a derived signal. */
  optInExclusive?: boolean;
}

// ── Namespace guard ───────────────────────────────────────────────

type ValueNamespace = 'env' | 'vault' | 'workspace' | 'collection';

/**
 * Namespaces whose values come from a user variable scope, plus the flat
 * (`null`) form that walks the vault → env → collection → workspace chain.
 * `live` / `step` never reach the scanner's `other` channel; `file` /
 * `dynamic` aren't user-edited variable values, so they can't carry TOTP
 * taint.
 */
function isValueOrFlat(ns: string | null): ns is ValueNamespace | null {
  return ns === null || ns === 'env' || ns === 'vault' || ns === 'workspace' || ns === 'collection';
}

// ── TOTP taint propagation ────────────────────────────────────────

/**
 * Compute the set of env / workspace / collection variable NAMES whose
 * value resolves (transitively) from a `kind: 'totp'` vault entry.
 *
 * A flat `{{X}}` reference resolves vault-first, so a flat reference whose
 * name matches a TOTP entry is a direct hit; an explicit `{{vault.X}}` is
 * too. A reference to an already-tainted variable name propagates the
 * taint. Iterated to a fixpoint because variables can chain
 * (`a → b → vault.totp`). Keyed by NAME only — over-approximating across
 * scopes is the recall-safe choice.
 *
 * Returns name → root TOTP entry name (for reason attribution).
 */
function computeTotpTaintedNames(scope: VariableScopeSnapshot, totpNames: ReadonlySet<string>): Map<string, string> {
  // Flatten every named variable's value template. A name appearing in
  // multiple scopes contributes each value — any one tainting marks the
  // name tainted.
  const entries: Array<{ name: string; value: string }> = [];
  for (const maps of [scope.envVars, scope.workspaceVars, scope.collectionVars]) {
    for (const [name, value] of maps) entries.push({ name, value });
  }

  const tainted = new Map<string, string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const { name, value } of entries) {
      if (tainted.has(name)) continue;
      const root = totpRootOf(value, totpNames, tainted);
      if (root !== null) {
        tainted.set(name, root);
        changed = true;
      }
    }
  }
  return tainted;
}

/**
 * Scan one value template; return the root TOTP entry name it consumes
 * (directly via vault / flat, or through an already-tainted variable), or
 * `null` if it carries no TOTP taint.
 */
function totpRootOf(
  template: string,
  totpNames: ReadonlySet<string>,
  tainted: ReadonlyMap<string, string>,
): string | null {
  const { other } = scanTemplateReferencesMany([template]);
  for (const ref of other) {
    if (!isValueOrFlat(ref.namespace)) continue;
    // Direct: vault.X or flat X (vault wins the chain) hitting a TOTP entry.
    if ((ref.namespace === 'vault' || ref.namespace === null) && totpNames.has(ref.name)) {
      return ref.name;
    }
    // Indirect: through a variable already known to be TOTP-tainted.
    const viaRoot = tainted.get(ref.name);
    if (viaRoot !== undefined) return viaRoot;
  }
  return null;
}

// ── Classifier ────────────────────────────────────────────────────

export function deriveExecutionPolicy(input: ExecutionPolicyInput): ExecutionPolicyResult {
  const totpNames = new Set<string>();
  for (const secret of input.vault.secrets) {
    if (secret.kind === 'totp') totpNames.add(secret.name);
  }

  const taintedNames = computeTotpTaintedNames(input.scope, totpNames);

  const reasons: ExclusivityReason[] = [];
  const credentialStepIds = new Set<string>();
  for (const step of input.workflow.steps) {
    const request = input.requestsByUid.get(step.requestUid);
    if (!request) continue;

    const before = reasons.length;
    collectTotpReasons(request, totpNames, taintedNames, reasons);
    collectOAuthReason(request, reasons);
    // This step carried a credential signal (TOTP-consume / OAuth-auth) —
    // record its id so the C7 health classifier can label a failure here
    // `auth-failing` rather than `source-failing`.
    if (reasons.length > before && step.id !== undefined) credentialStepIds.add(step.id);
  }

  if (input.optInExclusive) reasons.push({ kind: 'opt-in' });

  const deduped = dedupeReasons(reasons);
  return { policy: deduped.length > 0 ? 'exclusive' : 'idempotent', reasons: deduped, credentialStepIds };
}

function collectTotpReasons(
  request: Request,
  totpNames: ReadonlySet<string>,
  taintedNames: ReadonlyMap<string, string>,
  out: ExclusivityReason[],
): void {
  const { other } = scanTemplateReferencesMany(collectRequestTemplateStrings(request));
  for (const ref of other) {
    if (!isValueOrFlat(ref.namespace)) continue;
    if ((ref.namespace === 'vault' || ref.namespace === null) && totpNames.has(ref.name)) {
      out.push({ kind: 'totp', vaultName: ref.name });
      continue;
    }
    const root = taintedNames.get(ref.name);
    if (root !== undefined) out.push({ kind: 'totp', vaultName: root, indirectVia: ref.name });
  }
}

function collectOAuthReason(request: Request, out: ExclusivityReason[]): void {
  const auth = request.auth;
  if (auth.type !== 'oauth2') return;
  if (auth.flow === 'authorization-code-pkce' || auth.flow === 'device-code') {
    out.push({ kind: 'rotating-oauth', credentialRef: auth.credentialRef, flow: auth.flow });
  }
}

function dedupeReasons(reasons: readonly ExclusivityReason[]): ExclusivityReason[] {
  const seen = new Set<string>();
  const out: ExclusivityReason[] = [];
  for (const reason of reasons) {
    const key = reasonKey(reason);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(reason);
  }
  return out;
}

function reasonKey(reason: ExclusivityReason): string {
  switch (reason.kind) {
    case 'totp':
      return `totp:${reason.vaultName}:${reason.indirectVia ?? ''}`;
    case 'rotating-oauth':
      return `oauth:${reason.credentialRef}:${reason.flow}`;
    case 'opt-in':
      return 'opt-in';
  }
}
