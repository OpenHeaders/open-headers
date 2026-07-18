/**
 * WebSocket response-example projection — `WsResponseExample ⇄
 * MutationBatch / MaterializedEntity`. The entity is a frozen flat
 * record, so the seed is a single `create` envelope and the projection
 * is a plain shape check.
 */

import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { WsResponseExample } from '@openheaders/core/types';

export function seedWsResponseExample(example: WsResponseExample, ctx: MutatorContext): MutationBatch {
  const payload = JSON.parse(JSON.stringify(example)) as Record<string, unknown>;
  const bodies: MutationBody[] = [{ kind: 'create', type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE, id: example.uid, payload }];
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into a `WsResponseExample`.
 * Returns `null` when the materialized data fails basic shape checks —
 * callers persist only when projection succeeds.
 */
export function projectWsResponseExample(materialized: MaterializedEntity): WsResponseExample | null {
  if (materialized.type !== WS_RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as WsResponseExample;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
