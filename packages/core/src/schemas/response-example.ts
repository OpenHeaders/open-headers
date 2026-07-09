/**
 * Response Example schema — a frozen snapshot of one executed exchange,
 * saved under a request ("Save Response"). Captures the request shape
 * as it was sent (method, URL, params, headers, body) plus the response
 * (status, headers, body, duration/size meta). Examples are immutable
 * records: the write layer supports rename/duplicate/delete, never
 * content edits — iterating on a captured exchange goes through "Try",
 * which forks the captured request shape into a fresh draft.
 *
 * Deliberately excluded from the capture:
 *   - auth config — may hold secrets; the example records the exchange,
 *     not the credentials that produced it.
 *   - scripts + script outcomes, wire capture (IP, Set-Cookie), and
 *     resource timing — volatile execution internals, not part of the
 *     exchange's documented shape.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { HttpMethodSchema, QueryParamSchema, RequestBodySchema, RequestHeaderSchema } from './request';

/** Request shape as sent — authored values, variable refs unresolved. */
export const CapturedRequestSchema = v.object({
  method: HttpMethodSchema,
  url: v.string(),
  headers: v.array(RequestHeaderSchema),
  params: v.array(QueryParamSchema),
  body: RequestBodySchema,
});

/** Response side of the captured exchange. */
export const CapturedResponseSchema = v.object({
  /** HTTP status (e.g. 200). `0` when the request never completed. */
  status: v.number(),
  statusText: v.string(),
  /** Final URL after redirects. */
  url: v.string(),
  headers: v.array(v.object({ key: v.string(), value: v.string() })),
  /** Response body as text. */
  body: v.string(),
  /** True when the body exceeded the executor's wire cap at capture. */
  bodyTruncated: v.boolean(),
  /** The cap applied when truncated — present only with `bodyTruncated`. */
  bodyCapBytes: v.optional(v.number()),
  /** Bytes read from the wire before any truncation. */
  bodyBytes: v.number(),
  durationMs: v.number(),
});

export const ResponseExampleSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  /** `<requestPath>/examples/<slug>-<uid>` — nested under the parent request's folder. */
  path: RelativePathSchema,
  /** Parent request identity. */
  requestUid: UidSchema,
  name: v.pipe(v.string(), v.minLength(1)),
  /** ISO timestamp of the capture moment — a historical fact. */
  capturedAt: v.string(),
  request: CapturedRequestSchema,
  response: CapturedResponseSchema,
});
