/**
 * Template projection — `Template ⇄ MutationBatch / MaterializedEntity`.
 *
 * Parallel to {@link request-projection}: the template mutator catalog
 * treats `conditions` as a **set** (per-row addToSet with synthetic
 * itemIds), while `Template` persists it as a plain array without
 * per-item identifiers.
 *
 * The generic `create` mutation flattens any array to numeric-indexed
 * leaves. If we ever produce both representations on the same path the
 * materializer emits two leaves and `unflattenLeaves` silently
 * overwrites one — a real correctness hazard.
 *
 * `seedTemplate` therefore strips `conditions` off the create payload
 * and emits one `addToSet` per condition, keying each set member by
 * the row's persisted `uid` (schema-required on `RuleCondition` per
 * session-40 schema bump). Identity preservation across save/reload is
 * what lets the unified set-diff synthesizer take the LIS-optimal
 * `moveBefore` fast path on the first save after a cold wake. Mirrors
 * `seedRequest` (session 39). `projectTemplate` is the inverse: read
 * the oracle's MaterializedEntity (which already carries the array
 * form for set-modeled paths and scalars elsewhere) and return a
 * `Template`.
 *
 * `formValues` and `includes` ride the create payload as scalars per
 * the catalog's v1 trade-off (whole-object replacement; per-field LWW
 * within either would need branch-aware paths).
 */

import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
  TEMPLATE_CONDITIONS_PATH,
  TEMPLATE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Template } from '@openheaders/core/types';

/**
 * Convert a persisted Template into a `MutationBatch` of one `create`
 * for the scalar shell, plus one `addToSet` per condition. Per-batch
 * all-or-nothing under the oracle's lock.
 */
export function seedTemplate(template: Template, ctx: MutatorContext): MutationBatch {
  const conditions: unknown[] = [];
  const scalarShell = stripConditions(template, conditions);

  const bodies: MutationBody[] = [
    { kind: 'create', type: TEMPLATE_ENTITY_TYPE, id: template.uid, payload: scalarShell },
  ];
  // Sequential orderKeys — a keyless addToSet defaults every row to the
  // same seedKey(), collapsing creation order to the uid tie-break at
  // materialize time.
  const nextKey = orderKeyMinter();
  for (const item of conditions) {
    const itemId = readUid(item);
    bodies.push({
      kind: 'addToSet',
      type: TEMPLATE_ENTITY_TYPE,
      id: template.uid,
      path: TEMPLATE_CONDITIONS_PATH,
      itemId,
      item,
      orderKey: nextKey(),
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Read the persisted `uid` off a template condition. RuleCondition
 * carries `uid: UidSchema` (schema-required, session 40). Using the
 * persisted uid as itemId — instead of minting fresh — is what lets
 * the unified set-diff synthesizer take the LIS-optimal `moveBefore`
 * fast path on the first save after a cold wake. Mirrors
 * {@link seedRule.readUid} / {@link seedRequest}.
 */
function readUid(item: unknown): string {
  if (isPlainObject(item) && typeof item.uid === 'string' && item.uid.length > 0) {
    return item.uid;
  }
  throw new Error('seedTemplate: condition is missing required `uid` field');
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-template snapshot)
 * back into a `Template`. Returns `null` when the materialized data
 * fails basic shape checks — callers persist the template only when
 * projection succeeds.
 */
export function projectTemplate(materialized: MaterializedEntity): Template | null {
  if (materialized.type !== TEMPLATE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as Template;
}

// ── internals ─────────────────────────────────────────────────────

function stripConditions(template: Template, out: unknown[]): unknown {
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
