/**
 * useRequestSpecBinding — the HTTP request's spec binding, read
 * through its collection's `specLink` (an HTTP request carries no
 * link of its own). Parses the linked document once per saved root
 * content, judges drift against the link's `sourceHash` (async hash,
 * the sidebar's rule), and resolves this request's operation.
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
  | { kind: 'missing'; collection: Collection }
  | { kind: 'parseError'; collection: Collection; spec: Spec; message: string }
  | {
      kind: 'linked';
      collection: Collection;
      spec: Spec;
      parsed: OpenApiParseResult;
      /** `null` while the saved content is still hashing. */
      drifted: boolean | null;
      operation: RequestSpecOperation | null;
    };

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
  const specUid = collection?.specLink?.specUid;
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
    if (!collection?.specLink) return UNLINKED;
    if (!spec) return { kind: 'missing', collection };
    if (!parsed) return { kind: 'missing', collection };
    if ('message' in parsed) return { kind: 'parseError', collection, spec, message: parsed.message };
    const drifted = savedHash === null ? null : savedHash !== collection.specLink.sourceHash;
    return { kind: 'linked', collection, spec, parsed: parsed.result, drifted, operation };
  }, [collection, spec, parsed, savedHash, operation]);
}
