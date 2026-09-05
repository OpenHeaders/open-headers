/**
 * Renderer-side GraphqlRequest sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror} — parallel to
 * {@link websocket-request-sync-mirror}. Renderer write helpers consult
 * this mirror to read the canonical GraphQL-request shape synchronously
 * (§19.4) and enumerate live `(itemId, orderKey)` pairs at the
 * set-modeled `headers` path.
 */

import { GRAPHQL_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { GraphqlRequest } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { callSnapshotRpc } from './snapshot-rpc';

export interface GraphqlRequestMirrorEntry {
  graphqlRequest: GraphqlRequest;
  /** Map keyed by set path (`headers`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for `moveBefore` writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type GraphqlRequestMirrorListener = (uid: string) => void;

export interface GraphqlRequestSyncMirror {
  getGraphqlRequestMirror(uid: string): GraphqlRequestMirrorEntry | null;
  listGraphqlRequests(): GraphqlRequest[];
  liveSetItems(uid: string, setPath: string): string[];
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeGraphqlRequestMirror(uid: string, listener: GraphqlRequestMirrorListener): () => void;
  subscribeAny(listener: GraphqlRequestMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateGraphqlRequestSyncMirrorOptions = CreateFlatMirrorOptions;

export function createGraphqlRequestSyncMirror(
  workspaceId: string,
  options: CreateGraphqlRequestSyncMirrorOptions = {},
): GraphqlRequestSyncMirror {
  const core = createFlatEntityMirror<GraphqlRequestMirrorEntry>(
    {
      loggerTag: 'GraphqlRequestSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, graphqlRequestPostState } = event;
        // A non-GraphqlRequest broadcast arrives with the post-state
        // undefined; ignore it so it doesn't tombstone an unrelated
        // entry. Type-matching tombstone (post-state absent on a
        // GraphqlRequest envelope) drops the entry.
        if (!graphqlRequestPostState && envelope.body.type !== GRAPHQL_REQUEST_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!graphqlRequestPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            graphqlRequest: graphqlRequestPostState.graphqlRequest,
            setItemIds: graphqlRequestPostState.setItemIds,
            setOrderKeys: graphqlRequestPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotGraphqlRequests', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.graphqlRequest.uid,
          entry: {
            graphqlRequest: e.graphqlRequest,
            setItemIds: e.setItemIds,
            setOrderKeys: e.setOrderKeys,
          },
        }));
      },
    },
    options,
  );
  return {
    getGraphqlRequestMirror: core.get,
    listGraphqlRequests: () =>
      core
        .list()
        .map((e) => e.graphqlRequest)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveSetItems: (uid, setPath) => core.get(uid)?.setItemIds[setPath] ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeGraphqlRequestMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const graphqlRequestSyncMirrorRegistry = createWorkspaceMirrorRegistry<GraphqlRequestSyncMirror>((workspaceId) =>
  createGraphqlRequestSyncMirror(workspaceId),
);

export function getGraphqlRequestSyncMirrorForWorkspace(workspaceId: string): GraphqlRequestSyncMirror {
  return graphqlRequestSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeGraphqlRequestSyncMirrorForWorkspace(workspaceId: string): void {
  graphqlRequestSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllGraphqlRequestSyncMirrors(): void {
  graphqlRequestSyncMirrorRegistry.disposeAll();
}
