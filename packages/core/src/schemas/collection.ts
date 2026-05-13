/**
 * Valibot schema for `Collection` — the folder that holds rules
 * or requests + collection-scoped variables.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { VariableSchema } from './variable';

export const CollectionSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  description: v.optional(v.string()),
  variables: v.array(VariableSchema),
  // Explicit child ordering — list of child folder names ("<slug>-<uid>").
  // Absent = alphabetical. See Phase 0 invariant #10.
  order: v.optional(v.array(v.string())),
  pinnedEnvironmentIds: v.optional(v.array(UidSchema), []),
  defaultEnvironmentId: v.optional(v.nullable(UidSchema), null),
});

/**
 * On-disk `_folder.yaml` — the lightweight grouping folder inside a
 * collection. Does not carry variables (collection is the only
 * variable-scoping folder type per the 4-scope model). `path` is
 * populated by the caller at parse time; not written to YAML. See
 * Phase 0 invariants #10 (order) + #11 (rules live in collections).
 */
export const FolderSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  order: v.optional(v.array(v.string())),
});
