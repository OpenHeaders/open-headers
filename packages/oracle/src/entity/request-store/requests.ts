// ── Requests ────────────────────────────────────────────────────────

import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/request-mutations';
import type { Collection, Request } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import type { RequestCache } from '@openheaders/oracle/sync/caches/request-cache';
import type { RequestCollectionCache } from '@openheaders/oracle/sync/caches/request-collection-cache';
import { REQUEST_COLLECTION_REGISTRATION, REQUEST_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import {
  getCacheForWorkspace,
  getOracleForCurrentWorkspace,
  nextSwMutatorContext,
} from '@openheaders/oracle/sync/service';
import { applyRequestMutationOrThrow } from './apply';
import { deleteResponseExamplesForRequests } from './response-examples';
import { assertLoaded, collections, loadedWorkspaceId, requests } from './state';

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
    ...(seed?.allowHttp2 !== undefined ? { allowHttp2: seed.allowHttp2 } : {}),
    ...(seed?.resolveToAddress !== undefined ? { resolveToAddress: seed.resolveToAddress } : {}),
    ...(seed?.clientCertificateRef !== undefined ? { clientCertificateRef: seed.clientCertificateRef } : {}),
    ...(seed?.proxyUrl !== undefined ? { proxyUrl: seed.proxyUrl } : {}),
    ...(seed?.proxyCredentialRef !== undefined ? { proxyCredentialRef: seed.proxyCredentialRef } : {}),
    ...(seed?.unixSocketPath !== undefined ? { unixSocketPath: seed.unixSocketPath } : {}),
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
  await applyRequestMutationOrThrow((ctx) => buildAddBatch(created, ctx), 'addRequest');
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
 * Set of every request uid in an explicit workspace, or `null` when no
 * service is materialized for that workspace. Callers that gate on
 * request existence (`workflowStepsResolvable`) treat `null` as
 * "registry not hydrated — skip the gate", so a workflow step is never
 * false-flagged as referencing a deleted request just because the
 * store hasn't loaded yet.
 */
export function getRequestUidsForWorkspace(workspaceId: string): ReadonlySet<string> | null {
  const cache = getCacheForWorkspace<RequestCache>(REQUEST_REGISTRATION, workspaceId);
  if (!cache) return null;
  return new Set(cache.getRequests().map((r) => r.uid));
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
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    return { ok: false, reason: 'other', message: 'sync service not initialized' };
  }
  const existing = requests.find((r) => r.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };

  // SW-side oracle exposes `(itemId, item, key)`; adapt to the
  // `LiveSetEntries` shape (`orderKey` rename) so the diff-detect can
  // compute `moveBefore` against fractional keys. The second reader
  // supplies the live `auth` / `body` variant as the per-leaf
  // flatten-diff baseline from the canonical pre-image.
  const payload = buildUpdateBatch(
    uid,
    updates,
    ctx,
    (requestUid, setPath) =>
      oracle
        .liveOrderedSetItems(REQUEST_ENTITY_TYPE, requestUid, setPath)
        .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
    (_requestUid, path) => {
      if (path === 'auth') return existing.auth;
      if (path === 'body') return existing.body;
      return undefined;
    },
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

export async function deleteRequest(uid: string): Promise<boolean> {
  assertLoaded();
  if (!requests.some((r) => r.uid === uid)) return false;
  await deleteResponseExamplesForRequests([uid]);
  await applyRequestMutationOrThrow((ctx) => buildDeleteBatch(uid, ctx), 'deleteRequest');
  return true;
}
