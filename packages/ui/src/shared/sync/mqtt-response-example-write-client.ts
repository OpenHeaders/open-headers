/**
 * Renderer-side imperative entry point for MQTT response-example
 * writes — the {@link ws-response-example-write-client} sibling for
 * the MqttRequest family.
 *
 * Write surface: create (each "Save Response" mints a new example),
 * rename, content update (the captured `request` / `response` blocks
 * patch as whole LWW values), duplicate (fresh create from an existing
 * capture), and delete.
 */

import {
  buildAddMqttResponseExampleBatch,
  buildDeleteMqttResponseExampleBatch,
  buildRenameMqttResponseExampleBatch,
  buildUpdateMqttResponseExampleBatch,
  type MqttResponseExampleContentUpdates,
} from '@openheaders/core/sync-builders/mutations/mqtt-response-example-mutations';
import type { MqttResponseExample } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  getMqttResponseExampleSyncMirrorForWorkspace,
  type MqttResponseExampleSyncMirror,
} from '../../context/mirrors/mqtt-response-example-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type MqttResponseExampleMutationResult =
  | { ok: true; mqttResponseExample: MqttResponseExample }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type MqttResponseExampleSimpleResult = SyncSimpleResult;

export interface MqttResponseExampleWriteOptions extends BaseSyncWriteOptions {
  mirror?: MqttResponseExampleSyncMirror;
}

/**
 * Next free example name under an MQTT request: `<base>`, then
 * `<base> 2`, `<base> 3`, … — repeated "Save Response" clicks stack
 * distinctly-named siblings without prompting.
 */
export function nextMqttExampleName(
  mirror: MqttResponseExampleSyncMirror,
  mqttRequestUid: string,
  base: string,
): string {
  const taken = new Set(mirror.listMqttResponseExamplesForRequest(mqttRequestUid).map((e) => e.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export interface MqttResponseExampleCreateRequest {
  /** Parent MQTT request's `path` — the example nests under `<mqttRequestPath>/examples/…`. */
  mqttRequestPath: string;
  /** Full example minus identity (`uid`/`path`/`schemaVersion` are minted here). */
  example: Omit<MqttResponseExample, 'uid' | 'path' | 'schemaVersion'>;
}

export async function applyMqttResponseExampleCreate(
  request: MqttResponseExampleCreateRequest,
  opts: MqttResponseExampleWriteOptions,
): Promise<MqttResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getMqttResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const uid = generateUid();
  const created: MqttResponseExample = {
    ...request.example,
    schemaVersion: 5 as const,
    uid,
    path: `${request.mqttRequestPath}/examples/${toFolderName(request.example.name, uid)}`,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddMqttResponseExampleBatch(created, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, mqttResponseExample: created };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyMqttResponseExampleRename(
  exampleUid: string,
  name: string,
  opts: MqttResponseExampleWriteOptions,
): Promise<MqttResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getMqttResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getMqttResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildRenameMqttResponseExampleBatch(exampleUid, { name }, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, mqttResponseExample: { ...entry.mqttResponseExample, name } };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Patch the captured `request` / `response` blocks (whole-block LWW). */
export async function applyMqttResponseExampleUpdate(
  exampleUid: string,
  updates: MqttResponseExampleContentUpdates,
  opts: MqttResponseExampleWriteOptions,
): Promise<MqttResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getMqttResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getMqttResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateMqttResponseExampleBatch(exampleUid, updates, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, mqttResponseExample: { ...entry.mqttResponseExample, ...updates } };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Fresh create from an existing capture — same content, new identity. */
export async function applyMqttResponseExampleDuplicate(
  exampleUid: string,
  opts: MqttResponseExampleWriteOptions,
): Promise<MqttResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getMqttResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getMqttResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const source = entry.mqttResponseExample;
  const name = nextMqttExampleName(mirror, source.mqttRequestUid, source.name);
  const mqttRequestPath = source.path.slice(0, source.path.indexOf('/examples/'));
  return applyMqttResponseExampleCreate(
    {
      mqttRequestPath,
      example: {
        mqttRequestUid: source.mqttRequestUid,
        name,
        capturedAt: source.capturedAt,
        request: source.request,
        response: source.response,
      },
    },
    opts,
  );
}

export async function applyMqttResponseExampleDelete(
  exampleUid: string,
  opts: MqttResponseExampleWriteOptions,
): Promise<MqttResponseExampleSimpleResult> {
  const mirror = resolveMirror(opts, getMqttResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getMqttResponseExampleMirror(exampleUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteMqttResponseExampleBatch(exampleUid, ctx);
  return applySyncPayload(payload);
}
