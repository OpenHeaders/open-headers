/**
 * Renderer-side MQTT response-example sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror} — parallel to
 * {@link ws-response-example-sync-mirror}. Examples are frozen flat
 * records so there are no set-modeled paths to enumerate.
 */

import { MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { MqttResponseExample } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { callSnapshotRpc } from './snapshot-rpc';

export interface MqttResponseExampleMirrorEntry {
  mqttResponseExample: MqttResponseExample;
}

export type MqttResponseExampleMirrorListener = (uid: string) => void;

export interface MqttResponseExampleSyncMirror {
  getMqttResponseExampleMirror(uid: string): MqttResponseExampleMirrorEntry | null;
  listMqttResponseExamples(): MqttResponseExample[];
  /** Examples under one MQTT request, capture order (oldest first). */
  listMqttResponseExamplesForRequest(mqttRequestUid: string): MqttResponseExample[];
  subscribeMqttResponseExampleMirror(uid: string, listener: MqttResponseExampleMirrorListener): () => void;
  subscribeAny(listener: MqttResponseExampleMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateMqttResponseExampleSyncMirrorOptions = CreateFlatMirrorOptions;

export function createMqttResponseExampleSyncMirror(
  workspaceId: string,
  options: CreateMqttResponseExampleSyncMirrorOptions = {},
): MqttResponseExampleSyncMirror {
  const core = createFlatEntityMirror<MqttResponseExampleMirrorEntry>(
    {
      loggerTag: 'MqttResponseExampleSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, mqttResponseExamplePostState } = event;
        if (!mqttResponseExamplePostState && envelope.body.type !== MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!mqttResponseExamplePostState) return { uid, entry: null };
        return { uid, entry: { mqttResponseExample: mqttResponseExamplePostState.mqttResponseExample } };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotMqttResponseExamples', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.mqttResponseExample.uid,
          entry: { mqttResponseExample: e.mqttResponseExample },
        }));
      },
    },
    options,
  );
  const list = () => core.list().map((e) => e.mqttResponseExample);
  return {
    getMqttResponseExampleMirror: core.get,
    listMqttResponseExamples: list,
    listMqttResponseExamplesForRequest: (mqttRequestUid) =>
      list()
        .filter((e) => e.mqttRequestUid === mqttRequestUid)
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    subscribeMqttResponseExampleMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const mqttResponseExampleSyncMirrorRegistry = createWorkspaceMirrorRegistry<MqttResponseExampleSyncMirror>(
  (workspaceId) => createMqttResponseExampleSyncMirror(workspaceId),
);

export function getMqttResponseExampleSyncMirrorForWorkspace(workspaceId: string): MqttResponseExampleSyncMirror {
  return mqttResponseExampleSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeMqttResponseExampleSyncMirrorForWorkspace(workspaceId: string): void {
  mqttResponseExampleSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllMqttResponseExampleSyncMirrors(): void {
  mqttResponseExampleSyncMirrorRegistry.disposeAll();
}
