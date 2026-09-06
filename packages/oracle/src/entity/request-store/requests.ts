// ── Requests ────────────────────────────────────────────────────────

import { RequestSchema, schemaParseError } from '@openheaders/core/schemas';
import { REQUEST_ENTITY_TYPE, REQUEST_FOLDER_ITEMS_PATH } from '@openheaders/core/sync';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildDeleteEntityBatch,
  buildUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/request-mutations';
import type { Collection, Folder, GraphqlRequest, Request } from '@openheaders/core/types';
import { generateUid, parentPathOf, toFolderName } from '@openheaders/core/utils';
import type { GraphqlRequestCache } from '@openheaders/oracle/sync/caches/graphql-request-cache';
import type { RequestCache } from '@openheaders/oracle/sync/caches/request-cache';
import type { RequestCollectionCache } from '@openheaders/oracle/sync/caches/request-collection-cache';
import type { RequestFolderCache } from '@openheaders/oracle/sync/caches/request-folder-cache';
import {
  GRAPHQL_REQUEST_REGISTRATION,
  REQUEST_COLLECTION_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  REQUEST_REGISTRATION,
} from '@openheaders/oracle/sync/entity-registry';
import {
  getCacheForWorkspace,
  getOracleForCurrentWorkspace,
  nextSwMutatorContext,
} from '@openheaders/oracle/sync/service/accessors';
import { childPlacement } from '../tree-placement';
import { applyRequestMutationOrThrow } from './apply';
import { resolveRequestFolderParent } from './folders';
import { deleteExamplesOf } from './response-examples';
import { assertLoaded, collections, loadedWorkspaceId, requests } from './state';

/**
 * Reject a malformed request at the write boundary. Callers reach this
 * store through RPC (`createLocalRequest` forwards its seed verbatim),
 * so an out-of-shape entity — e.g. a `form` body missing `formParts` —
 * would otherwise persist silently; SW hydration then drops it as
 * drift while the renderer's raw storage read still renders it, and
 * the walkers downstream crash on the missing variant field. Mirrors
 * `assertValidSteps` in `live-workflow-store`.
 */
function requestSchemaError(candidate: Request): string | null {
  const detail = schemaParseError(RequestSchema, candidate);
  return detail === null ? null : `invalid request — ${detail}`;
}

/** Seed shape for a fresh request — name + minimal defaults. */
export async function addRequest(
  name: string,
  parentPath: string,
  seed?: Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<Request> {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const created: Request = {
    schemaVersion: 5,
    uid,
    path: `${parentPath}/${folderName}`,
    pathSegment: folderName,
    name,
    method: seed?.method ?? 'GET',
    url: seed?.url ?? '',
    headers: seed?.headers ?? [],
    params: seed?.params ?? [],
    auth: seed?.auth ?? { type: 'inherit' },
    body: seed?.body ?? { type: 'none' },
    ...(seed?.description ? { description: seed.description } : {}),
    ...(seed?.credentialsMode ? { credentialsMode: seed.credentialsMode } : {}),
    ...(seed?.followRedirects !== undefined ? { followRedirects: seed.followRedirects } : {}),
    ...(seed?.sslVerification !== undefined ? { sslVerification: seed.sslVerification } : {}),
    ...(seed?.tlsMinVersion !== undefined ? { tlsMinVersion: seed.tlsMinVersion } : {}),
    ...(seed?.tlsMaxVersion !== undefined ? { tlsMaxVersion: seed.tlsMaxVersion } : {}),
    ...(seed?.tlsCipherSuites !== undefined ? { tlsCipherSuites: seed.tlsCipherSuites } : {}),
    ...(seed?.httpVersion !== undefined ? { httpVersion: seed.httpVersion } : {}),
    ...(seed?.resolveToAddress !== undefined ? { resolveToAddress: seed.resolveToAddress } : {}),
    ...(seed?.clientCertificateRef !== undefined ? { clientCertificateRef: seed.clientCertificateRef } : {}),
    ...(seed?.proxyMode !== undefined ? { proxyMode: seed.proxyMode } : {}),
    ...(seed?.proxyUrl !== undefined ? { proxyUrl: seed.proxyUrl } : {}),
    ...(seed?.proxyCredentialRef !== undefined ? { proxyCredentialRef: seed.proxyCredentialRef } : {}),
    ...(seed?.unixSocketPath !== undefined ? { unixSocketPath: seed.unixSocketPath } : {}),
    ...(seed?.cookieJar !== undefined ? { cookieJar: seed.cookieJar } : {}),
    ...(seed?.timeoutMs !== undefined ? { timeoutMs: seed.timeoutMs } : {}),
    ...(seed?.maxResponseBytes !== undefined ? { maxResponseBytes: seed.maxResponseBytes } : {}),
    ...(seed?.maxRedirects !== undefined ? { maxRedirects: seed.maxRedirects } : {}),
    ...(seed?.followOriginalHttpMethod !== undefined
      ? { followOriginalHttpMethod: seed.followOriginalHttpMethod }
      : {}),
    ...(seed?.followAuthorizationHeader !== undefined
      ? { followAuthorizationHeader: seed.followAuthorizationHeader }
      : {}),
    ...(seed?.preRequestScript ? { preRequestScript: seed.preRequestScript } : {}),
    ...(seed?.postResponseScript ? { postResponseScript: seed.postResponseScript } : {}),
  };
  const schemaError = requestSchemaError(created);
  if (schemaError) throw new Error(`addRequest: ${schemaError}`);
  const placement = childPlacement(
    getOracleForCurrentWorkspace(),
    resolveRequestFolderParent(parentPath),
    REQUEST_FOLDER_ITEMS_PATH,
  );
  await applyRequestMutationOrThrow((ctx) => buildAddBatch(created, ctx, placement), 'addRequest');
  return created;
}

export function addRequestToCollection(
  name: string,
  collectionUid: string,
  seed?: Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<Request> {
  const collection = collections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `requests/${collectionUid}`;
  return addRequest(name, parentPath, seed);
}

export function getRequest(uid: string): Request | null {
  return requests.find((r) => r.uid === uid) ?? null;
}

/**
 * Look up a request scoped to an explicit workspace via its
 * {@link RequestCache}. Returns null when no service is materialized
 * for the workspace OR no request with that uid exists in it. Used by
 * the live-refresh chain executor when refreshing workflows in a
 * non-Active workspace under MWPT-FULL session #19 — the Active-bound
 * {@link getRequest} would silently miss requests that live in a per-
 * tab editing-scope workspace.
 */
export function getRequestInWorkspace(uid: string, workspaceId: string): Request | null {
  const cache = getCacheForWorkspace<RequestCache>(REQUEST_REGISTRATION, workspaceId);
  if (!cache) return null;
  return cache.getRequests().find((r) => r.uid === uid) ?? null;
}

/**
 * A GraphQL request by uid in an explicit workspace — the workflow
 * step's second lookup: a step names a request uid of either kind, and
 * the chain adapter compiles a GraphQL one into its HTTP send.
 */
export function getGraphqlRequestInWorkspace(uid: string, workspaceId: string): GraphqlRequest | null {
  const cache = getCacheForWorkspace<GraphqlRequestCache>(GRAPHQL_REQUEST_REGISTRATION, workspaceId);
  if (!cache) return null;
  return cache.getGraphqlRequests().find((r) => r.uid === uid) ?? null;
}

/**
 * Set of every request uid a workflow step may name in an explicit
 * workspace — HTTP and GraphQL requests alike — or `null` when no
 * service is materialized for that workspace. Callers that gate on
 * request existence (`workflowStepsResolvable`) treat `null` as
 * "registry not hydrated — skip the gate", so a workflow step is never
 * false-flagged as referencing a deleted request just because the
 * store hasn't loaded yet.
 */
export function getRequestUidsForWorkspace(workspaceId: string): ReadonlySet<string> | null {
  const cache = getCacheForWorkspace<RequestCache>(REQUEST_REGISTRATION, workspaceId);
  if (!cache) return null;
  const uids = new Set(cache.getRequests().map((r) => r.uid));
  const graphql = getCacheForWorkspace<GraphqlRequestCache>(GRAPHQL_REQUEST_REGISTRATION, workspaceId);
  for (const request of graphql?.getGraphqlRequests() ?? []) uids.add(request.uid);
  return uids;
}

/**
 * Has the active-workspace request mirror hydrated at least once?
 * Scheduler-side gates consult this so a cold-wake window (before the
 * first workspace load) skips the request-resolution check rather than
 * dropping every workflow's alarm.
 */
export function isRequestStoreHydrated(): boolean {
  return loadedWorkspaceId !== null;
}

/**
 * Snapshot every request collection in an explicit workspace via its
 * {@link RequestCollectionCache}. Returns `[]` when no service is
 * materialized for the workspace. Drives the per-workspace variable
 * scope feed (collection-vars) for chain refresh executions targeting
 * a non-Active workspace.
 */
export function getRequestCollectionsForWorkspace(workspaceId: string): Collection[] {
  const cache = getCacheForWorkspace<RequestCollectionCache>(REQUEST_COLLECTION_REGISTRATION, workspaceId);
  return cache ? cache.getRequestCollections() : [];
}

/**
 * Snapshot every request folder in an explicit workspace via its
 * {@link RequestFolderCache}. Returns `[]` when no service is
 * materialized for the workspace. Same contract as
 * {@link getRequestCollectionsForWorkspace} — drives the ancestor
 * script-chain lookup for executions pinned to a non-Active workspace.
 */
export function getRequestFoldersForWorkspace(workspaceId: string): Folder[] {
  const cache = getCacheForWorkspace<RequestFolderCache>(REQUEST_FOLDER_REGISTRATION, workspaceId);
  return cache ? cache.getRequestFolders() : [];
}

/**
 * Outcome of a request write. The legacy stale-draft branch is retired
 * in Phase B — convergence is per-(field) LWW at the oracle, not a
 * versioned compare-and-set.
 */
export type RequestWriteResult =
  | { ok: true; request: Request }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message: string };

export async function updateRequest(
  uid: string,
  updates: Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<RequestWriteResult> {
  assertLoaded();
  const existing = requests.find((r) => r.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };

  // Same write-boundary schema gate as `addRequest`, applied to the
  // post-merge shape a successful apply would converge on. Ahead of
  // the oracle-availability check — a malformed payload is a malformed
  // payload regardless of whether the sync service is up.
  const schemaError = requestSchemaError({ ...existing, ...updates } as Request);
  if (schemaError) return { ok: false, reason: 'other', message: `updateRequest: ${schemaError}` };

  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    return { ok: false, reason: 'other', message: 'sync service not initialized' };
  }

  // SW-side oracle exposes `(itemId, item, key)`; adapt to the
  // `LiveSetEntries` shape (`orderKey` rename) so the diff-detect can
  // compute `moveBefore` against fractional keys. The second reader
  // answers any scalar path from the canonical pre-image — the
  // auth/body flatten-diff baseline and the explicit-clear guard.
  const payload = buildUpdateBatch(
    uid,
    updates,
    ctx,
    (requestUid, setPath) =>
      oracle
        .liveOrderedSetItems(REQUEST_ENTITY_TYPE, requestUid, setPath)
        .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
    (_requestUid, path) => existing[path as keyof Request],
  );
  if (payload.batch.mutations.length === 0) {
    // No-op patch — return the canonical pre-image.
    return { ok: true, request: existing };
  }
  const result = await oracle.apply(payload.batch, payload.sideEffects);
  if (!result.ok) {
    return {
      ok: false,
      reason: 'other',
      message: result.failure?.detail ?? 'oracle rejected request batch',
    };
  }
  // Optimistic merge — broadcast-driven cache projection lands the
  // authoritative shape back into the local mirror momentarily.
  return { ok: true, request: { ...existing, ...updates } as Request };
}

/**
 * Delete a request: its parent's `items` slot tombstones in the same
 * batch as the entity; an unresolvable parent (already tombstoned)
 * falls back to the bare entity tombstone.
 */
export async function deleteRequest(uid: string): Promise<boolean> {
  assertLoaded();
  const request = requests.find((r) => r.uid === uid);
  if (!request) return false;
  const parentPath = parentPathOf(request.path);
  const parent = parentPath === null ? null : resolveRequestFolderParent(parentPath);
  await deleteExamplesOf({ type: REQUEST_ENTITY_TYPE, uid }, 'deleteRequest');
  await applyRequestMutationOrThrow(
    (ctx) => (parent ? buildDeleteBatch(uid, parent, ctx) : buildDeleteEntityBatch(uid, ctx)),
    'deleteRequest',
  );
  return true;
}
