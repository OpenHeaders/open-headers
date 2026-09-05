/**
 * GraphQL response facts — what the meta strip's GraphQL tags read off
 * the HTTP snapshot a GraphQL send answered with: the `errors[]` list
 * (an HTTP 200 with errors is the protocol's trap — the status pill
 * reads green while a field failed, the document was refused or auth
 * was missing), whether `data` came back null, and the server's
 * `extensions` object. Derived once per snapshot by the GraphQL
 * editor and never by the panel for an HTTP send — a REST body with an
 * `errors` key is not a GraphQL response.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';

export interface GraphqlResponseError {
  readonly message: string;
  /** `users.0.email` — the response path, or null when the error carries none. */
  readonly path: string | null;
  /** `line:column` of the first location in the document, or null. */
  readonly location: string | null;
  /** `extensions.code` when the server set one (the convention). */
  readonly code: string | null;
}

export interface GraphqlResponseFacts {
  readonly errors: readonly GraphqlResponseError[];
  /** `data: null` — every root field bubbled, or the request was refused. */
  readonly dataNull: boolean;
  /** The `extensions` object pretty-printed, or null when absent. */
  readonly extensionsJson: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorOf(entry: unknown): GraphqlResponseError | null {
  if (!isRecord(entry) || typeof entry.message !== 'string') return null;
  const path = Array.isArray(entry.path)
    ? entry.path.filter(
        (segment): segment is string | number => typeof segment === 'string' || typeof segment === 'number',
      )
    : [];
  const first = Array.isArray(entry.locations) ? entry.locations[0] : undefined;
  const location =
    isRecord(first) && typeof first.line === 'number' && typeof first.column === 'number'
      ? `${first.line}:${first.column}`
      : null;
  const code = isRecord(entry.extensions) && typeof entry.extensions.code === 'string' ? entry.extensions.code : null;
  return { message: entry.message, path: path.length > 0 ? path.join('.') : null, location, code };
}

/** The facts of a GraphQL answer, or null when the body is not a GraphQL response envelope. */
export function graphqlResponseFacts(response: ExecutedRequestSnapshot): GraphqlResponseFacts | null {
  if (response.bodyEncoding === 'base64' || response.bodyTruncated) return null;
  const text = response.body.trimStart();
  if (!text.startsWith('{')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !('data' in parsed || 'errors' in parsed)) return null;
  const errors = Array.isArray(parsed.errors)
    ? parsed.errors.map(errorOf).filter((entry): entry is GraphqlResponseError => entry !== null)
    : [];
  return {
    errors,
    dataNull: 'data' in parsed && parsed.data === null,
    extensionsJson: isRecord(parsed.extensions) ? JSON.stringify(parsed.extensions, null, 2) : null,
  };
}
