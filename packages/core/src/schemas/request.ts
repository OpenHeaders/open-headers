/**
 * Valibot schema for `V5.Request`.
 *
 * Mirrors `types/v5/request.ts` field-for-field. Auth is a discriminated
 * union on `type`; body carries an optional `content` + graphql vars.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';

export const HttpMethodSchema = v.picklist(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export const BodyTypeSchema = v.picklist(['none', 'json', 'xml', 'graphql', 'form', 'multipart', 'text']);

export const CredentialsModeSchema = v.picklist(['omit', 'include']);

export const AuthConfigSchema = v.variant('type', [
  v.object({ type: v.literal('none') }),
  v.object({ type: v.literal('inherit') }),
  v.object({
    type: v.literal('basic'),
    username: v.string(),
    password: v.string(),
  }),
  v.object({
    type: v.literal('bearer'),
    token: v.string(),
  }),
  v.object({
    type: v.literal('api-key'),
    key: v.string(),
    value: v.string(),
    in: v.picklist(['header', 'query']),
  }),
]);

export const RequestHeaderSchema = v.object({
  key: v.string(),
  value: v.string(),
  enabled: v.optional(v.boolean()),
});

export const QueryParamSchema = v.object({
  key: v.string(),
  value: v.string(),
  enabled: v.optional(v.boolean()),
});

/**
 * A reference to a user-uploaded file blob. Files live in
 * content-addressed storage (IDB on the extension, OPFS on the desktop)
 * keyed by `hash` — see `@openheaders/core/files` for the FileRef
 * namespace contract and ARCHITECTURE.md §6.
 *
 * `hash` matches ONE of two shapes:
 *   • `sha256:<64-hex-char-digest>` — real content-addressed ref.
 *   • `placeholder:<opaque-label>`  — importer emitted a file
 *     reference it couldn't carry bytes for (curl `-F @path`, HAR
 *     multipart, Postman formdata file parts). The UI shows an
 *     "Upload required" badge and offers inline replacement; the
 *     executor silently skips parts whose hash isn't in the
 *     BlobStore, so placeholders drop out of the outgoing FormData
 *     until reconciled.
 *
 * The filename is the user-facing label — rename-free: the same
 * bytes under different names stay one blob.
 */
export const FileRefSchema = v.object({
  hash: v.pipe(v.string(), v.regex(/^(sha256:[0-9a-f]{64}|placeholder:.+)$/)),
  filename: v.string(),
  mimeType: v.optional(v.string()),
  size: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

/**
 * A single part of a multipart/form-data body. Text parts carry a
 * string value; file parts carry a `FileRef` (resolved to bytes by
 * the executor via the BlobStore). Discriminated on `kind` so
 * TypeScript exhausts the branches at compile time.
 *
 * `enabled: false` preserves the user's "keep around but don't send"
 * intent — the executor skips disabled parts during FormData
 * assembly.
 */
export const MultipartPartSchema = v.variant('kind', [
  v.object({
    kind: v.literal('text'),
    name: v.string(),
    value: v.string(),
    enabled: v.optional(v.boolean()),
  }),
  v.object({
    kind: v.literal('file'),
    name: v.string(),
    fileRef: FileRefSchema,
    /** Optional override for the filename sent with the multipart part
     *  (defaults to `fileRef.filename`). Useful when a user wants to
     *  send `invoice.pdf` as `attachment.pdf` without duplicating the
     *  blob. */
    filenameOverride: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  }),
]);

export const RequestBodySchema = v.object({
  type: BodyTypeSchema,
  content: v.optional(v.string()),
  graphqlVariables: v.optional(v.string()),
  /**
   * Structured multipart part list. Populated when `type === 'multipart'`;
   * ignored for other body types. Absent → empty multipart body (rare
   * but valid — some APIs accept this for "kick off" endpoints).
   */
  multipartParts: v.optional(v.array(MultipartPartSchema)),
});

export const RequestSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  /**
   * Phase 10 monotonic write counter. See `RuleBase.version` for the
   * full contract — v5 has zero users so the field is required from
   * day one (no backwards-compat optionality).
   */
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  method: HttpMethodSchema,
  url: v.string(),
  headers: v.array(RequestHeaderSchema),
  params: v.array(QueryParamSchema),
  auth: AuthConfigSchema,
  credentialsMode: v.optional(CredentialsModeSchema),
  body: RequestBodySchema,
  preRequestScript: v.optional(v.string()),
  testScript: v.optional(v.string()),
});
