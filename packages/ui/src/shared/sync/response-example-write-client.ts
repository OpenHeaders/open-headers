/**
 * Renderer-side imperative entry point for response-example writes.
 *
 * Mirrors `script-package-write-client`: write sites build a
 * `MutationBatch` via the shared catalog factories and fire
 * `oh.sync.apply` directly — no SW round-trip per write.
 *
 * Write surface: create (each "Save Response" mints a new example),
 * rename, content update (the captured `request` / `response` blocks
 * patch as whole LWW values — examples double as authored templates),
 * duplicate (fresh create from an existing capture), and delete.
 */

import {
  GRAPHQL_REQUEST_ENTITY_TYPE,
  GRAPHQL_REQUEST_EXAMPLES_PATH,
  keyBetween,
  REQUEST_ENTITY_TYPE,
  REQUEST_EXAMPLES_PATH,
  type ResponseExampleParentRef,
} from '@openheaders/core/sync';
import {
  buildAddResponseExampleBatch,
  buildDeleteResponseExampleBatch,
  buildRenameResponseExampleBatch,
  buildUpdateResponseExampleBatch,
  type ResponseExampleContentUpdates,
} from '@openheaders/core/sync-builders/mutations/response-example-mutations';
import type { ResponseExample } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  type GraphqlRequestSyncMirror,
  getGraphqlRequestSyncMirrorForWorkspace,
} from '../../context/mirrors/graphql-request-sync-mirror';
import { getRequestSyncMirrorForWorkspace, type RequestSyncMirror } from '../../context/mirrors/request-sync-mirror';
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
  /** Override the parent request mirror the create reads its `examples` tail from (tests). */
  requestMirror?: RequestSyncMirror;
  /** Override the GraphQL parent mirror — the `requestKind: 'graphql'` examples' holder (tests). */
  graphqlRequestMirror?: GraphqlRequestSyncMirror;
}

/** The mirror slice an example's parent is read from: live membership + the `examples` tail. */
interface ExampleParentReader {
  hydrated: Promise<void>;
  has: (uid: string) => boolean;
  liveOrderedSetItems: (uid: string, setPath: string) => Array<{ itemId: string; orderKey: string }>;
  examplesPath: string;
}

/**
 * The parent an example nests under, by kind: an HTTP request, or a
 * GraphQL request when the example carries `requestKind: 'graphql'`
 * (its send compiled to one HTTP exchange; the request holds the HTTP
 * example kind at its own `examples` path).
 */
function parentRefOf(example: Pick<ResponseExample, 'requestUid' | 'requestKind'>): ResponseExampleParentRef {
  return {
    type: example.requestKind === 'graphql' ? GRAPHQL_REQUEST_ENTITY_TYPE : REQUEST_ENTITY_TYPE,
    uid: example.requestUid,
  };
}

/** The parent kind's mirror slice a create reads (membership + the `examples` tail). */
function parentReaderFor(parent: ResponseExampleParentRef, opts: ResponseExampleWriteOptions): ExampleParentReader {
  if (parent.type === GRAPHQL_REQUEST_ENTITY_TYPE) {
    const mirror = opts.graphqlRequestMirror ?? getGraphqlRequestSyncMirrorForWorkspace(opts.workspaceId);
    return {
      hydrated: mirror.hydrated,
      has: (uid) => mirror.getGraphqlRequestMirror(uid) !== null,
      liveOrderedSetItems: mirror.liveOrderedSetItems,
      examplesPath: GRAPHQL_REQUEST_EXAMPLES_PATH,
    };
  }
  const mirror = opts.requestMirror ?? getRequestSyncMirrorForWorkspace(opts.workspaceId);
  return {
    hydrated: mirror.hydrated,
    has: (uid) => mirror.getRequestMirror(uid) !== null,
    liveOrderedSetItems: mirror.liveOrderedSetItems,
    examplesPath: REQUEST_EXAMPLES_PATH,
  };
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
  const parent = parentRefOf(request.example);
  const reader = parentReaderFor(parent, opts);
  await reader.hydrated;
  if (!reader.has(parent.uid)) return { ok: false, reason: 'not-found' };
  const uid = generateUid();
  const created: ResponseExample = {
    ...request.example,
    schemaVersion: 5 as const,
    uid,
    path: `${request.requestPath}/examples/${toFolderName(request.example.name, uid)}`,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const live = reader.liveOrderedSetItems(parent.uid, reader.examplesPath);
  const payload = buildAddResponseExampleBatch(created, ctx, {
    parent,
    orderKey: keyBetween(live.at(-1)?.orderKey ?? null, null),
  });
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

/** Patch the captured `request` / `response` blocks (whole-block LWW). */
export async function applyResponseExampleUpdate(
  exampleUid: string,
  updates: ResponseExampleContentUpdates,
  opts: ResponseExampleWriteOptions,
): Promise<ResponseExampleMutationResult> {
  const mirror = resolveMirror(opts, getResponseExampleSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateResponseExampleBatch(exampleUid, updates, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, responseExample: { ...entry.responseExample, ...updates } };
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
        ...(source.requestKind !== undefined ? { requestKind: source.requestKind } : {}),
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
  const entry = mirror.getResponseExampleMirror(exampleUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteResponseExampleBatch(exampleUid, parentRefOf(entry.responseExample), ctx);
  return applySyncPayload(payload);
}
