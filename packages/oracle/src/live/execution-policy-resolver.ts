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

import { deriveExecutionPolicy, type ExecutionPolicyResult } from '@openheaders/core/live';
import type { LiveWorkflow, Request, Vault } from '@openheaders/core/types';
import {
  getEnvironmentsForWorkspace,
  getVaultForWorkspace,
  getWorkspaceVariablesForWorkspace,
} from '../entity/environment-store';
import { getRequestCollectionsForWorkspace, getRequestInWorkspace } from '../entity/request-store';

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
