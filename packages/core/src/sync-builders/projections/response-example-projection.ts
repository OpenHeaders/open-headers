/**
 * Response-example projection — `ResponseExample ⇄ MutationBatch /
 * MaterializedEntity`. The entity is a frozen flat record, so the seed
 * is a single `create` envelope and the projection is a plain shape
 * check.
 */

import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { ResponseExample } from '@openheaders/core/types';

export function seedResponseExample(example: ResponseExample, ctx: MutatorContext): MutationBatch {
  const payload = JSON.parse(JSON.stringify(example)) as Record<string, unknown>;
  const bodies: MutationBody[] = [{ kind: 'create', type: RESPONSE_EXAMPLE_ENTITY_TYPE, id: example.uid, payload }];
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into a `ResponseExample`. Returns
 * `null` when the materialized data fails basic shape checks — callers
 * persist only when projection succeeds.
 */
export function projectResponseExample(materialized: MaterializedEntity): ResponseExample | null {
  if (materialized.type !== RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as ResponseExample;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
