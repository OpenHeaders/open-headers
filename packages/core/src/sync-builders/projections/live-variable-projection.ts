/**
 * Live-variable projection — `LiveVariable ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * The catalog treats `manualOverride` as a whole-object scalar — set or
 * cleared as a single gesture. The generic `create` mutation flattens
 * objects to per-leaf paths, which would split `manualOverride` into
 * `manualOverride.value` / `manualOverride.until` leaves and conflict
 * with a later `setField('manualOverride', wholeObject)` (one leaf at
 * `manualOverride`, several leaves at `manualOverride.*`). `seedLiveVariable`
 * therefore strips the override off the create payload and emits a
 * `setField('manualOverride', value)` envelope for it in the same batch
 * — the oracle's lock keeps the pair atomic.
 */

import {
  type MaterializedEntity,
  LIVE_VARIABLE_ENTITY_TYPE,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
} from '@openheaders/core/sync';
import type { LiveVariable } from '@openheaders/core/types';
const MANUAL_OVERRIDE_PATH = 'manualOverride';

export function seedLiveVariable(liveVariable: LiveVariable, ctx: MutatorContext): MutationBatch {
  const shell = JSON.parse(JSON.stringify(liveVariable)) as Record<string, unknown>;
  const override = shell[MANUAL_OVERRIDE_PATH];
  delete shell[MANUAL_OVERRIDE_PATH];

  const bodies: MutationBody[] = [
    { kind: 'create', type: LIVE_VARIABLE_ENTITY_TYPE, id: liveVariable.uid, payload: shell },
  ];
  if (override !== undefined) {
    bodies.push({
      kind: 'setField',
      type: LIVE_VARIABLE_ENTITY_TYPE,
      id: liveVariable.uid,
      path: MANUAL_OVERRIDE_PATH,
      value: override,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-LV snapshot) back
 * into a `LiveVariable`. Returns `null` when the materialized data
 * fails basic shape checks — callers persist only when projection
 * succeeds.
 */
export function projectLiveVariable(materialized: MaterializedEntity): LiveVariable | null {
  if (materialized.type !== LIVE_VARIABLE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as LiveVariable;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
