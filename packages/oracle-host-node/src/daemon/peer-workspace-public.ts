/**
 * Peer-facing public snapshot plane (the access-foundation plan §8
 * F5b) — owner self-service publish / re-publish / unpublish of the
 * read-only anonymous copy served at `/public/<workspaceId>`.
 *
 * Four channels, every one OWNER-gated on the caller's own row (the
 * F4 members-plane rule — `localAdmin` confers nothing), the identity
 * snapshot resolved fresh per frame:
 *
 *   - `getWorkspacePublicShare` — publication status: the server's
 *     `publicWorkspaces` master switch and the standing publication's
 *     timestamp + page path. Unaudited read, like the members list.
 *   - `previewWorkspacePublicShare` — the review-moment summary
 *     (decision d), computed from the exact projection a publish would
 *     store so the publisher eyeballs precisely what would ship.
 *     Unaudited read.
 *   - `publishWorkspacePublicShare` — captures the snapshot, applies
 *     the ratified content contract, and stores the publication whole
 *     (re-publish replaces in place). Refuses in-band when the master
 *     switch is off (`disabled`) or the workspace's resolved
 *     visibility is not `public` (`not-public`). Audited under
 *     `daemon.workspace-publish` — the gate decision is the audited
 *     fact, allow rows stand even when the domain then refuses (the
 *     peer-admin discipline).
 *   - `unpublishWorkspacePublicShare` — drops the stored publication;
 *     the route 404s from the next request. Audited under
 *     `daemon.workspace-unpublish`. Deliberately NOT gated on the
 *     master switch: an owner must always be able to take their
 *     workspace down.
 *
 * Serving-side gates (the switch consulted per request, anonymous
 * admission) live in `public-workspace-http.ts`; this plane is only
 * the authenticated verb surface.
 */

import { emitAuditEntry, resolveDaemonPeerIdentitySnapshot } from '@openheaders/core/identity';
import {
  buildPublicWorkspaceSnapshot,
  PUBLIC_WORKSPACE_PUBLICATION_SCHEMA_VERSION,
  type PublicWorkspacePublication,
  publicWorkspacePagePath,
  summarizePublicWorkspaceSnapshot,
} from '@openheaders/core/protocol';
import { resolveWorkspaceVisibility } from '@openheaders/core/schemas';
import { buildSnapshotForWorkspace } from '@openheaders/oracle/sync';
import { getWorkspace } from '@openheaders/oracle/workspace/extension-workspace-store';
import type { WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';
import type { SqlitePublishedSnapshotStore } from '../sync/sqlite-published-snapshots';
import { ownerGateDecision } from './peer-workspace-members';

export const GET_WORKSPACE_PUBLIC_SHARE_CHANNEL = 'getWorkspacePublicShare';
export const PREVIEW_WORKSPACE_PUBLIC_SHARE_CHANNEL = 'previewWorkspacePublicShare';
export const PUBLISH_WORKSPACE_PUBLIC_SHARE_CHANNEL = 'publishWorkspacePublicShare';
export const UNPUBLISH_WORKSPACE_PUBLIC_SHARE_CHANNEL = 'unpublishWorkspacePublicShare';

export interface PeerWorkspacePublicDeps {
  store: SqlitePublishedSnapshotStore;
  /** The `publicWorkspaces` master switch — config-as-code, fixed for the process lifetime. */
  publicWorkspacesEnabled: boolean;
}

const NOT_OWNER_REFUSAL = {
  ok: false,
  reason: 'not-owner',
  error: 'only a workspace owner can manage public sharing',
} as const;

export function createPeerWorkspacePublicRpc(deps: PeerWorkspacePublicDeps): WsPeerRpcHooks {
  return {
    owns(type: string): boolean {
      return (
        type === GET_WORKSPACE_PUBLIC_SHARE_CHANNEL ||
        type === PREVIEW_WORKSPACE_PUBLIC_SHARE_CHANNEL ||
        type === PUBLISH_WORKSPACE_PUBLIC_SHARE_CHANNEL ||
        type === UNPUBLISH_WORKSPACE_PUBLIC_SHARE_CHANNEL
      );
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      const type = message.type as string;
      const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
      if (!workspaceId) return { ok: false, error: 'missing workspaceId' };
      const snapshot = await resolveDaemonPeerIdentitySnapshot(peer.userId);
      const gate = ownerGateDecision(snapshot, workspaceId);

      if (type === PUBLISH_WORKSPACE_PUBLIC_SHARE_CHANNEL || type === UNPUBLISH_WORKSPACE_PUBLIC_SHARE_CHANNEL) {
        emitAuditEntry({
          actorUserId: peer.userId,
          capability:
            type === PUBLISH_WORKSPACE_PUBLIC_SHARE_CHANNEL ? 'daemon.workspace-publish' : 'daemon.workspace-unpublish',
          workspaceId,
          decision: gate,
        });
      }
      if (!gate.allow) return NOT_OWNER_REFUSAL;

      if (type === GET_WORKSPACE_PUBLIC_SHARE_CHANNEL) {
        const row = deps.store.get(workspaceId);
        return {
          ok: true,
          enabled: deps.publicWorkspacesEnabled,
          publishedAt: row?.publishedAt ?? null,
          ...(row !== null ? { path: publicWorkspacePagePath(workspaceId) } : {}),
        };
      }

      if (type === PREVIEW_WORKSPACE_PUBLIC_SHARE_CHANNEL) {
        const captured = await buildSnapshotForWorkspace(workspaceId);
        if (!captured) return { ok: false, error: 'workspace produced no snapshot' };
        return { ok: true, summary: summarizePublicWorkspaceSnapshot(buildPublicWorkspaceSnapshot(captured)) };
      }

      if (type === PUBLISH_WORKSPACE_PUBLIC_SHARE_CHANNEL) {
        if (!deps.publicWorkspacesEnabled) {
          return { ok: false, reason: 'disabled', error: 'public workspaces are disabled on this server' };
        }
        const workspace = getWorkspace(workspaceId);
        if (!workspace) return { ok: false, error: 'unknown workspace' };
        if (resolveWorkspaceVisibility(workspace.visibility) !== 'public') {
          return { ok: false, reason: 'not-public', error: 'set the workspace access to Public first' };
        }
        const captured = await buildSnapshotForWorkspace(workspaceId);
        if (!captured) return { ok: false, error: 'workspace produced no snapshot' };
        const publishedAt = new Date().toISOString();
        const publication: PublicWorkspacePublication = {
          schemaVersion: PUBLIC_WORKSPACE_PUBLICATION_SCHEMA_VERSION,
          publishedAt,
          workspace: {
            id: workspace.id,
            name: workspace.name,
            ...(workspace.description !== undefined ? { description: workspace.description } : {}),
            ...(workspace.color !== undefined ? { color: workspace.color } : {}),
            ...(workspace.icon !== undefined ? { icon: workspace.icon } : {}),
          },
          snapshot: buildPublicWorkspaceSnapshot(captured).snapshot,
        };
        deps.store.put({
          workspaceId,
          payloadJson: JSON.stringify(publication),
          publishedAt,
          publishedBy: peer.userId,
        });
        return { ok: true, publishedAt, path: publicWorkspacePagePath(workspaceId) };
      }

      const existed = deps.store.delete(workspaceId);
      return { ok: true, existed };
    },
  };
}
