/**
 * Request projection — `V5.Request ⇄ MutationBatch / MaterializedEntity`.
 *
 * Parallel to {@link rule-projection}: the request mutator catalog
 * treats `headers` and `params` as **sets** (parent-owned ordering with
 * itemId-keyed members + fractional indexing), while `V5.Request`
 * persists them as plain arrays without per-item identifiers.
 *
 * The generic `create` mutation flattens any array to numeric-indexed
 * leaves. If we ever produce both representations on the same path
 * the materializer emits two leaves and `unflattenLeaves` silently
 * overwrites one — a real correctness hazard.
 *
 * `seedRequest` therefore strips the set-modeled fields off the create
 * payload and emits one `addToSet` per item with a freshly-minted
 * itemId. `projectRequest` is the inverse: read the oracle's
 * MaterializedEntity (which already carries the array form for
 * set-modeled paths and scalars elsewhere) and return a `V5.Request`.
 *
 * Synthetic itemIds live only inside the oracle's in-memory state;
 * each SW cold-wake re-mints them on hydration. Cross-device stability
 * is Phase D scope.
 */

import { generateUid } from '@openheaders/core/utils';
import type { V5 } from '@openheaders/core/types';
import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  REQUEST_ENTITY_TYPE,
  REQUEST_HEADERS_PATH,
  REQUEST_PARAMS_PATH,
  type MutatorContext,
} from '@openheaders/core/sync';

/**
 * Set-modeled field paths on a Request. The mutator catalog
 * (`addRequestHeader` / `addRequestParam`) writes set members at
 * exactly these paths, so seeding has to mirror them verbatim — anything
 * else here would split the path representation between create-time
 * and mutation-time.
 */
const SET_PATHS = [REQUEST_HEADERS_PATH, REQUEST_PARAMS_PATH] as const;
type SetPath = (typeof SET_PATHS)[number];

/**
 * Convert a persisted V5.Request into a `MutationBatch` of one `create`
 * for the scalar shell, plus one `addToSet` per member of every
 * set-modeled field. Per-batch all-or-nothing under the oracle's lock.
 */
export function seedRequest(request: V5.Request, ctx: MutatorContext): MutationBatch {
  const setItems: Array<{ path: SetPath; item: unknown }> = [];
  const scalarShell = stripSetFields(request, setItems);

  const bodies: MutationBody[] = [
    { kind: 'create', type: REQUEST_ENTITY_TYPE, id: request.uid, payload: scalarShell },
  ];
  for (const { path, item } of setItems) {
    bodies.push({
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: request.uid,
      path,
      itemId: generateUid(),
      item,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-entity snapshot)
 * back into a `V5.Request`. Returns `null` when the materialized data
 * fails basic shape checks — callers persist the request only when
 * projection succeeds.
 */
export function projectRequest(materialized: MaterializedEntity): V5.Request | null {
  if (materialized.type !== REQUEST_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  // Materialized data already carries the right shape: scalars are
  // unflattened from per-leaf paths; set-modeled fields are emitted as
  // arrays at their setPath. The cast is honest because seedRequest
  // committed to that shape on the way in.
  return data as V5.Request;
}

// ── internals ─────────────────────────────────────────────────────

function stripSetFields(request: V5.Request, out: Array<{ path: SetPath; item: unknown }>): unknown {
  // Deep clone via JSON round-trip — V5.Request has no functions /
  // symbols / Dates; correct-by-construction for the persisted shape.
  // Not a hot path.
  const shell = JSON.parse(JSON.stringify(request)) as Record<string, unknown>;

  const headers = shell[REQUEST_HEADERS_PATH];
  if (Array.isArray(headers)) {
    for (const h of headers) out.push({ path: REQUEST_HEADERS_PATH, item: h });
  }
  delete shell[REQUEST_HEADERS_PATH];

  const params = shell[REQUEST_PARAMS_PATH];
  if (Array.isArray(params)) {
    for (const p of params) out.push({ path: REQUEST_PARAMS_PATH, item: p });
  }
  delete shell[REQUEST_PARAMS_PATH];

  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
