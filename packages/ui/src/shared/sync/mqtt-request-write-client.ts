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
  MQTT_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_SAVED_MESSAGES_PATH,
  MQTT_REQUEST_TOPICS_PATH,
  MQTT_REQUEST_USER_PROPERTIES_PATH,
} from '@openheaders/core/sync';
import {
  buildMqttAddBatch,
  buildMqttDeleteBatch,
  buildMqttDeleteEntityBatch,
  buildMqttUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/mqtt-request-mutations';
import type { MqttRequest } from '@openheaders/core/types';
import { parentPathOf } from '@openheaders/core/utils';
import {
  getMqttRequestSyncMirrorForWorkspace,
  type MqttRequestSyncMirror,
} from '../../context/mirrors/mqtt-request-sync-mirror';
import type { MqttResponseExampleSyncMirror } from '../../context/mirrors/mqtt-response-example-sync-mirror';
import type { RequestCollectionSyncMirror } from '../../context/mirrors/request-collection-sync-mirror';
import type { RequestFolderSyncMirror } from '../../context/mirrors/request-folder-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import { applyRequestExampleDeletes, requestExamples } from './tree-descendants';
import { requestTreeMirrors, resolveChildPlacement, resolveLeafParent, unresolvableParent } from './tree-placement';

export type MqttRequestUpdates = Partial<Omit<MqttRequest, 'uid' | 'path' | 'pathSegment' | 'schemaVersion'>>;

export type MqttRequestMutationResult =
  | { ok: true; mqttRequest: MqttRequest }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type MqttRequestSimpleResult = SyncSimpleResult;

export interface MqttRequestWriteOptions extends BaseSyncWriteOptions {
  /** Override the singleton mirror for tests. */
  mirror?: MqttRequestSyncMirror;
  /** Override the parent-resolving container mirrors for tests. */
  collectionMirror?: RequestCollectionSyncMirror;
  folderMirror?: RequestFolderSyncMirror;
  /** Override the response-example mirror the delete cascade reads (tests). */
  exampleMirror?: MqttResponseExampleSyncMirror;
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

/**
 * Seed a brand-new MQTT request through the oracle. Caller mints the
 * full `MqttRequest` shape; the helper resolves the parent from the
 * request's path (its `items` slot rides the create batch) and handles
 * the per-row addToSet envelopes via the projection layer. An
 * unplaceable parent fails the create.
 */
export async function applyMqttRequestCreate(
  request: MqttRequest,
  opts: MqttRequestWriteOptions,
): Promise<MqttRequestSimpleResult> {
  const parentPath = parentPathOf(request.path) ?? '';
  const placement = await resolveChildPlacement(requestTreeMirrors(opts.workspaceId, opts), parentPath);
  if (!placement) return unresolvableParent(parentPath);
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildMqttAddBatch(request, ctx, placement);
  return applySyncPayload(payload);
}

/**
 * Delete an MQTT request: its parent's `items` slot tombstones in the
 * same batch as the entity; an unresolvable parent (already tombstoned)
 * falls back to the bare entity tombstone.
 */
export async function applyMqttRequestDelete(
  mqttRequestUid: string,
  opts: MqttRequestWriteOptions,
): Promise<MqttRequestSimpleResult> {
  const mirror = resolveMirror(opts, getMqttRequestSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getMqttRequestMirror(mqttRequestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  // Cascade: the request's examples go first (`tree-descendants.ts`).
  const examples = await requestExamples(
    opts.workspaceId,
    { mqttMirror: mirror, mqttExampleMirror: opts.exampleMirror },
    { type: MQTT_REQUEST_ENTITY_TYPE, uid: mqttRequestUid },
  );
  const handle = resolveRendererContext(opts);
  const cascade = await applyRequestExampleDeletes(examples, handle, `request-delete-cascade-${mqttRequestUid}`);
  if (!cascade.ok) return cascade;
  const parent = await resolveLeafParent(requestTreeMirrors(opts.workspaceId, opts), entry.mqttRequest.path);
  const ctx = handle.next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(
    parent ? buildMqttDeleteBatch(mqttRequestUid, parent, ctx) : buildMqttDeleteEntityBatch(mqttRequestUid, ctx),
  );
}
