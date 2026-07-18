/**
 * Renderer-side imperative entry point for WebSocket response-example
 * writes — the {@link grpc-response-example-write-client} sibling for
 * the WebSocketRequest family.
 *
 * Write surface: create (each "Save Response" mints a new example),
 * rename, content update (the captured `request` / `response` blocks
 * patch as whole LWW values), duplicate (fresh create from an existing
 * capture), and delete.
 */

import {
  buildAddWsResponseExampleBatch,
  buildDeleteWsResponseExampleBatch,
  buildRenameWsResponseExampleBatch,
  buildUpdateWsResponseExampleBatch,
  type WsResponseExampleContentUpdates,
} from '@openheaders/core/sync-builders/mutations/ws-response-example-mutations';
import type { WsResponseExample } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  getWsResponseExampleSyncMirrorForWorkspace,
  type WsResponseExampleSyncMirror,
} from '../../context/mirrors/ws-response-example-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type WsResponseExampleMutationResult =
  | { ok: true; wsResponseExample: WsResponseExample }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type WsResponseExampleSimpleResult = SyncSimpleResult;

export interface WsResponseExampleWriteOptions extends BaseSyncWriteOptions {
  mirror?: WsResponseExampleSyncMirror;
}

/**
 * Next free example name under a WebSocket request: `<base>`, then
 * `<base> 2`, `<base> 3`, … — repeated "Save Response" clicks stack
 * distinctly-named siblings without prompting.
 */
export function nextWsExampleName(
  mirror: WsResponseExampleSyncMirror,
  websocketRequestUid: string,
  base: string,
): string {
  const taken = new Set(mirror.listWsResponseExamplesForRequest(websocketRequestUid).map((e) => e.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export interface WsResponseExampleCreateRequest {
  /** Parent WebSocket request's `path` — the example nests under `<websocketRequestPath>/examples/…`. */
  websocketRequestPath: string;
  /** Full example minus identity (`uid`/`path`/`schemaVersion` are minted here). */
  example: Omit<WsResponseExample, 'uid' | 'path' | 'schemaVersion'>;
}

export async function applyWsResponseExampleCreate(
  request: WsResponseExampleCreateRequest,
  opts: WsResponseExampleWriteOptions,
): Promise<WsResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getWsResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const uid = generateUid();
  const created: WsResponseExample = {
    ...request.example,
    schemaVersion: 5 as const,
    uid,
    path: `${request.websocketRequestPath}/examples/${toFolderName(request.example.name, uid)}`,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddWsResponseExampleBatch(created, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, wsResponseExample: created };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyWsResponseExampleRename(
  exampleUid: string,
  name: string,
  opts: WsResponseExampleWriteOptions,
): Promise<WsResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getWsResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getWsResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildRenameWsResponseExampleBatch(exampleUid, { name }, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, wsResponseExample: { ...entry.wsResponseExample, name } };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Patch the captured `request` / `response` blocks (whole-block LWW). */
export async function applyWsResponseExampleUpdate(
  exampleUid: string,
  updates: WsResponseExampleContentUpdates,
  opts: WsResponseExampleWriteOptions,
): Promise<WsResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getWsResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getWsResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateWsResponseExampleBatch(exampleUid, updates, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, wsResponseExample: { ...entry.wsResponseExample, ...updates } };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Fresh create from an existing capture — same content, new identity. */
export async function applyWsResponseExampleDuplicate(
  exampleUid: string,
  opts: WsResponseExampleWriteOptions,
): Promise<WsResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getWsResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getWsResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const source = entry.wsResponseExample;
  const name = nextWsExampleName(mirror, source.websocketRequestUid, source.name);
  const websocketRequestPath = source.path.slice(0, source.path.indexOf('/examples/'));
  return applyWsResponseExampleCreate(
    {
      websocketRequestPath,
      example: {
        websocketRequestUid: source.websocketRequestUid,
        name,
        capturedAt: source.capturedAt,
        request: source.request,
        response: source.response,
      },
    },
    opts,
  );
}

export async function applyWsResponseExampleDelete(
  exampleUid: string,
  opts: WsResponseExampleWriteOptions,
): Promise<WsResponseExampleSimpleResult> {
  const mirror = resolveMirror(opts, getWsResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getWsResponseExampleMirror(exampleUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteWsResponseExampleBatch(exampleUid, ctx);
  return applySyncPayload(payload);
}
