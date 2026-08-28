/**
 * Tree order — every container's child order across the three sidebar
 * trees, persisted as one record per workspace.
 *
 * The oracle holds each collection's and folder's `folders` and
 * `items` ordered sets — the one containment authority; this is the
 * folded projection of those sets, uids in slot order, keyed by the
 * container's `<type>:<uid>`. The persisted entity arrays carry each
 * kind's order but not the interleave of the four request kinds
 * inside one `items` set, so a restart re-seeds leaf slots from this
 * record first and from the arrays only where the record is silent.
 */

import * as v from 'valibot';
import { SchemaVersionSchema, UidSchema } from './common';

export const TreeContainerOrderSchema = v.object({
  folders: v.array(UidSchema),
  items: v.array(UidSchema),
});

export const TreeOrderRecordSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  containers: v.record(v.string(), TreeContainerOrderSchema),
});
