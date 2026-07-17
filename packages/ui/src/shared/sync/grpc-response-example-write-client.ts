/**
 * Renderer-side imperative entry point for gRPC response-example
 * writes — the {@link response-example-write-client} sibling for the
 * GrpcRequest family.
 *
 * Write surface: create (each "Save Response" mints a new example),
 * rename, content update (the captured `request` / `response` blocks
 * patch as whole LWW values), duplicate (fresh create from an existing
 * capture), and delete.
 */

import {
  buildAddGrpcResponseExampleBatch,
  buildDeleteGrpcResponseExampleBatch,
  buildRenameGrpcResponseExampleBatch,
  buildUpdateGrpcResponseExampleBatch,
  type GrpcResponseExampleContentUpdates,
} from '@openheaders/core/sync-builders/mutations/grpc-response-example-mutations';
import type { GrpcResponseExample } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  type GrpcResponseExampleSyncMirror,
  getGrpcResponseExampleSyncMirrorForWorkspace,
} from '../../context/mirrors/grpc-response-example-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type GrpcResponseExampleMutationResult =
  | { ok: true; grpcResponseExample: GrpcResponseExample }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type GrpcResponseExampleSimpleResult = SyncSimpleResult;

export interface GrpcResponseExampleWriteOptions extends BaseSyncWriteOptions {
  mirror?: GrpcResponseExampleSyncMirror;
}

/**
 * Next free example name under a gRPC request: `<base>`, then
 * `<base> 2`, `<base> 3`, … — repeated "Save Response" clicks stack
 * distinctly-named siblings without prompting.
 */
export function nextGrpcExampleName(
  mirror: GrpcResponseExampleSyncMirror,
  grpcRequestUid: string,
  base: string,
): string {
  const taken = new Set(mirror.listGrpcResponseExamplesForRequest(grpcRequestUid).map((e) => e.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export interface GrpcResponseExampleCreateRequest {
  /** Parent gRPC request's `path` — the example nests under `<grpcRequestPath>/examples/…`. */
  grpcRequestPath: string;
  /** Full example minus identity (`uid`/`path`/`schemaVersion` are minted here). */
  example: Omit<GrpcResponseExample, 'uid' | 'path' | 'schemaVersion'>;
}

export async function applyGrpcResponseExampleCreate(
  request: GrpcResponseExampleCreateRequest,
  opts: GrpcResponseExampleWriteOptions,
): Promise<GrpcResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getGrpcResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const uid = generateUid();
  const created: GrpcResponseExample = {
    ...request.example,
    schemaVersion: 5 as const,
    uid,
    path: `${request.grpcRequestPath}/examples/${toFolderName(request.example.name, uid)}`,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddGrpcResponseExampleBatch(created, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, grpcResponseExample: created };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyGrpcResponseExampleRename(
  exampleUid: string,
  name: string,
  opts: GrpcResponseExampleWriteOptions,
): Promise<GrpcResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getGrpcResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getGrpcResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildRenameGrpcResponseExampleBatch(exampleUid, { name }, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, grpcResponseExample: { ...entry.grpcResponseExample, name } };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Patch the captured `request` / `response` blocks (whole-block LWW). */
export async function applyGrpcResponseExampleUpdate(
  exampleUid: string,
  updates: GrpcResponseExampleContentUpdates,
  opts: GrpcResponseExampleWriteOptions,
): Promise<GrpcResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getGrpcResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getGrpcResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateGrpcResponseExampleBatch(exampleUid, updates, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, grpcResponseExample: { ...entry.grpcResponseExample, ...updates } };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Fresh create from an existing capture — same content, new identity. */
export async function applyGrpcResponseExampleDuplicate(
  exampleUid: string,
  opts: GrpcResponseExampleWriteOptions,
): Promise<GrpcResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getGrpcResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getGrpcResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const source = entry.grpcResponseExample;
  const name = nextGrpcExampleName(mirror, source.grpcRequestUid, source.name);
  const grpcRequestPath = source.path.slice(0, source.path.indexOf('/examples/'));
  return applyGrpcResponseExampleCreate(
    {
      grpcRequestPath,
      example: {
        grpcRequestUid: source.grpcRequestUid,
        name,
        capturedAt: source.capturedAt,
        request: source.request,
        response: source.response,
      },
    },
    opts,
  );
}

export async function applyGrpcResponseExampleDelete(
  exampleUid: string,
  opts: GrpcResponseExampleWriteOptions,
): Promise<GrpcResponseExampleSimpleResult> {
  const mirror = resolveMirror(opts, getGrpcResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getGrpcResponseExampleMirror(exampleUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteGrpcResponseExampleBatch(exampleUid, ctx);
  return applySyncPayload(payload);
}
