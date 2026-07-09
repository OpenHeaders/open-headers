import {
  clearBackendOrgConflict,
  getBackend,
  recordBackendOrgConflict,
  setBackendReach,
} from '@openheaders/core/backends';
import { claimJoinedOrg, getOrgBackendBindings } from '@openheaders/core/identity';
import { type HandshakeRejectReason, type HandshakeRole, isBackendEvictingReason } from '@openheaders/core/protocol';
import { logger } from '@openheaders/core/utils';
import {
  getWorkspace,
  listWorkspaces,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from '../../workspace/extension-workspace-store';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '../service';
import { applyWorkspaceSnapshot } from '../snapshot-applier';
import { readWorkspaceStateVector } from '../state-vector-reader';
import type { BackendWireHandle } from './backend-connection-manager';
import { applyPeerStateVectorToPendingOut, flushPendingOutToBackend } from './mutation-forwarder';
import { createSyncHandshakeInitiator } from './sync-handshake-initiator';
import { reportBackendSyncStatus } from './sync-status-aggregate';

const SCOPE = 'BackendWireHandshake';

/**
 * The host-bound edges of the per-wire handshake wiring. Everything
 * else — workspace store, identity, pending-out flush, status slots —
 * is shared oracle/core state reached directly.
 */
export interface BackendWireHandshakeDeps {
  /** The role this host announces in HELLO (extension, desktop, …). */
  readonly role: HandshakeRole;
  /** Diagnostic agent string (e.g. `'@openheaders/extension@5.0.0'`). */
  readonly getAgent: () => string;
  /**
   * Optional host hook fired after each scope's SYNCED, once the
   * pending-out queue has flushed. The extension pushes its current
   * awareness presence snapshot here so the peer folds this host's
   * surfaces immediately rather than on next activity; a host without
   * an awareness client plane omits it.
   */
  readonly onSyncedPresencePush?: () => void;
}

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
export function createSyncHandshakeForWire(
  wire: BackendWireHandle,
  deps: BackendWireHandshakeDeps,
): SyncHandshakeHandles {
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
      logger.warn(SCOPE, 'join → adopt: could not promote the backend workspace to active', err);
    });
  };

  const initiator = createSyncHandshakeInitiator({
    send: (frame) => wire.send(frame as Record<string, unknown>),
    role: deps.role,
    getActiveWorkspaceId: () => peekActiveWorkspaceId(),
    getNodeId: (workspaceId) => {
      const svc = getOrCreateWorkspaceService(workspaceId);
      try {
        return svc.context.nodeId;
      } finally {
        releaseWorkspaceService(workspaceId);
      }
    },
    getAgent: deps.getAgent,
    getAuthToken: () => {
      const raw = wire.record().authToken;
      return raw && raw.length > 0 ? raw : null;
    },
    readStateVector: (workspaceId) => readWorkspaceStateVector(workspaceId),
    // Only workspaces whose Org is bound to THIS backend — the fan-out
    // never pulls another backend's scopes over this wire (routing
    // invariant 1's read-side mirror). Adopted workspace is sequenced
    // first so a mid-fan-out host death still leaves the user on a
    // synced workspace.
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
      // The host pushes its current snapshot now so the peer folds this
      // host's surfaces into its store immediately rather than waiting
      // for next activity.
      deps.onSyncedPresencePush?.();
    },
    onRejected: (reason, detail) => {
      // Remember the rejection (audit X-1) so the offline-fallback election
      // can tell "backend evicted me" from "backend is down."
      lastRejectReason = reason;
      logger.warn(SCOPE, `sync handshake rejected: ${reason}${detail ? ` — ${detail}` : ''}`);
    },
    onReach: (reach) => {
      // Keyed by THIS wire's record — each backend's WELCOME owns only
      // its own entry, so two backends' tiers never clobber each other.
      void setBackendReach(wire.backendId, reach).catch((err: unknown) =>
        logger.warn(SCOPE, 'backendReach write failed', err),
      );
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
        // Surface the conflict on this backend's row (dot + tooltip).
        // Temporal like every slot write — a later synced report for the
        // wire's own Orgs overwrites it; the refused Org simply never
        // appears among the row's consumed Orgs.
        const provider = getBackend(result.boundBackendId);
        const providerLabel = provider ? provider.label.trim() || provider.url : 'another back-end';
        reportBackendSyncStatus(wire.backendId, {
          state: 'yellow',
          message: `Org "${org.name}" is already provided by ${providerLabel} — not joined`,
          context: { reason: 'org-conflict', orgId: org.id, boundBackendId: result.boundBackendId },
        });
        // Durable twin of the slot report — persists until this backend
        // successfully claims the Org or its record is removed, so the
        // connections list keeps the conflict visible under the row.
        await recordBackendOrgConflict({
          backendId: wire.backendId,
          orgId: org.id,
          orgName: org.name,
          boundBackendId: result.boundBackendId,
        });
        logger.warn(
          SCOPE,
          `backend ${wire.backendId} claims Org ${org.id}, already provided by backend ${result.boundBackendId} — join refused`,
        );
        return;
      }
      // Accepted — a durable conflict row for this (backend, Org) pair is
      // resolved (the old binding was stale, or the provider was removed).
      await clearBackendOrgConflict(wire.backendId, org.id);
      if (result.firstJoin && backendActiveWorkspaceId) {
        pendingAdoptWorkspaceId = backendActiveWorkspaceId;
        tryAdoptPendingWorkspace();
      }
      logger.info(SCOPE, `joined backend Org ${org.id} — its workspaces will sync down`);
    },
  });

  return {
    initiator,
    tryAdoptPendingWorkspace,
    isBackendEvicting: () => isBackendEvictingReason(lastRejectReason),
  };
}
