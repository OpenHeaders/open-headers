import { consumedOrgIds, getIdentitySnapshot, recordJoinedOrg } from '@openheaders/core/identity';
import { type HandshakeRejectReason, isBackendEvictingReason } from '@openheaders/core/protocol';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { applyWorkspaceSnapshot, readWorkspaceStateVector } from '@openheaders/oracle/sync';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '@openheaders/oracle/sync/service';
import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import { runtime } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { forwardCurrentAwarenessOnConnect } from '../awareness-forwarder';
import {
  getWorkspace,
  listWorkspaces,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from '../modules/workspace-store';
import { createSyncHandshakeInitiator } from '../sync-handshake-initiator';
import { applyPeerStateVectorToPendingOut, flushPendingOutToBackend } from '../sync-mutation-forwarder';
import { sendViaWebSocket } from '../websocket';

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

export function setupSyncHandshake(): SyncHandshakeHandles {
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
    send: (frame) => sendViaWebSocket(frame as Record<string, unknown>),
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
      const raw = getSetting('backend.authToken');
      return raw && raw.length > 0 ? raw : null;
    },
    readStateVector: (workspaceId) => readWorkspaceStateVector(workspaceId),
    // Adopted workspace is sequenced first so a mid-fan-out SW death still
    // leaves the user on a synced workspace.
    listConsumedWorkspaceIds: () => {
      const consumed = consumedOrgIds(getIdentitySnapshot());
      if (consumed.size === 0) return [];
      const ids = listWorkspaces()
        .filter((ws) => consumed.has(ws.orgId))
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
      await applyPeerStateVectorToPendingOut(peerVector);
      await flushPendingOutToBackend();
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
      const { firstJoin } = await recordJoinedOrg(org);
      if (firstJoin && backendActiveWorkspaceId) {
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
