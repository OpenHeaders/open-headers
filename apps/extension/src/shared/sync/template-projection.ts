/**
 * Template projection — `V5.Template ⇄ MutationBatch / MaterializedEntity`.
 *
 * Parallel to {@link request-projection}: the template mutator catalog
 * treats `conditions` as a **set** (per-row addToSet with synthetic
 * itemIds), while `V5.Template` persists it as a plain array without
 * per-item identifiers.
 *
 * The generic `create` mutation flattens any array to numeric-indexed
 * leaves. If we ever produce both representations on the same path the
 * materializer emits two leaves and `unflattenLeaves` silently
 * overwrites one — a real correctness hazard.
 *
 * `seedTemplate` therefore strips `conditions` off the create payload
 * and emits one `addToSet` per condition with a freshly-minted itemId.
 * `projectTemplate` is the inverse: read the oracle's MaterializedEntity
 * (which already carries the array form for set-modeled paths and
 * scalars elsewhere) and return a `V5.Template`.
 *
 * `formValues` and `includes` ride the create payload as scalars per
 * the catalog's v1 trade-off (whole-object replacement; per-field LWW
 * within either would need branch-aware paths).
 */

import { generateUid } from '@openheaders/core/utils';
import type { V5 } from '@openheaders/core/types';
import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  TEMPLATE_CONDITIONS_PATH,
  TEMPLATE_ENTITY_TYPE,
  type MutatorContext,
} from '@openheaders/core/sync';

/**
 * Convert a persisted V5.Template into a `MutationBatch` of one `create`
 * for the scalar shell, plus one `addToSet` per condition. Per-batch
 * all-or-nothing under the oracle's lock.
 */
export function seedTemplate(template: V5.Template, ctx: MutatorContext): MutationBatch {
  const conditions: unknown[] = [];
  const scalarShell = stripConditions(template, conditions);

  const bodies: MutationBody[] = [
    { kind: 'create', type: TEMPLATE_ENTITY_TYPE, id: template.uid, payload: scalarShell },
  ];
  for (const item of conditions) {
    bodies.push({
      kind: 'addToSet',
      type: TEMPLATE_ENTITY_TYPE,
      id: template.uid,
      path: TEMPLATE_CONDITIONS_PATH,
      itemId: generateUid(),
      item,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-template snapshot)
 * back into a `V5.Template`. Returns `null` when the materialized data
 * fails basic shape checks — callers persist the template only when
 * projection succeeds.
 */
export function projectTemplate(materialized: MaterializedEntity): V5.Template | null {
  if (materialized.type !== TEMPLATE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as V5.Template;
}

// ── internals ─────────────────────────────────────────────────────

function stripConditions(template: V5.Template, out: unknown[]): unknown {
  const shell = JSON.parse(JSON.stringify(template)) as Record<string, unknown>;
  const conds = shell[TEMPLATE_CONDITIONS_PATH];
  if (Array.isArray(conds)) {
    for (const c of conds) out.push(c);
  }
  delete shell[TEMPLATE_CONDITIONS_PATH];
  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
