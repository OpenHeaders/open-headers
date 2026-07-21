/**
 * Shared wire-shape helpers for the snippet formatters — the pieces of
 * body/header semantics both output languages must agree on so a copied
 * command sends exactly what the executor would.
 */

import type { FormField, RequestBody } from '../types';
import type { WireHeader, WireSnippetRequest } from './types';

/**
 * GraphQL HTTP transport wire body (`{"query", "variables"}` as
 * application/json) — the same fold every wire executor applies.
 * `variablesText` embeds as parsed JSON when valid and is omitted on
 * parse failure, matching the executors' lenient posture.
 */
export function graphqlWireBody(content: string, variablesText: string | undefined): string {
  const wire: { query: string; variables?: unknown } = { query: content };
  const trimmed = variablesText?.trim();
  if (trimmed) {
    try {
      wire.variables = JSON.parse(trimmed);
    } catch {
      // Leave `variables` unset — `{query}` alone is valid GraphQL wire.
    }
  }
  return JSON.stringify(wire);
}

/**
 * Headers as they must appear in the snippet. A user-set multipart
 * Content-Type is dropped for multipart bodies — the executing tool
 * (curl's `-F`, the browser's FormData) MUST mint its own with a
 * generated boundary, and a boundary-less header breaks every server.
 */
export function effectiveHeaders(req: WireSnippetRequest): WireHeader[] {
  if (req.body.type !== 'multipart') return req.headers;
  return req.headers.filter(
    (h) => !(h.key.toLowerCase() === 'content-type' && h.value.toLowerCase().startsWith('multipart/form-data')),
  );
}

/** Enabled form fields — the rows the wire boundary would actually send. */
export function enabledFormParts(parts: readonly FormField[]): FormField[] {
  return parts.filter((p) => p.enabled !== false);
}

/**
 * Raw text payload for string-bodied variants (`json` / `xml` / `text` /
 * `graphql`); `null` for `none` and the structured variants (`form` /
 * `multipart`), which each formatter renders in its own syntax.
 */
export function wireTextBody(body: RequestBody): string | null {
  switch (body.type) {
    case 'json':
    case 'xml':
    case 'text':
      return body.content;
    case 'graphql':
      return graphqlWireBody(body.content, body.graphqlVariables);
    default:
      return null;
  }
}
