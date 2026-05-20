/**
 * Mode-switch Combine (U5.3) — local-only orchestrator.
 *
 * Re-homes this host's workspaces into a joined backend's `Org` by
 * flipping each `Workspace.orgId` to the target `Org` (UNIFIED_ORACLE_
 * MODEL.md §6.5). After the flip the workspace's data + metadata
 * mutations are stamped with the target `Org`, so the existing
 * sender-side + receiver-side org filters converge it with the
 * target's data — both directions live.
 *
 * Nothing crosses the wire from here: Combine is purely a sequence of
 * local `orgId` metadata mutations. The orchestrator owns the
 * sequencing decisions:
 *
 *   1. Empty target `orgId` → `no-target-org` (defensive — the dialog
 *      only enables Combine once a backend is joined).
 *   2. No resident workspaces → `no-source-data`.
 *   3. Workspaces already bound to the target `Org` are skipped — a
 *      re-run after a partial failure is idempotent.
 *   4. A flip rejection short-circuits → `rehome-failed`, carrying the
 *      workspaces that DID flip so the user sees the partial progress.
 *
 * The `target-not-authorized` guard is NOT here — whether the target
 * `Org` is in this host's authorized set is a host-state question the
 * dispatcher answers before calling in (it owns the identity
 * snapshot). The orchestrator stays pure over its injected deps.
 *
 * **Posture.** Combine is offered ONLY on trust-by-process (loopback)
 * backends; the mode-switch dialog (U5.5) owns that gate. Pushing data
 * up to an authenticated backend is the explicit per-workspace
 * "Publish" path (U5.6), never a Combine side effect.
 *
 * Host-neutral: extension SW + desktop main both call this through the
 * `oh.sync.executeCombine` channel with their own `rehomeWorkspace`
 * mint path injected.
 */

import type { CombinedWorkspace, CombineResult } from '@openheaders/core/sync';

export interface CombineWorkspaceInput {
  readonly id: string;
  readonly name: string;
  /** The workspace's current `Org` binding. */
  readonly orgId: string;
}

export interface OrchestrateCombineDeps {
  /**
   * The `Org` to re-home into — the joined backend's `Org` (U5.2). The
   * dispatcher resolves this from the renderer frame and verifies it is
   * in the authorized set before calling in.
   */
  readonly targetOrgId: string;
  /** Resident workspaces on this host with their current `Org` binding. */
  readonly workspaces: ReadonlyArray<CombineWorkspaceInput>;
  /**
   * Flip a workspace's `orgId` through the standard metadata-mutation
   * path (§6.5). Rejections short-circuit the run → `rehome-failed`.
   */
  readonly rehomeWorkspace: (workspaceId: string, targetOrgId: string) => Promise<void>;
}

export async function orchestrateCombine(deps: OrchestrateCombineDeps): Promise<CombineResult> {
  if (deps.targetOrgId.length === 0) {
    return { ok: false, reason: 'no-target-org' };
  }
  if (deps.workspaces.length === 0) {
    return { ok: false, reason: 'no-source-data' };
  }

  const pending = deps.workspaces.filter((w) => w.orgId !== deps.targetOrgId);
  const combinedWorkspaces: CombinedWorkspace[] = [];

  for (const ws of pending) {
    try {
      await deps.rehomeWorkspace(ws.id, deps.targetOrgId);
    } catch (err) {
      return {
        ok: false,
        reason: 'rehome-failed',
        detail: `${ws.name}: ${err instanceof Error ? err.message : String(err)}`,
        combinedWorkspaces,
      };
    }
    combinedWorkspaces.push({
      workspaceId: ws.id,
      workspaceName: ws.name,
      fromOrgId: ws.orgId,
    });
  }

  return { ok: true, targetOrgId: deps.targetOrgId, combinedWorkspaces };
}
