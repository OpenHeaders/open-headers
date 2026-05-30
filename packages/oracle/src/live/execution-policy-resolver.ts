/**
 * Fire-time execution-policy resolution for Live Workflows (WS-C C9).
 *
 * `deriveExecutionPolicy` in `@openheaders/core/live` is pure — it needs
 * the workflow's requests, the vault, and the env / workspace / collection
 * variable scope handed in. This module is the host-neutral assembler that
 * pulls those inputs from the oracle entity stores for a given
 * `(workspaceId, environmentId)` and returns the classified policy.
 *
 * Lives in the engine layer (not a host) for the same reason the LF1–LF4
 * definitional-freshness lift does: the store reads (`getVaultForWorkspace`,
 * `getWorkspaceVariablesForWorkspace`, `getRequestCollectionsForWorkspace`,
 * `getEnvironmentsForWorkspace`, `getRequestInWorkspace`) are host-neutral
 * oracle reads — the exact ones `definitional-freshness.ts` already assembles
 * its variable surface from. The extension scheduler's C9 escape-hatch branch
 * is the first caller; the desktop never needs it (it is the producer, never a
 * deferring peer), but the assembler stays usable by any host.
 *
 * Reads are by-workspace (not active-workspace) so a cross-workspace alarm
 * dispatch (per-tab mode) classifies against the right stores.
 */

import {
  deriveExecutionPolicy,
  type ExclusivityReason,
  type ExecutionPolicyResult,
  isFallbackEligible,
} from '@openheaders/core/live';
import type { LiveWorkflow, Request, Vault } from '@openheaders/core/types';
import {
  getEnvironmentsForWorkspace,
  getVaultForWorkspace,
  getWorkspaceVariablesForWorkspace,
} from '../entity/environment-store';
import { getRequestCollectionsForWorkspace, getRequestInWorkspace } from '../entity/request-store';
import { getLiveWorkflowsForWorkspace } from './live-workflow-store';

/** Flat `{name, value}` list → name → value map (later entries win on a duplicate name). */
function toVarMap(variables: ReadonlyArray<{ name: string; value: string }>): Map<string, string> {
  const out = new Map<string, string>();
  for (const v of variables) out.set(v.name, v.value);
  return out;
}

/** Merge every request collection's variables in the workspace into one name → value map. */
function collectionVarMap(workspaceId: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const collection of getRequestCollectionsForWorkspace(workspaceId)) {
    for (const v of collection.variables ?? []) out.set(v.name, v.value);
  }
  return out;
}

/**
 * Reduce the vault to name → recipe. `deriveExecutionPolicy` classifies the
 * vault through its `input.vault` argument (reading `kind: 'totp'` directly),
 * not through `scope.vaultVars` — but the `VariableScopeSnapshot` shape
 * requires the field, so populate it consistently rather than leaving a lie.
 * A TOTP entry contributes its seed/params, never the rotating code.
 */
function vaultVarMap(vault: Vault): Map<string, string> {
  const out = new Map<string, string>();
  for (const secret of vault.secrets) {
    out.set(
      secret.name,
      secret.kind === 'string'
        ? secret.value
        : `totp:${secret.seed}:${secret.algorithm}:${secret.digits}:${secret.period}`,
    );
  }
  return out;
}

/**
 * Classify a workflow's execution policy at fire time for a specific
 * `(workspace, env)`. Assembles the pure classifier's inputs from the
 * oracle entity stores and delegates. A step whose request isn't resident
 * contributes no signal (mirrors the classifier's missing-request skip and
 * the runner failing on it separately).
 */
export function deriveExecutionPolicyForWorkflow(
  workspaceId: string,
  workflow: LiveWorkflow,
  environmentId: string | null,
): ExecutionPolicyResult {
  const vault = getVaultForWorkspace(workspaceId);

  const requestsByUid = new Map<string, Request>();
  for (const step of workflow.steps) {
    if (requestsByUid.has(step.requestUid)) continue;
    const request = getRequestInWorkspace(step.requestUid, workspaceId);
    if (request) requestsByUid.set(step.requestUid, request);
  }

  const envVars =
    environmentId === null
      ? new Map<string, string>()
      : toVarMap(getEnvironmentsForWorkspace(workspaceId).find((e) => e.uid === environmentId)?.variables ?? []);

  return deriveExecutionPolicy({
    workflow,
    requestsByUid,
    vault,
    scope: {
      envVars,
      vaultVars: vaultVarMap(vault),
      workspaceVars: toVarMap(getWorkspaceVariablesForWorkspace(workspaceId).variables),
      collectionVars: collectionVarMap(workspaceId),
    },
  });
}

/**
 * Seed-eligibility (WS-C C15) for the offline fallback election: can THIS
 * host actually run the workflow's exclusive credential, given the secrets
 * resident in its own stores?
 *
 * The load-bearing gate is the **vault seed**: a consumed `kind: 'totp'`
 * entry replicates only to paired same-device hosts (WS-B B1), so holding
 * it *is* the same-device signal a cross-device host structurally lacks —
 * and a cross-device host must never be elected (it would race-and-fail on
 * the missing seed). Rotating-OAuth token bundles, by contrast, ride §4
 * trust-zone-wide (every paired host holds them), so they don't
 * distinguish same- from cross-device — every required OAuth ref is
 * treated as resident. The host resolves the consumed-secret refs from the
 * already-derived `reasons` (the per-step scan `deriveExecutionPolicy`
 * yields) and we apply the pure core predicate.
 *
 * By-workspace (not active-workspace), matching {@link deriveExecutionPolicyForWorkflow}.
 */
export function isFallbackEligibleForWorkflow(workspaceId: string, reasons: readonly ExclusivityReason[]): boolean {
  const vaultNames = new Set<string>();
  for (const secret of getVaultForWorkspace(workspaceId).secrets) vaultNames.add(secret.name);

  const oauthCredentialRefs = new Set<string>();
  for (const reason of reasons) {
    if (reason.kind === 'rotating-oauth') oauthCredentialRefs.add(reason.credentialRef);
  }

  return isFallbackEligible(reasons, { vaultNames, oauthCredentialRefs });
}

/**
 * Workspace-level rollup of {@link isFallbackEligibleForWorkflow}: does
 * THIS host hold the consumed seed for **at least one** exclusive Live
 * Workflow in the workspace? The auto-seed (WS-C C14) gate — only a host
 * that can actually run an exclusive credential enlists itself in the
 * offline-fallback priority list.
 *
 * Evaluated at `environmentId = null`: a workflow's exclusivity reasons
 * (consumed TOTP vault entry / rotating-OAuth ref) come from its steps +
 * the workspace vault, both env-independent, so the null-env classification
 * is the right workspace-wide signal. A host holding a seed that backs no
 * exclusive workflow does NOT enlist (the precise C15 predicate, not a raw
 * "holds any seed" check).
 */
export function workspaceHoldsExclusiveFallbackSeed(workspaceId: string): boolean {
  for (const workflow of getLiveWorkflowsForWorkspace(workspaceId)) {
    const { policy, reasons } = deriveExecutionPolicyForWorkflow(workspaceId, workflow, null);
    if (policy === 'exclusive' && isFallbackEligibleForWorkflow(workspaceId, reasons)) return true;
  }
  return false;
}
