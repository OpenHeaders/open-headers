/**
 * Request-tree mirror fakes for the renderer write-client suites: the
 * two container mirrors carry live slots per set path (what a cascade
 * walks), the four leaf mirrors carry `uid → path` entries (what a
 * cascade resolves a slot's kind against).
 */

import type { MutationBatch } from '@openheaders/core/sync';
import type { RequestCollectionSyncMirror, RequestFolderSyncMirror, RequestSyncMirror } from '@openheaders/ui/context';
import type { GrpcRequestSyncMirror } from '@openheaders/ui/context/mirrors/grpc-request-sync-mirror';
import type { MqttRequestSyncMirror } from '@openheaders/ui/context/mirrors/mqtt-request-sync-mirror';
import type { WebSocketRequestSyncMirror } from '@openheaders/ui/context/mirrors/websocket-request-sync-mirror';
import type { Mock } from 'vitest';

/** Live slots per container uid per set path. */
export type Slots = Record<string, Record<string, string[]>>;

export const slotReader =
  (slots: Slots) =>
  (uid: string, setPath: string): Array<{ itemId: string; orderKey: string }> =>
    (slots[uid]?.[setPath] ?? []).map((itemId, index) => ({ itemId, orderKey: `k${index}` }));

export function makeRequestCollectionMirror(
  collections: Array<{ uid: string; path: string; name: string }> = [],
  slots: Slots = {},
): RequestCollectionSyncMirror {
  const entries = collections.map((c) => ({
    schemaVersion: 5 as const,
    uid: c.uid,
    path: c.path,
    name: c.name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }));
  return {
    getRequestCollectionMirror: (uid) => {
      const collection = entries.find((c) => c.uid === uid);
      return collection ? { collection, varUids: [], setOrderKeys: {} } : null;
    },
    listRequestCollections: () => entries,
    liveOrderedSetItems: slotReader(slots),
    subscribeRequestCollectionMirror: () => () => undefined,
    subscribeAny: () => () => undefined,
    hydrated: Promise.resolve(),
    dispose: () => undefined,
  };
}

export function makeRequestFolderMirror(
  folders: Array<{ uid: string; path: string }> = [],
  slots: Slots = {},
): RequestFolderSyncMirror {
  const entries = folders.map((f) => ({ schemaVersion: 5 as const, uid: f.uid, path: f.path, name: f.uid }));
  return {
    getRequestFolderMirror: (uid) => {
      const folder = entries.find((f) => f.uid === uid);
      return folder ? { folder, setOrderKeys: {} } : null;
    },
    listRequestFolders: () => entries,
    liveOrderedSetItems: slotReader(slots),
    subscribeRequestFolderMirror: () => () => undefined,
    subscribeAny: () => () => undefined,
    hydrated: Promise.resolve(),
    dispose: () => undefined,
  };
}

/** A leaf mirror of one kind: the given `uid → path` entries live. */
function leafMirror(leaves: Record<string, string>) {
  const list = () => Object.entries(leaves).map(([uid, path]) => ({ schemaVersion: 5 as const, uid, path, name: uid }));
  const get = (uid: string) => (uid in leaves ? { setItemIds: {}, setOrderKeys: {} } : null);
  return {
    list,
    get,
    liveSetItems: () => [],
    liveOrderedSetItems: () => [],
    subscribeAny: () => () => undefined,
    hydrated: Promise.resolve(),
    dispose: () => undefined,
  };
}

export interface LeafEntries {
  http?: Record<string, string>;
  grpc?: Record<string, string>;
  ws?: Record<string, string>;
  mqtt?: Record<string, string>;
}

export function makeRequestLeafMirrors(leaves: LeafEntries) {
  const http = leafMirror(leaves.http ?? {});
  const grpc = leafMirror(leaves.grpc ?? {});
  const ws = leafMirror(leaves.ws ?? {});
  const mqtt = leafMirror(leaves.mqtt ?? {});
  return {
    requestMirror: {
      ...http,
      getRequestMirror: (uid: string) =>
        http.get(uid) && { request: http.list().find((r) => r.uid === uid), ...http.get(uid) },
      listRequests: http.list,
      subscribeRequestMirror: () => () => undefined,
    } as unknown as RequestSyncMirror,
    grpcMirror: {
      ...grpc,
      getGrpcRequestMirror: (uid: string) =>
        grpc.get(uid) && { grpcRequest: grpc.list().find((r) => r.uid === uid), ...grpc.get(uid) },
      listGrpcRequests: grpc.list,
      subscribeGrpcRequestMirror: () => () => undefined,
    } as unknown as GrpcRequestSyncMirror,
    websocketMirror: {
      ...ws,
      getWebSocketRequestMirror: (uid: string) =>
        ws.get(uid) && { websocketRequest: ws.list().find((r) => r.uid === uid), ...ws.get(uid) },
      listWebSocketRequests: ws.list,
      subscribeWebSocketRequestMirror: () => () => undefined,
    } as unknown as WebSocketRequestSyncMirror,
    mqttMirror: {
      ...mqtt,
      getMqttRequestMirror: (uid: string) =>
        mqtt.get(uid) && { mqttRequest: mqtt.list().find((r) => r.uid === uid), ...mqtt.get(uid) },
      listMqttRequests: mqtt.list,
      subscribeMqttRequestMirror: () => () => undefined,
    } as unknown as MqttRequestSyncMirror,
  };
}

/** The `(kind, type, id)` of the last body of every batch the bridge saw, in order. */
export function lastBodiesSeen(mockCall: Mock): Array<{ kind: string; type: string; id: string }> {
  return mockCall.mock.calls.map((call) => {
    const batch = (call[1] as { batch: MutationBatch }).batch;
    const body = batch.mutations[batch.mutations.length - 1].body;
    return { kind: body.kind, type: body.type, id: body.id };
  });
}
