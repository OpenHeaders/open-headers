/**
 * Resolved-body construction — maps every `RequestBody` variant through
 * template resolution, plus the default Content-Type table for variants
 * whose type isn't set elsewhere.
 */

import type { FormField, MultipartPart, RequestBody } from '@openheaders/core/types';

/**
 * Build the resolved body payload the executor will attach to the
 * fetch. Exhaustive over the discriminated union — every variant
 * runs its templatable fields through `resolveStr` so the wire body
 * never carries a literal `{{ref}}`. File-part bytes are read later
 * by `buildMultipartForm` via the BlobStore; the `fileRefs` list
 * passes through unchanged because file paths/hashes aren't
 * user-templated.
 *
 * Disabled rows on form / multipart bodies are NOT skipped here —
 * they're carried with `enabled: false` so `executeResolved` can
 * filter them at the wire boundary. Centralizing the filter there
 * keeps the resolved shape a faithful map of the input shape and
 * avoids re-introducing a "did the resolved body keep the disabled
 * row?" question in any downstream consumer (snapshot, mutation,
 * scripts).
 */
export function buildResolvedBody(body: RequestBody, resolveStr: (s: string) => string): RequestBody {
  switch (body.type) {
    case 'none':
      return { type: 'none' };
    case 'json':
      return { type: 'json', content: resolveStr(body.content) };
    case 'xml':
      return { type: 'xml', content: resolveStr(body.content) };
    case 'text':
      return body.rawFormat !== undefined
        ? { type: 'text', content: resolveStr(body.content), rawFormat: body.rawFormat }
        : { type: 'text', content: resolveStr(body.content) };
    case 'graphql': {
      // GraphQL variables are JSON text the user typed — resolve
      // templates inside it the same way as the query string. The
      // wire-side JSON wrap happens in `executeResolved`.
      const variables = body.graphqlVariables !== undefined ? resolveStr(body.graphqlVariables) : undefined;
      return variables !== undefined
        ? { type: 'graphql', content: resolveStr(body.content), graphqlVariables: variables }
        : { type: 'graphql', content: resolveStr(body.content) };
    }
    case 'form': {
      const resolvedParts: FormField[] = body.formParts.map((part) => {
        // Skip resolveStr for disabled rows — they aren't sent, so
        // their `{{ref}}` references shouldn't burn TOTP cooldown or
        // contribute to the resolver's variable-usage tracking. The
        // structural fields (description, enabled flag) round-trip
        // verbatim.
        if (part.enabled === false) return { ...part };
        return {
          ...part,
          key: resolveStr(part.key),
          value: resolveStr(part.value),
        };
      });
      return { type: 'form', formParts: resolvedParts };
    }
    case 'multipart': {
      const resolvedParts: MultipartPart[] = body.multipartParts.map((part) => {
        if (part.enabled === false) {
          // Same disabled-row contract as form — skip resolveStr so
          // disabled parts can't leak vault TOTP usage into the
          // cooldown tracker for codes that won't be sent.
          return part;
        }
        const name = resolveStr(part.name);
        if (part.kind === 'text') {
          return { kind: 'text', uid: part.uid, name, value: resolveStr(part.value), enabled: part.enabled };
        }
        return {
          kind: 'file',
          uid: part.uid,
          name,
          fileRefs: part.fileRefs,
          enabled: part.enabled,
        };
      });
      return { type: 'multipart', multipartParts: resolvedParts };
    }
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return { type: 'none' };
    }
  }
}

/**
 * Default Content-Type for the resolved body shape. `null` for
 * variants whose Content-Type is set elsewhere (`form` builds the
 * URLSearchParams Content-Type from the encoder; `multipart` lets the
 * browser pick one with a boundary; `none` has no body to type).
 *
 * For `text` bodies the rawFormat hint is honored so the user's
 * "JavaScript" / "HTML" dropdown choice picks `text/javascript` or
 * `text/html` instead of plain `text/plain`. The user can always
 * override by setting an explicit Content-Type header.
 */
export function defaultContentType(body: RequestBody): string | null {
  switch (body.type) {
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'text':
      if (body.rawFormat === 'javascript') return 'text/javascript';
      if (body.rawFormat === 'html') return 'text/html';
      return 'text/plain';
    case 'graphql':
      return 'application/json';
    default:
      return null;
  }
}
