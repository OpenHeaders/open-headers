/**
 * Mode-switch Publish (U5.6) — local-only, single-workspace orchestrator.
 *
 * Publish re-homes ONE workspace into an authenticated backend's `Org`
 * by flipping its `Workspace.orgId` to the target `Org` (UNIFIED_ORACLE_
 * MODEL.md §6.5). After the flip the workspace's data + metadata
 * mutations are stamped with the target `Org`, so the existing
 * sender-side + receiver-side org filters converge it with the target's
 * data — both directions live.
 *
 * Publish is the explicit, permission-gated opt-in for pushing a
 * SINGLE workspace's data up to a backend — the one and only path by
 * which a workspace's data travels up. Joining a backend never pushes
 * anything up; Publish is a separate, deliberate per-workspace gesture.
 *
 * The orchestrator owns the sequencing decisions:
 *
 *   1. Empty target `orgId` → `no-target-org` (defensive — the UI only
 *      enables Publish once a backend is joined).
 *   2. No workspace on this host with the requested id →
 *      `workspace-not-found`.
 *   3. A workspace already bound to the target `Org` is returned as an
 *      `ok: true` no-op (`fromOrgId === targetOrgId`) — re-publish is
 *      idempotent.
 *   4. A flip rejection → `rehome-failed`; the workspace keeps its old
 *      binding.
 *
 * The permission gate (`workspace.write` on the workspace + the target
 * `Org` authorized) is NOT here — it is a host-state question the
 * dispatcher answers via `canPublishWorkspace` before calling in. The
 * orchestrator stays pure over its injected deps.
 *
 * Host-neutral: extension SW + desktop main both call this through the
 * `oh.sync.publishWorkspace` channel with their own `rehomeWorkspace`
 * mint path injected.
 */

import type { PublishResult } from '@openheaders/core/sync';

export interface PublishWorkspaceInput {
  readonly id: string;
  readonly name: string;
  /** The workspace's current `Org` binding. */
  readonly orgId: string;
}

export interface OrchestratePublishDeps {
  /**
   * The authenticated backend's `Org` to publish into. The dispatcher
   * verifies it is in the authorized set (`canPublishWorkspace`) before
   * calling in.
   */
  readonly targetOrgId: string;
  /** The workspace to publish. */
  readonly workspaceId: string;
  /** Resident workspaces on this host with their current `Org` binding. */
  readonly workspaces: ReadonlyArray<PublishWorkspaceInput>;
  /**
   * Flip a workspace's `orgId` through the standard metadata-mutation
   * path (§6.5). A rejection → `rehome-failed`.
   */
  readonly rehomeWorkspace: (workspaceId: string, targetOrgId: string) => Promise<void>;
}

export async function orchestratePublish(deps: OrchestratePublishDeps): Promise<PublishResult> {
  if (deps.targetOrgId.length === 0) {
    return { ok: false, reason: 'no-target-org' };
  }

  const ws = deps.workspaces.find((w) => w.id === deps.workspaceId);
  if (!ws) {
    return { ok: false, reason: 'workspace-not-found' };
  }

  const published = {
    workspaceId: ws.id,
    workspaceName: ws.name,
    fromOrgId: ws.orgId,
  };

  // Already on the target Org — re-publish is an idempotent no-op.
  if (ws.orgId === deps.targetOrgId) {
    return { ok: true, targetOrgId: deps.targetOrgId, published };
  }

  try {
    await deps.rehomeWorkspace(ws.id, deps.targetOrgId);
  } catch (err) {
    return {
      ok: false,
      reason: 'rehome-failed',
      detail: `${ws.name}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ok: true, targetOrgId: deps.targetOrgId, published };
}
