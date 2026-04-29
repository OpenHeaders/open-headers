/**
 * Rule projection — `V5.Rule ⇄ MutationBatch / MaterializedEntity`.
 *
 * The oracle's data model and the persisted V5 rule shape diverge in
 * one architecturally-load-bearing way: the rule mutator catalog
 * treats `conditions`, `action.requestHeaders`, and
 * `action.responseHeaders` as **sets** (parent-owned ordering with
 * itemId-keyed members + fractional indexing), while V5.Rule persists
 * those same fields as plain arrays without per-item identifiers.
 *
 * The generic `create` mutation, by contrast, would flatten any array
 * to numeric-indexed leaves (`action.requestHeaders.0.headerName = …`).
 * If we ever produce both representations on the same path, the
 * materializer emits two leaves at the same path and `unflattenLeaves`
 * silently overwrites one with the other — a real correctness hazard.
 *
 * `seedRule` therefore strips the set-modeled fields off the create
 * payload and emits one `addToSet` per item with a freshly-minted
 * itemId. `projectRule` is the inverse: read the oracle's
 * MaterializedEntity (which already carries the array form for
 * set-modeled paths and scalars elsewhere) and return a V5.Rule.
 *
 * Synthetic itemIds live only inside the oracle's in-memory state.
 * The persisted V5.Rule on chrome.storage.local has no itemId field,
 * matching the v5 schema as-shipped. Each SW cold-wake re-mints fresh
 * itemIds on hydration — fine for Phase A (single-device, in-process
 * convergence only). Cross-device stability would require persisting
 * the oracle's full state, which is Phase D scope.
 */

import { generateUid } from '@openheaders/core/utils';
import type { V5 } from '@openheaders/core/types';
import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  RULE_ENTITY_TYPE,
  type MutatorContext,
} from '@openheaders/core/sync';

/**
 * Set-modeled field paths on a Rule. The mutator catalog
 * (`addCondition`, `addHeaderMod`) writes set members at exactly these
 * paths, so seeding has to mirror them verbatim — anything else here
 * would split the path representation between create-time and
 * mutation-time.
 */
const SET_PATHS = ['conditions', 'action.requestHeaders', 'action.responseHeaders'] as const;
type SetPath = (typeof SET_PATHS)[number];

/**
 * Convert a persisted V5.Rule into a `MutationBatch` of one `create`
 * for the scalar + non-set-modeled fields, plus one `addToSet` per
 * member of every set-modeled field. The batch is all-or-nothing under
 * the oracle's per-entity lock — partial seeding is impossible.
 */
export function seedRule(rule: V5.Rule, ctx: MutatorContext): MutationBatch {
  const setItems: Array<{ path: SetPath; item: unknown }> = [];
  const scalarShell = stripSetFields(rule, setItems);

  const bodies: MutationBody[] = [
    { kind: 'create', type: RULE_ENTITY_TYPE, id: rule.uid, payload: scalarShell },
  ];
  for (const { path, item } of setItems) {
    bodies.push({
      kind: 'addToSet',
      type: RULE_ENTITY_TYPE,
      id: rule.uid,
      path,
      itemId: generateUid(),
      item,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-entity snapshot)
 * back into a V5.Rule. Returns `null` when the materialized data fails
 * basic shape checks — callers persist the rule only when projection
 * succeeds.
 */
export function projectRule(materialized: MaterializedEntity): V5.Rule | null {
  if (materialized.type !== RULE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  // Materialized data already carries the right shape: scalars are
  // unflattened from per-leaf paths; set-modeled fields are emitted as
  // arrays at their setPath. The cast is honest because seedRule
  // committed to that shape on the way in.
  return data as V5.Rule;
}

// ── internals ─────────────────────────────────────────────────────

function stripSetFields(rule: V5.Rule, out: Array<{ path: SetPath; item: unknown }>): unknown {
  // Deep clone is overkill; we copy the shell and replace the
  // set-modeled slots with pruned versions. JSON round-trip is the
  // simplest correct-by-construction approach for V5.Rule's deep
  // shape (uid, path, action.*, conditions[]) — we're not on a hot
  // path here.
  const shell = JSON.parse(JSON.stringify(rule)) as Record<string, unknown>;

  // conditions lives at the top level on every rule variant.
  const conditions = shell.conditions;
  if (Array.isArray(conditions)) {
    for (const cond of conditions) out.push({ path: 'conditions', item: cond });
  }
  delete shell.conditions;

  // header rules carry set-modeled requestHeaders + responseHeaders on
  // the action. Other rule variants don't expose these paths to the
  // catalog, so we leave their actions intact (params on query-param,
  // body / mock / etc. ride as scalar leaves).
  if (rule.type === 'header') {
    const action = shell.action;
    if (isPlainObject(action)) {
      const req = action.requestHeaders;
      if (Array.isArray(req)) {
        for (const mod of req) out.push({ path: 'action.requestHeaders', item: mod });
      }
      const res = action.responseHeaders;
      if (Array.isArray(res)) {
        for (const mod of res) out.push({ path: 'action.responseHeaders', item: mod });
      }
      delete action.requestHeaders;
      delete action.responseHeaders;
    }
  }

  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
