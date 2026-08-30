/**
 * Request-tree mirror fakes for the renderer write-client suites: the
 * two container mirrors carry live slots per set path (what a cascade
 * walks), the four leaf mirrors carry `uid → path` entries (what a
 * cascade resolves a slot's kind against).
 */

import { type MutationBatch, REQUEST_EXAMPLES_PATH } from '@openheaders/core/sync';
import type { RequestCollectionSyncMirror, RequestFolderSyncMirror, RequestSyncMirror } from '@openheaders/ui/context';
import type { GrpcRequestSyncMirror } from '@openheaders/ui/context/mirrors/grpc-request-sync-mirror';
import type { GrpcResponseExampleSyncMirror } from '@openheaders/ui/context/mirrors/grpc-response-example-sync-mirror';
import type { MqttRequestSyncMirror } from '@openheaders/ui/context/mirrors/mqtt-request-sync-mirror';
import type { MqttResponseExampleSyncMirror } from '@openheaders/ui/context/mirrors/mqtt-response-example-sync-mirror';
import type { ResponseExampleSyncMirror } from '@openheaders/ui/context/mirrors/response-example-sync-mirror';
import type { WebSocketRequestSyncMirror } from '@openheaders/ui/context/mirrors/websocket-request-sync-mirror';
import type { WsResponseExampleSyncMirror } from '@openheaders/ui/context/mirrors/ws-response-example-sync-mirror';
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

/** Example uids slotted per request uid at the request's `examples` path. */
export type ExampleSlots = Record<string, string[]>;

/** A leaf mirror of one kind: the given `uid → path` entries live, with their `examples` slots. */
function leafMirror(leaves: Record<string, string>, exampleSlots: ExampleSlots) {
  const list = () => Object.entries(leaves).map(([uid, path]) => ({ schemaVersion: 5 as const, uid, path, name: uid }));
  const get = (uid: string) => (uid in leaves ? { setItemIds: {}, setOrderKeys: {} } : null);
  return {
    list,
    get,
    liveSetItems: () => [],
    liveOrderedSetItems: (uid: string, setPath: string) =>
      setPath === REQUEST_EXAMPLES_PATH
        ? (exampleSlots[uid] ?? []).map((itemId, index) => ({ itemId, orderKey: `k${index}` }))
        : [],
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

export function makeRequestLeafMirrors(leaves: LeafEntries, exampleSlots: ExampleSlots = {}) {
  const http = leafMirror(leaves.http ?? {}, exampleSlots);
  const grpc = leafMirror(leaves.grpc ?? {}, exampleSlots);
  const ws = leafMirror(leaves.ws ?? {}, exampleSlots);
  const mqtt = leafMirror(leaves.mqtt ?? {}, exampleSlots);
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

/** Example entries per kind: `exampleUid → parent request uid` (the stored parent field). */
export interface ExampleEntries {
  http?: Record<string, string>;
  grpc?: Record<string, string>;
  ws?: Record<string, string>;
  mqtt?: Record<string, string>;
}

/** An example mirror of one kind over `uid → parentUid` entries; `field` is the kind's parent-uid field. */
function exampleMirror(examples: Record<string, string>, field: string) {
  const entries = Object.entries(examples).map(([uid, parentUid]) => ({
    schemaVersion: 5,
    uid,
    name: uid,
    [field]: parentUid,
  }));
  return {
    list: () => entries,
    get: (uid: string) => entries.find((e) => e.uid === uid) ?? null,
    forRequest: (parentUid: string) => entries.filter((e) => e[field] === parentUid),
    subscribeAny: () => () => undefined,
    hydrated: Promise.resolve(),
    dispose: () => undefined,
  };
}

export function makeRequestExampleMirrors(examples: ExampleEntries) {
  const http = exampleMirror(examples.http ?? {}, 'requestUid');
  const grpc = exampleMirror(examples.grpc ?? {}, 'grpcRequestUid');
  const ws = exampleMirror(examples.ws ?? {}, 'websocketRequestUid');
  const mqtt = exampleMirror(examples.mqtt ?? {}, 'mqttRequestUid');
  return {
    responseExampleMirror: {
      ...http,
      getResponseExampleMirror: (uid: string) => {
        const responseExample = http.get(uid);
        return responseExample ? { responseExample } : null;
      },
      listResponseExamples: http.list,
      listResponseExamplesForRequest: http.forRequest,
      subscribeResponseExampleMirror: () => () => undefined,
    } as unknown as ResponseExampleSyncMirror,
    grpcExampleMirror: {
      ...grpc,
      getGrpcResponseExampleMirror: (uid: string) => {
        const grpcResponseExample = grpc.get(uid);
        return grpcResponseExample ? { grpcResponseExample } : null;
      },
      listGrpcResponseExamples: grpc.list,
      listGrpcResponseExamplesForRequest: grpc.forRequest,
      subscribeGrpcResponseExampleMirror: () => () => undefined,
    } as unknown as GrpcResponseExampleSyncMirror,
    wsExampleMirror: {
      ...ws,
      getWsResponseExampleMirror: (uid: string) => {
        const wsResponseExample = ws.get(uid);
        return wsResponseExample ? { wsResponseExample } : null;
      },
      listWsResponseExamples: ws.list,
      listWsResponseExamplesForRequest: ws.forRequest,
      subscribeWsResponseExampleMirror: () => () => undefined,
    } as unknown as WsResponseExampleSyncMirror,
    mqttExampleMirror: {
      ...mqtt,
      getMqttResponseExampleMirror: (uid: string) => {
        const mqttResponseExample = mqtt.get(uid);
        return mqttResponseExample ? { mqttResponseExample } : null;
      },
      listMqttResponseExamples: mqtt.list,
      listMqttResponseExamplesForRequest: mqtt.forRequest,
      subscribeMqttResponseExampleMirror: () => () => undefined,
    } as unknown as MqttResponseExampleSyncMirror,
  };
}

/** The `(kind, type, id)` of the last body of every batch the bridge saw, in order. */
export function lastBodiesSeen(mockCall: Mock): Array<{ kind: string; type: string; id: string }> {
  return mockCall.mock.calls.map((call) => {
    const batch = (call[1] as { batch: MutationBatch } | undefined)?.batch;
    if (!batch) throw new Error(`bridge call ${String(call[0])} is not an apply — a mirror singleton was reached`);
    const body = batch.mutations[batch.mutations.length - 1].body;
    return { kind: body.kind, type: body.type, id: body.id };
  });
}
