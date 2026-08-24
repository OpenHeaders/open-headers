/**
 * Renderer-side imperative entry point for MqttRequest writes.
 *
 * Mirrors {@link websocket-request-write-client}: write sites build a
 * `MutationBatch` against the active MQTT-request mirror and fire
 * `oh.sync.apply` directly — no SW round-trip per write. The
 * synchronous-render discipline (§19.4) lives in the editor; this
 * helper is what it reaches for once the user commits.
 */

import {
  MQTT_REQUEST_SAVED_MESSAGES_PATH,
  MQTT_REQUEST_TOPICS_PATH,
  MQTT_REQUEST_USER_PROPERTIES_PATH,
} from '@openheaders/core/sync';
import {
  buildMqttAddBatch,
  buildMqttDeleteBatch,
  buildMqttUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/mqtt-request-mutations';
import type { MqttRequest } from '@openheaders/core/types';
import {
  getMqttRequestSyncMirrorForWorkspace,
  type MqttRequestSyncMirror,
} from '../../context/mirrors/mqtt-request-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type MqttRequestUpdates = Partial<Omit<MqttRequest, 'uid' | 'path' | 'schemaVersion'>>;

export type MqttRequestMutationResult =
  | { ok: true; mqttRequest: MqttRequest }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type MqttRequestSimpleResult = SyncSimpleResult;

export interface MqttRequestWriteOptions extends BaseSyncWriteOptions {
  /** Override the singleton mirror for tests. */
  mirror?: MqttRequestSyncMirror;
}

/**
 * Apply a partial MqttRequest patch through the local oracle. Returns
 * `{ ok: true, mqttRequest }` with an optimistic merge of `updates`
 * into the mirror's pre-image.
 */
export async function applyMqttRequestUpdate(
  mqttRequestUid: string,
  updates: MqttRequestUpdates,
  opts: MqttRequestWriteOptions,
): Promise<MqttRequestMutationResult> {
  const mirror = resolveMirror(opts, getMqttRequestSyncMirrorForWorkspace);
  // Hydration must complete before the mirror read — see
  // {@link applyRequestUpdate} for the fresh-boot race this closes.
  await mirror.hydrated;
  const entry = mirror.getMqttRequestMirror(mqttRequestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildMqttUpdateBatch(
    mqttRequestUid,
    updates,
    ctx,
    (uid, path) => {
      const orderKeys = mirror.liveOrderedSetItems(uid, path);
      if (orderKeys.length === 0) return [];
      const snap = mirror.getMqttRequestMirror(uid)?.mqttRequest;
      const rows =
        snap && path === MQTT_REQUEST_TOPICS_PATH
          ? snap.topics
          : snap && path === MQTT_REQUEST_SAVED_MESSAGES_PATH
            ? snap.savedMessages
            : snap && path === MQTT_REQUEST_USER_PROPERTIES_PATH
              ? snap.userProperties
              : undefined;
      if (!rows) return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: undefined }));
      const byUid = new Map<string, unknown>();
      for (const row of rows) byUid.set(row.uid, row);
      return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: byUid.get(e.itemId) }));
    },
    // Baseline for the publishProperties / lastWill / specLink per-leaf flatten-diff.
    (uid, path) => {
      const snap = mirror.getMqttRequestMirror(uid)?.mqttRequest;
      if (!snap) return undefined;
      if (path === 'publishProperties') return snap.publishProperties;
      if (path === 'lastWill') return snap.lastWill;
      if (path === 'specLink') return snap.specLink;
      return undefined;
    },
  );
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, mqttRequest: { ...entry.mqttRequest, ...updates } as MqttRequest };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Seed a brand-new MQTT request through the oracle. Caller mints the
 *  full `MqttRequest` shape; the helper handles the create + per-row
 *  addToSet envelopes via the projection layer. */
export async function applyMqttRequestCreate(
  request: MqttRequest,
  opts: MqttRequestWriteOptions,
): Promise<MqttRequestSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildMqttAddBatch(request, ctx);
  return applySyncPayload(payload);
}

export async function applyMqttRequestDelete(
  mqttRequestUid: string,
  opts: MqttRequestWriteOptions,
): Promise<MqttRequestSimpleResult> {
  const mirror = resolveMirror(opts, getMqttRequestSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getMqttRequestMirror(mqttRequestUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildMqttDeleteBatch(mqttRequestUid, ctx);
  return applySyncPayload(payload);
}
