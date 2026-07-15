/**
 * Response Example schema — a snapshot of one executed exchange, saved
 * under a request ("Save Response"). Captures the request shape as it
 * was sent (method, URL, params, headers, body) plus the response
 * (status, headers, body, duration/size meta). After capture the
 * `request` / `response` blocks stay editable — an example doubles as
 * an authored documentation template — while `capturedAt` records the
 * original capture moment as a historical fact. "Try" forks the
 * example's request shape into a fresh draft for actually running it.
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
  /** Response body as text. UTF-8 verbatim by default; base64-encoded
   *  wire bytes when `bodyEncoding` marks the capture binary. */
  body: v.string(),
  /** Present (`'base64'`) when `body` carries base64-encoded wire bytes
   *  because the captured payload is not valid UTF-8 text. Absent = text. */
  bodyEncoding: v.optional(v.literal('base64')),
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
