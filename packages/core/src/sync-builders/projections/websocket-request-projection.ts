/**
 * WebSocketRequest projection — `WebSocketRequest ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * Parallel to {@link request-projection}: the WebSocket-request entity
 * treats `headers`, `params` and `events` as **sets** (parent-owned
 * ordering with itemId-keyed members + fractional indexing), while
 * `WebSocketRequest` persists them as plain arrays.
 * `seedWebSocketRequest` strips the set-modeled fields off the create
 * payload and emits one `addToSet` per row keyed by the row's own uid;
 * `projectWebSocketRequest` reads the oracle's MaterializedEntity back
 * into a `WebSocketRequest`.
 */

import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WEBSOCKET_REQUEST_EVENTS_PATH,
  WEBSOCKET_REQUEST_HEADERS_PATH,
  WEBSOCKET_REQUEST_PARAMS_PATH,
} from '@openheaders/core/sync';
import type { WebSocketRequest } from '@openheaders/core/types';

/** Set-modeled paths on a WebSocketRequest, with their row readers. */
const SET_PATHS = [
  WEBSOCKET_REQUEST_HEADERS_PATH,
  WEBSOCKET_REQUEST_PARAMS_PATH,
  WEBSOCKET_REQUEST_EVENTS_PATH,
] as const;

/**
 * Convert a persisted WebSocketRequest into a `MutationBatch` of one
 * `create` for the scalar shell plus one `addToSet` per header/param
 * row. Each row's `uid` doubles as the sync engine's itemId, so
 * reorder gestures land as `moveBefore` over a known itemId set.
 * Per-batch all-or-nothing under the oracle's lock.
 */
export function seedWebSocketRequest(request: WebSocketRequest, ctx: MutatorContext): MutationBatch {
  // Deep clone via JSON round-trip — WebSocketRequest has no functions /
  // symbols / Dates; correct-by-construction for the persisted shape.
  const shell = JSON.parse(JSON.stringify(request)) as Record<string, unknown>;
  for (const path of SET_PATHS) delete shell[path];

  const bodies: MutationBody[] = [
    { kind: 'create', type: WEBSOCKET_REQUEST_ENTITY_TYPE, id: request.uid, payload: shell },
  ];
  // Sequential orderKeys — a keyless addToSet defaults every row to the
  // same seedKey(), collapsing creation order to the uid tie-break.
  for (const path of SET_PATHS) {
    const rows =
      path === WEBSOCKET_REQUEST_HEADERS_PATH
        ? request.headers
        : path === WEBSOCKET_REQUEST_PARAMS_PATH
          ? request.params
          : (request.events ?? []);
    const nextKey = orderKeyMinter();
    for (const row of rows) {
      bodies.push({
        kind: 'addToSet',
        type: WEBSOCKET_REQUEST_ENTITY_TYPE,
        id: request.uid,
        path,
        itemId: row.uid,
        item: row,
        orderKey: nextKey(),
      });
    }
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into a `WebSocketRequest`.
 * Returns `null` when the materialized data fails basic shape checks —
 * callers persist only when projection succeeds.
 */
export function projectWebSocketRequest(materialized: MaterializedEntity): WebSocketRequest | null {
  if (materialized.type !== WEBSOCKET_REQUEST_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  // Materialized data already carries the right shape: scalars are
  // unflattened from per-leaf paths; `headers` / `params` / `events`
  // are emitted as arrays at their setPaths. The cast is honest because
  // seedWebSocketRequest committed to that shape on the way in.
  const request = data as WebSocketRequest;
  // The store emits [] for every registered set path, but `events` is
  // schema-optional and an empty list means the same thing as absence
  // (no display filter) — normalize so the projection round-trips the
  // persisted shape.
  if (request.events !== undefined && request.events.length === 0) {
    const { events, ...rest } = request;
    void events;
    return rest;
  }
  return request;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
