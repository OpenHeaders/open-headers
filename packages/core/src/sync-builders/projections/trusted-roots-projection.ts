/**
 * Trusted-roots projection — `TrustedRoots ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * Mirrors `vault-projection.ts` for the singleton trusted-roots
 * entity. The oracle stores roots as set members at `roots` (set
 * member identity = `root.uid`); persisted `TrustedRoots.roots` is a
 * plain array. `seedTrustedRoots` strips the array off the create
 * payload and emits one `addToSet` per root; `projectTrustedRoots` is
 * the inverse over the live set.
 */

import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
  TRUSTED_ROOTS_ENTITY_TYPE,
  TRUSTED_ROOTS_ID,
  TRUSTED_ROOTS_PATH,
} from '@openheaders/core/sync';
import type { TrustedRoot, TrustedRoots } from '@openheaders/core/types';

/**
 * Convert a persisted `TrustedRoots` into a `MutationBatch` of one
 * `create` for the scalar shell plus one `addToSet` per root.
 */
export function seedTrustedRoots(trustedRoots: TrustedRoots, ctx: MutatorContext): MutationBatch {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: TRUSTED_ROOTS_ENTITY_TYPE,
      id: TRUSTED_ROOTS_ID,
      payload: { schemaVersion: trustedRoots.schemaVersion },
    },
  ];
  const nextKey = orderKeyMinter();
  for (const root of trustedRoots.roots) {
    bodies.push({
      kind: 'addToSet',
      type: TRUSTED_ROOTS_ENTITY_TYPE,
      id: TRUSTED_ROOTS_ID,
      path: TRUSTED_ROOTS_PATH,
      itemId: root.uid,
      item: root,
      orderKey: nextKey(),
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Fold the materialized singleton plus its live `roots` set back into
 * a `TrustedRoots`. Returns `null` for a foreign entity type.
 */
export function projectTrustedRoots(
  materialized: MaterializedEntity,
  liveItems: ReadonlyArray<{ itemId: string; item: unknown }>,
): TrustedRoots | null {
  if (materialized.type !== TRUSTED_ROOTS_ENTITY_TYPE) return null;
  const roots: TrustedRoot[] = [];
  for (const entry of liveItems) {
    if (isTrustedRoot(entry.item)) roots.push(entry.item);
  }
  return { schemaVersion: 5, roots };
}

export const isTrustedRoot = (v: unknown): v is TrustedRoot => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.uid === 'string' &&
    typeof r.name === 'string' &&
    typeof r.certPem === 'string' &&
    typeof r.addedAt === 'string'
  );
};
