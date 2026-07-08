import { claimJoinedOrg, getOrgBackendBindings } from '@openheaders/core/identity';
import { type HandshakeRejectReason, isBackendEvictingReason } from '@openheaders/core/protocol';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { applyWorkspaceSnapshot, readWorkspaceStateVector } from '@openheaders/oracle/sync';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '@openheaders/oracle/sync/service';
import { runtime } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { forwardCurrentAwarenessOnConnect } from '../awareness-forwarder';
import {
  getWorkspace,
  listWorkspaces,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from '../modules/workspace/workspace-store';
import { createSyncHandshakeInitiator } from '../sync-handshake-initiator';
import { applyPeerStateVectorToPendingOut, flushPendingOutToBackend } from '../sync-mutation-forwarder';
import type { BackendWireHandle } from '../websocket';

export interface SyncHandshakeHandles {
  initiator: ReturnType<typeof createSyncHandshakeInitiator>;
  tryAdoptPendingWorkspace: () => void;
  /**
   * True when the backend has ACTIVELY REJECTED this peer (revoked/rotated
   * token → `auth-required`, or protocol mismatch) — as opposed to being
   * unreachable. Sticky: set on a rejecting `onRejected`, cleared only on a
   * clean `onSynced`, so it survives the reconnect-backoff flap that resets
   * the FSM's live `rejectReason()` to null on every attempt. The
   * offline-fallback election reads it (audit X-1) so a revoked peer treats
   * itself as *evicted, not offline* and banners instead of self-electing an
   * exclusive credential against the still-live backend.
   */
  isBackendEvicting: () => boolean;
}

/**
 * Build the handshake coordinator for one backend wire — one initiator
 * instance per connection (MULTI_BACKEND_PLAN.md §3). Everything that
 * used to read the singular primary record reads the wire instead: the
 * send path, the auth token, the Org provenance stamp, and the fan-out
 * enumeration (only workspaces whose Org is bound to THIS backend).
 */
export function createSyncHandshakeForWire(wire: BackendWireHandle): SyncHandshakeHandles {
  // Backend's active workspace id from WELCOME, held until that workspace
  // syncs down. The handshake fires before the joined Org's workspaces
  // arrive, so adoption is deferred to a later workspace-store change.
  let pendingAdoptWorkspaceId: string | null = null;

  // Sticky most-recent reject reason (audit X-1). The FSM's `rejectReason()`
  // is reset to null on every reconnect attempt, so a peer being repeatedly
  // kicked flaps auth-required → null → auth-required — too flaky for the
  // election's safety gate. This survives until a clean `onSynced` proves
  // the backend accepted us again (e.g. after re-pairing).
  let lastRejectReason: HandshakeRejectReason | null = null;

  const tryAdoptPendingWorkspace = (): void => {
    if (!pendingAdoptWorkspaceId) return;
    if (!getWorkspace(pendingAdoptWorkspaceId)) return;
    const id = pendingAdoptWorkspaceId;
    pendingAdoptWorkspaceId = null;
    void setActiveWorkspaceById(id).catch((err: unknown) => {
      logger.warn('Background', 'join → adopt: could not promote the backend workspace to active', err);
    });
  };

  const initiator = createSyncHandshakeInitiator({
    send: (frame) => wire.send(frame as Record<string, unknown>),
    getActiveWorkspaceId: () => peekActiveWorkspaceId(),
    getExtensionNodeId: (workspaceId) => {
      const svc = getOrCreateWorkspaceService(workspaceId);
      try {
        return svc.context.nodeId;
      } finally {
        releaseWorkspaceService(workspaceId);
      }
    },
    getExtensionAgent: () => `@openheaders/extension@${runtime.getManifest().version}`,
    getAuthToken: () => {
      const raw = wire.record().authToken;
      return raw && raw.length > 0 ? raw : null;
    },
    readStateVector: (workspaceId) => readWorkspaceStateVector(workspaceId),
    // Only workspaces whose Org is bound to THIS backend — the fan-out
    // never pulls another backend's scopes over this wire (routing
    // invariant 1's read-side mirror). Adopted workspace is sequenced
    // first so a mid-fan-out SW death still leaves the user on a synced
    // workspace.
    listConsumedWorkspaceIds: () => {
      const bindings = getOrgBackendBindings();
      const ids = listWorkspaces()
        .filter((ws) => bindings.get(ws.orgId) === wire.backendId)
        .map((ws) => ws.id);
      if (pendingAdoptWorkspaceId && ids.includes(pendingAdoptWorkspaceId)) {
        const adopt = pendingAdoptWorkspaceId;
        return [adopt, ...ids.filter((id) => id !== adopt)];
      }
      return ids;
    },
    applySnapshot: async (snapshot) => {
      const svc = getOrCreateWorkspaceService(snapshot.workspaceId);
      try {
        await svc.hydrated;
        await applyWorkspaceSnapshot(snapshot, { makeContext: () => svc.context.next() });
      } finally {
        releaseWorkspaceService(snapshot.workspaceId);
      }
    },
    onSynced: async (_scope, peerVector) => {
      // A clean sync proves the backend accepted us — clear any sticky
      // eviction so the offline election treats a later partition as a
      // genuine outage again (audit X-1).
      lastRejectReason = null;
      await applyPeerStateVectorToPendingOut(wire.backendId, peerVector);
      await flushPendingOutToBackend(wire.backendId);
      tryAdoptPendingWorkspace();
      // Awareness is ephemeral and only flows on local publish events.
      // Push the current snapshot now so the peer folds extension surfaces
      // into its store immediately rather than waiting for next activity.
      forwardCurrentAwarenessOnConnect();
    },
    onRejected: (reason, detail) => {
      // Remember the rejection (audit X-1) so the offline-fallback election
      // can tell "backend evicted me" from "backend is down."
      lastRejectReason = reason;
      logger.warn('Background', `sync handshake rejected: ${reason}${detail ? ` — ${detail}` : ''}`);
    },
    onReach: (reach) => {
      void getHostStorage()
        ?.set(OH.backendReach, reach)
        .catch((err: unknown) => logger.warn('Background', 'backendReach write failed', err));
    },
    // First-join only — a reconnect must NOT re-adopt, otherwise the
    // re-sent WELCOME would overwrite a local active-workspace switch
    // the user made since.
    onJoinedOrg: async (org, backendActiveWorkspaceId) => {
      // Provenance: the WELCOME rode this wire, so the Org binds to its
      // registry record (MULTI_BACKEND_PLAN.md §2). The claim enforces
      // Org uniqueness: an Org already bound to a different, still-
      // present backend is refused — never re-bound, never
      // double-consumed.
      const result = await claimJoinedOrg(org, wire.backendId);
      if (result.outcome === 'refused') {
        logger.warn(
          'Background',
          `backend ${wire.backendId} claims Org ${org.id}, already provided by backend ${result.boundBackendId} — join refused`,
        );
        return;
      }
      if (result.firstJoin && backendActiveWorkspaceId) {
        pendingAdoptWorkspaceId = backendActiveWorkspaceId;
        tryAdoptPendingWorkspace();
      }
      logger.info('Background', `joined backend Org ${org.id} — its workspaces will sync down`);
    },
  });

  return {
    initiator,
    tryAdoptPendingWorkspace,
    isBackendEvicting: () => isBackendEvictingReason(lastRejectReason),
  };
}
