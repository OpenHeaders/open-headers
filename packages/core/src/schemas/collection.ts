/**
 * Valibot schema for `V5.Collection` — the folder that holds rules
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
});
