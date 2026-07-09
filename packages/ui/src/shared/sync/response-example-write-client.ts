/**
 * Renderer-side imperative entry point for response-example writes.
 *
 * Mirrors `script-package-write-client`: write sites build a
 * `MutationBatch` via the shared catalog factories and fire
 * `oh.sync.apply` directly — no SW round-trip per write.
 *
 * Examples are frozen snapshots, so the write surface is deliberately
 * narrow: create (each "Save Response" mints a new example), rename,
 * duplicate (fresh create from an existing capture), and delete. The
 * captured `request` / `response` blocks are never patchable.
 */

import {
  buildAddResponseExampleBatch,
  buildDeleteResponseExampleBatch,
  buildRenameResponseExampleBatch,
} from '@openheaders/core/sync-builders/mutations/response-example-mutations';
import type { ResponseExample } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  getResponseExampleSyncMirrorForWorkspace,
  type ResponseExampleSyncMirror,
} from '../../context/mirrors/response-example-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type ResponseExampleMutationResult =
  | { ok: true; responseExample: ResponseExample }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type ResponseExampleSimpleResult = SyncSimpleResult;

export interface ResponseExampleWriteOptions extends BaseSyncWriteOptions {
  mirror?: ResponseExampleSyncMirror;
}

/**
 * Next free example name under a request: `<base>`, then `<base> 2`,
 * `<base> 3`, … — repeated "Save Response" clicks stack distinctly-
 * named siblings without prompting.
 */
export function nextExampleName(mirror: ResponseExampleSyncMirror, requestUid: string, base: string): string {
  const taken = new Set(mirror.listResponseExamplesForRequest(requestUid).map((e) => e.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export interface ResponseExampleCreateRequest {
  /** Parent request's `path` — the example nests under `<requestPath>/examples/…`. */
  requestPath: string;
  /** Full example minus identity (`uid`/`path`/`schemaVersion` are minted here). */
  example: Omit<ResponseExample, 'uid' | 'path' | 'schemaVersion'>;
}

export async function applyResponseExampleCreate(
  request: ResponseExampleCreateRequest,
  opts: ResponseExampleWriteOptions,
): Promise<ResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const uid = generateUid();
  const created: ResponseExample = {
    ...request.example,
    schemaVersion: 5 as const,
    uid,
    path: `${request.requestPath}/examples/${toFolderName(request.example.name, uid)}`,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddResponseExampleBatch(created, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, responseExample: created };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyResponseExampleRename(
  exampleUid: string,
  name: string,
  opts: ResponseExampleWriteOptions,
): Promise<ResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildRenameResponseExampleBatch(exampleUid, { name }, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, responseExample: { ...entry.responseExample, name } };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Fresh create from an existing capture — same content, new identity. */
export async function applyResponseExampleDuplicate(
  exampleUid: string,
  opts: ResponseExampleWriteOptions,
): Promise<ResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const source = entry.responseExample;
  const name = nextExampleName(mirror, source.requestUid, source.name);
  const requestPath = source.path.slice(0, source.path.indexOf('/examples/'));
  return applyResponseExampleCreate(
    {
      requestPath,
      example: {
        requestUid: source.requestUid,
        name,
        capturedAt: source.capturedAt,
        request: source.request,
        response: source.response,
      },
    },
    opts,
  );
}

export async function applyResponseExampleDelete(
  exampleUid: string,
  opts: ResponseExampleWriteOptions,
): Promise<ResponseExampleSimpleResult> {
  const mirror = resolveMirror(opts, getResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getResponseExampleMirror(exampleUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteResponseExampleBatch(exampleUid, ctx);
  return applySyncPayload(payload);
}
