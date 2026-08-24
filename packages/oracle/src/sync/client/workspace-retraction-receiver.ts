/**
 * Inbound workspace-retraction wire boundary (the access-foundation
 * plan §8 F2, S5c).
 *
 * Claims `oh.sync.workspaceRetract` frames — the server's revoke-time
 * twin of the grant-time workspace offer — and evicts the named
 * workspace locally via {@link evictConsumedWorkspace}: the same state
 * surgery the Discard leg of removing a backend runs. No mutation is
 * minted, so the eviction law holds (no tombstone HLC, no poisoned
 * STATE_VECTOR) and a later re-grant re-materializes the workspace
 * through the ordinary catch-up / live offer.
 *
 * **Per-connection gate.** A connection may only retract a workspace
 * whose Org is bound to *that backend* (`getOrgBackendBindings`) — the
 * same org-ownership gate the mutation receiver applies. A misbehaving
 * backend cannot evict another backend's workspaces, and a home-Org
 * (local) workspace is structurally unretractable — no binding ever
 * maps it to a wire.
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
import { SYNC_WORKSPACE_RETRACT_TYPE, SyncWorkspaceRetractMessageSchema } from '@openheaders/core/protocol';
import { logger } from '@openheaders/core/utils';
import * as v from 'valibot';
import { getWorkspace } from '../../workspace/extension-workspace-store';
import { evictConsumedWorkspace } from '../../workspace/workspace-eviction';
import type { MutationWirePort } from './mutation-receiver';

const SCOPE = 'WorkspaceRetraction';

/**
 * Attempt to handle one parsed WS message from `wire`. Returns `true`
 * if the message is an `oh.sync.workspaceRetract` frame (evicted or
 * dropped by the gate / parse failure), `false` otherwise so the caller
 * can route to other handlers.
 */
export async function handleIncomingWorkspaceRetractFrame(raw: unknown, wire: MutationWirePort): Promise<boolean> {
  if (!raw || typeof raw !== 'object') return false;
  if ((raw as { type?: unknown }).type !== SYNC_WORKSPACE_RETRACT_TYPE) return false;

  const result = v.safeParse(SyncWorkspaceRetractMessageSchema, raw);
  if (!result.success) {
    logger.warn(SCOPE, 'dropping malformed oh.sync.workspaceRetract frame', result.issues);
    return true;
  }
  const { workspaceId } = result.output;

  const workspace = getWorkspace(workspaceId);
  if (!workspace) return true; // already absent — nothing to evict
  if (getOrgBackendBindings().get(workspace.orgId) !== wire.backendId) {
    logger.debug(SCOPE, `dropped retraction of workspace ${workspaceId} not owned by this connection`);
    return true;
  }

  const outcome = await evictConsumedWorkspace(workspaceId);
  if (!outcome.ok) {
    logger.warn(SCOPE, `retraction eviction of workspace ${workspaceId} failed: ${outcome.reason}`);
  }
  return true;
}
