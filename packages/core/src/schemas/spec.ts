/**
 * Spec schema — a first-class API specification document.
 *
 * A spec is a named, persistent, editable entity holding a file set:
 * `files` carries every source file (verbatim text; the spec text IS
 * the interchange format) and `rootFileUid` marks the document root.
 * v1 behavior only ever creates the single root file, but the shape is
 * a multi-file set from day one so multi-file `$ref` resolution lands
 * without a schema migration.
 *
 * `format` is an extensible vocabulary — OpenAPI 3.x plus Protobuf 3
 * (the gRPC client's service-definition source); other formats
 * (AsyncAPI, GraphQL, …) are an additive picklist change. File syntax
 * (YAML vs JSON vs proto) is NOT stored: the file extension is the
 * single source of truth, same posture as request body files
 * (invariant #15).
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';

/** Supported spec formats. Extensible vocabulary — additive only. */
export const SPEC_FORMATS = ['openapi-3.0', 'openapi-3.1', 'protobuf'] as const;

export const SpecFormatSchema = v.picklist(SPEC_FORMATS);

/**
 * Filename relative to the spec's folder, e.g. `index.yaml`. Forward
 * slashes allowed for future multi-file layouts; absolute paths and
 * parent traversal are rejected at the boundary.
 */
export const SpecFileNameSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(512),
  v.check(
    (value) => !value.startsWith('/') && !value.split('/').includes('..'),
    'Must be a relative path without ".." segments.',
  ),
);

export const SpecFileSchema = v.object({
  uid: UidSchema,
  fileName: SpecFileNameSchema,
  /** Verbatim source text. Exported byte-for-byte; never normalized. */
  content: v.string(),
});

export const SpecSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  description: v.optional(v.string()),
  format: SpecFormatSchema,
  /** uid of the `files` row that is the document root. */
  rootFileUid: UidSchema,
  files: v.array(SpecFileSchema),
});
