/**
 * Renderer-side MqttRequest sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror} — parallel to
 * {@link websocket-request-sync-mirror}. Renderer write helpers consult
 * this mirror to read the canonical MQTT-request shape synchronously
 * (§19.4) and enumerate live `(itemId, orderKey)` pairs at the
 * set-modeled `topics` / `savedMessages` / `userProperties` paths.
 */

import { MQTT_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { MqttRequest } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { callSnapshotRpc } from './snapshot-rpc';

export interface MqttRequestMirrorEntry {
  mqttRequest: MqttRequest;
  /** Map keyed by set path (`topics`, `savedMessages`, `userProperties`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for `moveBefore` writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type MqttRequestMirrorListener = (uid: string) => void;

export interface MqttRequestSyncMirror {
  getMqttRequestMirror(uid: string): MqttRequestMirrorEntry | null;
  listMqttRequests(): MqttRequest[];
  liveSetItems(uid: string, setPath: string): string[];
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeMqttRequestMirror(uid: string, listener: MqttRequestMirrorListener): () => void;
  subscribeAny(listener: MqttRequestMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateMqttRequestSyncMirrorOptions = CreateFlatMirrorOptions;

export function createMqttRequestSyncMirror(
  workspaceId: string,
  options: CreateMqttRequestSyncMirrorOptions = {},
): MqttRequestSyncMirror {
  const core = createFlatEntityMirror<MqttRequestMirrorEntry>(
    {
      loggerTag: 'MqttRequestSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, mqttRequestPostState } = event;
        // A non-MqttRequest broadcast arrives with the post-state
        // undefined; ignore it so it doesn't tombstone an unrelated
        // entry. Type-matching tombstone (post-state absent on an
        // MqttRequest envelope) drops the entry.
        if (!mqttRequestPostState && envelope.body.type !== MQTT_REQUEST_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!mqttRequestPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            mqttRequest: mqttRequestPostState.mqttRequest,
            setItemIds: mqttRequestPostState.setItemIds,
            setOrderKeys: mqttRequestPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotMqttRequests', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.mqttRequest.uid,
          entry: {
            mqttRequest: e.mqttRequest,
            setItemIds: e.setItemIds,
            setOrderKeys: e.setOrderKeys,
          },
        }));
      },
    },
    options,
  );
  return {
    getMqttRequestMirror: core.get,
    listMqttRequests: () =>
      core
        .list()
        .map((e) => e.mqttRequest)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveSetItems: (uid, setPath) => core.get(uid)?.setItemIds[setPath] ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeMqttRequestMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const mqttRequestSyncMirrorRegistry = createWorkspaceMirrorRegistry<MqttRequestSyncMirror>((workspaceId) =>
  createMqttRequestSyncMirror(workspaceId),
);

export function getMqttRequestSyncMirrorForWorkspace(workspaceId: string): MqttRequestSyncMirror {
  return mqttRequestSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeMqttRequestSyncMirrorForWorkspace(workspaceId: string): void {
  mqttRequestSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllMqttRequestSyncMirrors(): void {
  mqttRequestSyncMirrorRegistry.disposeAll();
}
