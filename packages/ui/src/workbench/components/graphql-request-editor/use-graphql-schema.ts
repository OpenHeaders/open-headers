/**
 * useGraphqlSchema — the request's resolved schema in one hook: the
 * source (the entity's ids-only `specLink` names a linked `graphql`
 * Spec — the synced form; otherwise the LOCAL-plane introspection
 * cache keyed by this request), the schema model built from it, the
 * source's own problems, and the introspection plane: `introspect()`
 * runs `INTROSPECTION_QUERY` THROUGH THE COMPILE — the live draft with
 * the introspection document as its query rides the same
 * `executeGraphqlRequest` route the Query button uses, so the
 * request's auth, headers, inherited settings, proxy, CA and cookies
 * all apply; never a bare fetch. The answer persists on the local
 * plane with its fetched-at stamp; Refresh re-runs it.
 */

import {
  type GraphqlSchema,
  INTROSPECTION_QUERY,
  type SchemaResult,
  schemaFromIntrospection,
} from '@openheaders/core/graphql';
import type { ExecutedRequestSnapshot, GraphqlRequest, Spec } from '@openheaders/core/types';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { readGraphqlSchemaSource } from '../specs/graphql-schema-source';
import { draftEntity, type GraphqlDraft } from './draft';
import {
  type GraphqlIntrospectionCacheEntry,
  readIntrospectionCache,
  writeIntrospectionCache,
} from './graphql-schema-cache';

export type GraphqlSchemaSourceChoice = 'introspection' | 'spec';

export type GraphqlIntrospectionStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly fetchedAt: string }
  | { readonly kind: 'error'; readonly message: string; readonly fetchedAt: string | null };

/** Why an introspection did not yield a schema — the Schema tab prints it verbatim. */
export type GraphqlIntrospectionFailure =
  | { readonly kind: 'transport'; readonly message: string }
  | { readonly kind: 'http'; readonly status: number; readonly statusText: string }
  | { readonly kind: 'graphql-errors'; readonly messages: readonly string[] }
  | { readonly kind: 'no-schema' }
  | { readonly kind: 'malformed'; readonly messages: readonly string[] };

export interface GraphqlSchemaState {
  /** The source the schema resolves from — `spec` while the entity links one. */
  readonly choice: GraphqlSchemaSourceChoice;
  readonly schema: GraphqlSchema | null;
  /** The resolved source's build problems (an SDL type defined twice, a malformed introspection). */
  readonly problems: readonly string[];
  /** The workspace's `graphql` specs and the one the entity links (null = unlinked or missing). */
  readonly graphqlSpecs: readonly Spec[];
  readonly linkedSpec: Spec | null;
  /** True while a `specLink` names a spec the workspace no longer holds. */
  readonly linkMissing: boolean;
  readonly introspection: GraphqlIntrospectionStatus;
  /** Run (or re-run) the introspection through the compile; resolves with the failure, or null on success. */
  readonly introspect: () => Promise<GraphqlIntrospectionFailure | null>;
}

interface UseGraphqlSchemaArgs {
  entity: GraphqlRequest | null;
  draft: GraphqlDraft;
  workspaceId: string | null;
  executeGraphql: (input: { draft: GraphqlRequest }) => Promise<ExecutedRequestSnapshot | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The introspection answer read off the HTTP snapshot the compile produced. */
export function readIntrospectionSnapshot(
  snapshot: ExecutedRequestSnapshot | null,
): { ok: true; introspection: unknown; result: SchemaResult } | { ok: false; failure: GraphqlIntrospectionFailure } {
  if (snapshot === null) return { ok: false, failure: { kind: 'transport', message: 'No answer from the host.' } };
  if (snapshot.error !== null) return { ok: false, failure: { kind: 'transport', message: snapshot.error } };
  if (snapshot.status < 200 || snapshot.status >= 300) {
    return { ok: false, failure: { kind: 'http', status: snapshot.status, statusText: snapshot.statusText } };
  }
  if (snapshot.bodyEncoding === 'base64' || snapshot.bodyTruncated)
    return { ok: false, failure: { kind: 'no-schema' } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshot.body);
  } catch {
    return { ok: false, failure: { kind: 'no-schema' } };
  }
  const data = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : null;
  if (data === null || !isRecord(data.__schema)) {
    const errors = isRecord(parsed) && Array.isArray(parsed.errors) ? parsed.errors : [];
    const messages = errors.flatMap((entry) =>
      isRecord(entry) && typeof entry.message === 'string' ? [entry.message] : [],
    );
    return { ok: false, failure: messages.length > 0 ? { kind: 'graphql-errors', messages } : { kind: 'no-schema' } };
  }
  const introspection = { __schema: data.__schema };
  const result = schemaFromIntrospection(introspection);
  if (result.schema === null) {
    return { ok: false, failure: { kind: 'malformed', messages: result.errors.map((error) => error.message) } };
  }
  return { ok: true, introspection, result };
}

function specRootContent(spec: Spec): string | null {
  const root = spec.files.find((f) => f.uid === spec.rootFileUid) ?? spec.files[0];
  return root ? root.content : null;
}

export function useGraphqlSchema({
  entity,
  draft,
  workspaceId,
  executeGraphql,
}: UseGraphqlSchemaArgs): GraphqlSchemaState {
  const specs = useSpecs(workspaceId);
  const graphqlSpecs = useMemo(() => specs.filter((spec) => spec.format === 'graphql'), [specs]);
  const specUid = draft.specLink?.specUid;
  const linkedSpec = useMemo(
    () => (specUid === undefined ? null : (graphqlSpecs.find((spec) => spec.uid === specUid) ?? null)),
    [graphqlSpecs, specUid],
  );
  const choice: GraphqlSchemaSourceChoice = specUid === undefined ? 'introspection' : 'spec';

  // The local plane's entry for this request — read once per request,
  // replaced by each introspection.
  const [cache, setCache] = useState<GraphqlIntrospectionCacheEntry | null>(null);
  const [status, setStatus] = useState<GraphqlIntrospectionStatus>({ kind: 'idle' });
  const requestUid = entity?.uid ?? null;
  useEffect(() => {
    if (workspaceId === null || requestUid === null) return;
    let alive = true;
    void readIntrospectionCache(workspaceId, requestUid).then((entry) => {
      if (!alive) return;
      setCache(entry);
      setStatus(entry === null ? { kind: 'idle' } : { kind: 'ready', fetchedAt: entry.fetchedAt });
    });
    return () => {
      alive = false;
    };
  }, [workspaceId, requestUid]);

  const introspect = useCallback(async (): Promise<GraphqlIntrospectionFailure | null> => {
    if (entity === null || workspaceId === null) {
      return { kind: 'transport', message: 'The request is not saved yet.' };
    }
    setStatus({ kind: 'loading' });
    const { variables: _variables, operationName: _operationName, ...rest } = draftEntity(entity, draft);
    const snapshot = await executeGraphql({ draft: { ...rest, query: INTROSPECTION_QUERY } });
    const read = readIntrospectionSnapshot(snapshot);
    if (!read.ok) {
      setStatus({
        kind: 'error',
        message: failureMessage(read.failure),
        fetchedAt: cache?.fetchedAt ?? null,
      });
      return read.failure;
    }
    const entry: GraphqlIntrospectionCacheEntry = {
      fetchedAt: new Date().toISOString(),
      introspection: read.introspection,
    };
    await writeIntrospectionCache(workspaceId, entity.uid, entry);
    setCache(entry);
    setStatus({ kind: 'ready', fetchedAt: entry.fetchedAt });
    return null;
  }, [entity, draft, workspaceId, executeGraphql, cache]);

  const resolved = useMemo<{ schema: GraphqlSchema | null; problems: readonly string[] }>(() => {
    if (choice === 'spec') {
      const content = linkedSpec === null ? null : specRootContent(linkedSpec);
      if (content === null) return { schema: null, problems: [] };
      const source = readGraphqlSchemaSource(content);
      return { schema: source.result.schema, problems: source.result.errors.map((error) => error.message) };
    }
    if (cache === null) return { schema: null, problems: [] };
    const result = schemaFromIntrospection(cache.introspection);
    return { schema: result.schema, problems: result.errors.map((error) => error.message) };
  }, [choice, linkedSpec, cache]);

  return {
    choice,
    schema: resolved.schema,
    problems: resolved.problems,
    graphqlSpecs,
    linkedSpec,
    linkMissing: specUid !== undefined && linkedSpec === null,
    introspection: status,
    introspect,
  };
}

/** One line for the status — the Schema tab's error text. */
export function failureMessage(failure: GraphqlIntrospectionFailure): string {
  switch (failure.kind) {
    case 'transport':
      return failure.message;
    case 'http':
      return `HTTP ${failure.status}${failure.statusText ? ` ${failure.statusText}` : ''}`;
    case 'graphql-errors':
      return failure.messages.join(' · ');
    case 'no-schema':
      return 'no __schema in the answer';
    case 'malformed':
      return failure.messages.join(' · ');
  }
}
