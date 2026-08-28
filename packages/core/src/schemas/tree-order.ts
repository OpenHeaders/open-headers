/**
 * Tree order — every container's child order across the three sidebar
 * trees, persisted as one record per workspace.
 *
 * The oracle holds each collection's and folder's `folders` and
 * `items` ordered sets — the one containment authority, two conflict
 * units sharing one keyspace; the children render as the merge of
 * both by key. This is the folded projection of that merge: child
 * uids of both kinds in one list per container, keyed by the
 * container's `<type>:<uid>`. The persisted entity arrays carry each
 * kind's order but neither the interleave of folders with leaves nor
 * that of the four request kinds inside one `items` set, so a restart
 * re-seeds slots from this record first and from the arrays only
 * where the record is silent.
 *
 * The legacy entry (`{ folders, items }`, the two runs listed apart)
 * is accepted on read: it is the signal that a container has never
 * been keyed as one order — the hydration pass normalises it once,
 * folders then items, and the record is rewritten in the merged shape.
 */

import * as v from 'valibot';
import { SchemaVersionSchema, UidSchema } from './common';

export const TreeContainerChildrenSchema = v.object({
  children: v.array(UidSchema),
});

export const LegacyTreeContainerOrderSchema = v.object({
  folders: v.array(UidSchema),
  items: v.array(UidSchema),
});

export const TreeContainerOrderSchema = v.union([TreeContainerChildrenSchema, LegacyTreeContainerOrderSchema]);

export const TreeOrderRecordSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  containers: v.record(v.string(), TreeContainerOrderSchema),
});
