/**
 * Request projection — `Request ⇄ MutationBatch / MaterializedEntity`.
 *
 * Parallel to {@link rule-projection}: the request mutator catalog
 * treats `headers` and `params` as **sets** (parent-owned ordering with
 * itemId-keyed members + fractional indexing), while `Request`
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
 * set-modeled paths and scalars elsewhere) and return a `Request`.
 *
 * Synthetic itemIds live only inside the oracle's in-memory state;
 * each SW cold-wake re-mints them on hydration. Cross-device stability
 * is Phase D scope.
 */

import type { QueryParam, Request, RequestHeader } from '@openheaders/core/types';
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

interface SetMember {
  path: SetPath;
  itemId: string;
  item: RequestHeader | QueryParam;
}

/**
 * Convert a persisted Request into a `MutationBatch` of one `create`
 * for the scalar shell, plus one `addToSet` per member of every
 * set-modeled field. Each member's `uid` doubles as the sync engine's
 * itemId — once persisted (commit `a` of the §7.3 reorder slice),
 * RequestHeader / QueryParam carry stable identity that survives
 * save/reload, so reorder gestures land as `moveBefore` over a known
 * itemId set rather than wholesale `removeFromSet + addToSet`.
 *
 * Per-batch all-or-nothing under the oracle's lock.
 */
export function seedRequest(request: Request, ctx: MutatorContext): MutationBatch {
  const setMembers: SetMember[] = [];
  const scalarShell = stripSetFields(request, setMembers);

  const bodies: MutationBody[] = [
    { kind: 'create', type: REQUEST_ENTITY_TYPE, id: request.uid, payload: scalarShell },
  ];
  for (const { path, itemId, item } of setMembers) {
    bodies.push({
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: request.uid,
      path,
      itemId,
      item,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-entity snapshot)
 * back into a `Request`. Returns `null` when the materialized data
 * fails basic shape checks — callers persist the request only when
 * projection succeeds.
 */
export function projectRequest(materialized: MaterializedEntity): Request | null {
  if (materialized.type !== REQUEST_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  // Materialized data already carries the right shape: scalars are
  // unflattened from per-leaf paths; set-modeled fields are emitted as
  // arrays at their setPath. The cast is honest because seedRequest
  // committed to that shape on the way in.
  return data as Request;
}

// ── internals ─────────────────────────────────────────────────────

function stripSetFields(request: Request, out: SetMember[]): unknown {
  // Deep clone via JSON round-trip — Request has no functions /
  // symbols / Dates; correct-by-construction for the persisted shape.
  // Not a hot path.
  const shell = JSON.parse(JSON.stringify(request)) as Record<string, unknown>;

  for (const h of request.headers) {
    out.push({ path: REQUEST_HEADERS_PATH, itemId: h.uid, item: h });
  }
  delete shell[REQUEST_HEADERS_PATH];

  for (const p of request.params) {
    out.push({ path: REQUEST_PARAMS_PATH, itemId: p.uid, item: p });
  }
  delete shell[REQUEST_PARAMS_PATH];

  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
