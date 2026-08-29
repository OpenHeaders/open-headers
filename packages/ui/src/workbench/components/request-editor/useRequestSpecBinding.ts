/**
 * useRequestSpecBinding — the HTTP request's spec binding: the
 * request's own `specLink` first, its collection's second (a request
 * inside a spec-generated collection reads through it). Parses the
 * linked document once per saved root content, judges drift against
 * the collection link's `sourceHash` (async hash, the sidebar's rule —
 * a request link has no generation to drift from), and resolves this
 * request's operation.
 */

import { type OpenApiParseResult, parseOpenApi } from '@openheaders/core/import';
import type { Collection, Spec } from '@openheaders/core/types';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { useMemo } from 'react';
import { useSpecSourceHash } from '../specs/use-spec-drift';
import type { Draft } from './draft';
import { rowsToHeaders, rowsToParams } from './draft';
import { type RequestSpecOperation, resolveSpecOperation } from './request-spec-binding';

export type RequestSpecBinding =
  | { kind: 'unlinked' }
  | { kind: 'missing'; source: SpecLinkSource }
  | { kind: 'parseError'; source: SpecLinkSource; spec: Spec; message: string }
  | {
      kind: 'linked';
      source: SpecLinkSource;
      spec: Spec;
      parsed: OpenApiParseResult;
      /** Collection-sourced links only: `null` while the saved content
       *  is still hashing. A request link never drifts. */
      drifted: boolean | null;
      operation: RequestSpecOperation | null;
    };

/** Where the binding's link lives. */
export type SpecLinkSource = { kind: 'request' } | { kind: 'collection'; collection: Collection };

const UNLINKED: RequestSpecBinding = { kind: 'unlinked' };

function specRootContent(spec: Spec): string | null {
  const root = spec.files.find((f) => f.uid === spec.rootFileUid) ?? spec.files[0];
  return root ? root.content : null;
}

export function useRequestSpecBinding(
  workspaceId: string | null,
  collection: Collection | undefined,
  draft: Draft,
  requestName: string,
): RequestSpecBinding {
  const specs = useSpecs(workspaceId);
  const source = useMemo<SpecLinkSource | null>(() => {
    if (draft.specLink) return { kind: 'request' };
    if (collection?.specLink) return { kind: 'collection', collection };
    return null;
  }, [draft.specLink, collection]);
  const specUid = draft.specLink?.specUid ?? collection?.specLink?.specUid;
  const spec = useMemo(() => (specUid ? (specs.find((s) => s.uid === specUid) ?? null) : null), [specs, specUid]);
  const content = spec ? specRootContent(spec) : null;
  const savedHash = useSpecSourceHash(content);

  const parsed = useMemo<{ result: OpenApiParseResult } | { message: string } | null>(() => {
    if (content === null) return null;
    try {
      return { result: parseOpenApi(content) };
    } catch (err) {
      return { message: err instanceof Error ? err.message : String(err) };
    }
  }, [content]);

  const { method, url, description, headers, params, auth, body } = draft;
  const operation = useMemo(
    () =>
      parsed && 'result' in parsed
        ? resolveSpecOperation(parsed.result, {
            name: requestName,
            description,
            method,
            url,
            headers: rowsToHeaders(headers),
            params: rowsToParams(params),
            auth,
            body,
          })
        : null,
    [parsed, requestName, description, method, url, headers, params, auth, body],
  );

  return useMemo<RequestSpecBinding>(() => {
    if (source === null) return UNLINKED;
    if (!spec || !parsed) return { kind: 'missing', source };
    if ('message' in parsed) return { kind: 'parseError', source, spec, message: parsed.message };
    const drifted =
      source.kind === 'collection' && source.collection.specLink
        ? savedHash === null
          ? null
          : savedHash !== source.collection.specLink.sourceHash
        : false;
    return { kind: 'linked', source, spec, parsed: parsed.result, drifted, operation };
  }, [source, spec, parsed, savedHash, operation]);
}
