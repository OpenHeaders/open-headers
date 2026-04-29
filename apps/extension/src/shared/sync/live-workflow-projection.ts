/**
 * Live-workflow projection — `V5.LiveWorkflow ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * The catalog treats `steps` as a whole-array scalar (per-step LWW
 * isn't a v1 primitive — see catalog `types.ts`) and `refresh` as a
 * whole-policy scalar. The generic `create` mutation flattens both into
 * per-leaf paths, which would conflict with a later `setField('steps',
 * wholeArray)` / `setField('refresh', wholePolicy)`. `seedLiveWorkflow`
 * therefore strips both fields off the create payload and emits one
 * `setField` per stripped field in the same batch — the oracle's lock
 * keeps the pair atomic.
 */

import {
  type MaterializedEntity,
  LIVE_WORKFLOW_ENTITY_TYPE,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';

const STEPS_PATH = 'steps';
const REFRESH_PATH = 'refresh';

export function seedLiveWorkflow(workflow: V5.LiveWorkflow, ctx: MutatorContext): MutationBatch {
  const shell = JSON.parse(JSON.stringify(workflow)) as Record<string, unknown>;
  const steps = shell[STEPS_PATH];
  const refresh = shell[REFRESH_PATH];
  delete shell[STEPS_PATH];
  delete shell[REFRESH_PATH];

  const bodies: MutationBody[] = [
    { kind: 'create', type: LIVE_WORKFLOW_ENTITY_TYPE, id: workflow.uid, payload: shell },
  ];
  if (steps !== undefined) {
    bodies.push({
      kind: 'setField',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: workflow.uid,
      path: STEPS_PATH,
      value: steps,
    });
  }
  if (refresh !== undefined) {
    bodies.push({
      kind: 'setField',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: workflow.uid,
      path: REFRESH_PATH,
      value: refresh,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-LW snapshot) back
 * into a `V5.LiveWorkflow`. Returns `null` when the materialized data
 * fails basic shape checks.
 */
export function projectLiveWorkflow(materialized: MaterializedEntity): V5.LiveWorkflow | null {
  if (materialized.type !== LIVE_WORKFLOW_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as V5.LiveWorkflow;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
