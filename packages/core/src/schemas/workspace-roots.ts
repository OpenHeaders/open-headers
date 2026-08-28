/**
 * Workspace roots — the ordered collection lists of the three sidebar
 * trees, persisted as one record per workspace.
 *
 * The oracle holds the roots as a well-known singleton whose three
 * ordered sets carry `{ uid }` slots (`mutators/workspace-roots`); this
 * is the folded projection of those sets — uids in slot order, the
 * shape the caches persist and the renderer mirrors. Collections
 * reorder only, they never nest, so each list is flat.
 */

import * as v from 'valibot';
import { SchemaVersionSchema, UidSchema } from './common';

export const WorkspaceRootsSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  ruleCollections: v.array(UidSchema),
  requestCollections: v.array(UidSchema),
  templateCollections: v.array(UidSchema),
});
