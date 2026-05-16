/**
 * Valibot schema for {@link ActivityEntry}.
 *
 * Validates the wire / storage shape at the boundary — when reading
 * an entry back from durable storage, or when receiving an entry
 * over the wire from a peer's activity stream (a Phase D extension).
 * Internal callers continue to pay no runtime cost.
 *
 * Strict closed-set of kinds — we own both ends of the wire and v5
 * has zero users, so an unknown kind from the future is a bug to
 * surface, not a forward-compat case to absorb.
 */
import * as v from 'valibot';

import { HlcSchema } from '../hlc/schema';
import type { ActivityEntry, ActivityEntryKind } from './types';

export const ActivityEntryKindSchema = v.picklist([
  'create-entity',
  'edit-entity',
  'delete-entity',
  'supersede-local-edit',
  'sensitive-field-rotation',
  'permission-scope-expansion',
] as const satisfies readonly ActivityEntryKind[]);

const MutationOriginSchema = v.object({
  surfaceId: v.pipe(v.string(), v.minLength(1)),
  deviceId: v.pipe(v.string(), v.minLength(1)),
  userId: v.optional(v.string()),
});

export const ActivityEntrySchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  mutationId: v.pipe(v.string(), v.minLength(1)),
  hlc: HlcSchema,
  kind: ActivityEntryKindSchema,
  entityType: v.pipe(v.string(), v.minLength(1)),
  entityId: v.pipe(v.string(), v.minLength(1)),
  origin: MutationOriginSchema,
  observedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  read: v.boolean(),
  summary: v.optional(v.string()),
  context: v.optional(v.record(v.string(), v.unknown())),
}) satisfies v.GenericSchema<ActivityEntry>;
