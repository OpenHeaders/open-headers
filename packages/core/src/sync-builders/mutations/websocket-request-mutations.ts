/**
 * WebSocketRequest write-site → oracle helpers.
 *
 * Parallel to {@link request-mutations}: write sites produce
 * `(batch, sideEffects)` pairs as pure transforms — no oracle reads,
 * no IO. The three set-modeled fields (`headers`, `params`, `events`)
 * route through the shared {@link synthesizeSetDiff} minimum-envelope
 * synthesizer; container-valued scalars (`subprotocols`, `specLink`,
 * `auth`) route through {@link synthesizeFieldDiff} so edits share
 * create's per-leaf representation and a cleared object tombstones
 * its leaves.
 *
 * No side-effect intents: WebSocket requests don't feed DNR or the
 * variables resolver.
 */

import {
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  type SideEffectIntent,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WEBSOCKET_REQUEST_EVENTS_PATH,
  WEBSOCKET_REQUEST_HEADERS_PATH,
  WEBSOCKET_REQUEST_PARAMS_PATH,
} from '@openheaders/core/sync';
import { type LiveSetEntry, synthesizeFieldDiff, synthesizeSetDiff } from '@openheaders/core/sync-builders';
import type { WebSocketRequest } from '@openheaders/core/types';
import { seedWebSocketRequest } from '../projections/websocket-request-projection';

export interface WebSocketRequestMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/** Live-itemId reader for the set paths — see {@link request-mutations}' LiveSetEntries. */
export type WebSocketLiveSetEntries = (webSocketRequestUid: string, setPath: string) => ReadonlyArray<LiveSetEntry>;

/** Current materialized value reader for container-valued scalar paths (`subprotocols`, `specLink`, `auth`). */
export type WebSocketLiveFieldValue = (webSocketRequestUid: string, path: string) => unknown;

/** New WebSocket request → seed batch. No side effects. */
export function buildWebSocketAddBatch(
  request: WebSocketRequest,
  ctx: MutatorContext,
): WebSocketRequestMutationPayload {
  return { batch: seedWebSocketRequest(request, ctx), sideEffects: [] };
}

/** Delete a WebSocket request. Tombstone is permanent under §7.2 delete-wins. */
export function buildWebSocketDeleteBatch(
  webSocketRequestUid: string,
  ctx: MutatorContext,
): WebSocketRequestMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: WEBSOCKET_REQUEST_ENTITY_TYPE, id: webSocketRequestUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

const SET_PATHS = [
  WEBSOCKET_REQUEST_HEADERS_PATH,
  WEBSOCKET_REQUEST_PARAMS_PATH,
  WEBSOCKET_REQUEST_EVENTS_PATH,
] as const;
type SetPath = (typeof SET_PATHS)[number];

const isSetPath = (key: string): SetPath | null =>
  key === WEBSOCKET_REQUEST_HEADERS_PATH
    ? WEBSOCKET_REQUEST_HEADERS_PATH
    : key === WEBSOCKET_REQUEST_PARAMS_PATH
      ? WEBSOCKET_REQUEST_PARAMS_PATH
      : key === WEBSOCKET_REQUEST_EVENTS_PATH
        ? WEBSOCKET_REQUEST_EVENTS_PATH
        : null;

/**
 * Translate a `Partial<Omit<WebSocketRequest, 'uid'|'path'>>` patch
 * into a single batch. Scalar fields → one `setField` per leaf;
 * `headers` / `params` / `events` → minimum diff via
 * {@link synthesizeSetDiff}; `subprotocols` / `specLink` / `auth` →
 * per-leaf flatten-diff via {@link synthesizeFieldDiff}.
 */
export function buildWebSocketUpdateBatch(
  webSocketRequestUid: string,
  updates: Partial<Omit<WebSocketRequest, 'uid' | 'path'>>,
  ctx: MutatorContext,
  liveSetEntries: WebSocketLiveSetEntries,
  liveFieldValue: WebSocketLiveFieldValue,
): WebSocketRequestMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    const setPath = isSetPath(key);
    if (setPath && Array.isArray(value)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: WEBSOCKET_REQUEST_ENTITY_TYPE,
          id: webSocketRequestUid,
          path: setPath,
          live: liveSetEntries(webSocketRequestUid, setPath),
          newItems: value,
        }),
      );
      continue;
    }

    // Container-valued scalars (`subprotocols`, `specLink`) — emit a
    // per-leaf flatten-diff so the edit shares create's representation.
    if (value !== null && typeof value === 'object') {
      bodies.push(
        ...synthesizeFieldDiff({
          type: WEBSOCKET_REQUEST_ENTITY_TYPE,
          id: webSocketRequestUid,
          basePath: key,
          oldValue: liveFieldValue(webSocketRequestUid, key),
          newValue: value,
        }),
      );
      continue;
    }

    bodies.push({ kind: 'setField', type: WEBSOCKET_REQUEST_ENTITY_TYPE, id: webSocketRequestUid, path: key, value });
  }

  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
