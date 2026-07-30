/**
 * WebSocket request editor draft — the form-local shape plus the
 * draft ⇄ entity projections. Mirrors the gRPC editor's `draft.ts`
 * anatomy: `draftFromWebSocketRequest` populates the form,
 * `buildWebSocketRequestUpdates` emits the save patch, and
 * `canonicalWebSocketRequestProjection` projects the live entity into
 * the same shape so the dirty fingerprint compares apples-to-apples
 * (derived dirty — never setDirty).
 *
 * `flavor` is deliberately NOT part of the draft: the creation menu's
 * two entries fix it at birth and the editor renders it as identity
 * chrome, so the save patch never carries it.
 */

import type {
  WebSocketAuth,
  WebSocketEventRow,
  WebSocketHeaderPair,
  WebSocketMessageFormat,
  WebSocketQueryParam,
  WebSocketRequest,
  WebSocketSpecLink,
} from '@openheaders/core/types';
import { type KeyValueRow, makeKvRow } from '../request-editor/KeyValueTable';

export interface WebSocketDraft {
  /** Docs-tab markdown; always concrete in the form (`''` = no docs) —
   *  the save patch emits it verbatim so clearing round-trips (an
   *  update skips only `undefined` values). */
  description: string;
  url: string;
  subprotocols: string[];
  headers: KeyValueRow[];
  params: KeyValueRow[];
  message: string;
  /** Socket.IO compose: event name for the next Send (concrete in the
   *  form — absent on the entity reads as ''). Raw flavor ignores it. */
  eventName: string;
  /** Socket.IO namespace (concrete — absent reads as '', the root). */
  namespace: string;
  /** Socket.IO ack opt-in (concrete — absent reads as off). */
  ackEnabled: boolean;
  /** Session credential (concrete — absent on the entity reads as
   *  `{ type: 'none' }`). */
  auth: WebSocketAuth;
  /** Events-tab rows (socketio flavor; concrete — absent reads as []).
   *  Rows keep the entity shape; the grid's trailing ghost trims away
   *  in the save projection like the header/param rows. */
  events: WebSocketEventRow[];
  /** Concrete in the form — absent on the entity reads as `text`. */
  messageFormat: WebSocketMessageFormat;
  specLink: WebSocketSpecLink | undefined;
  /** Local socket / named pipe the session dials instead of TCP —
   *  `undefined` = a normal TCP connection. */
  unixSocketPath: string | undefined;
  timeoutMs: number | undefined;
  /** Concrete in the form — absent on the entity reads as verify-on
   *  (the safe default the transport applies). */
  sslVerification: boolean;
}

export interface WebSocketRequestUpdates {
  description: string;
  url: string;
  subprotocols: string[];
  headers: WebSocketHeaderPair[];
  params: WebSocketQueryParam[];
  auth: WebSocketAuth;
  events: WebSocketEventRow[];
  message: string;
  eventName: string;
  namespace: string;
  ackEnabled: boolean;
  messageFormat: WebSocketMessageFormat;
  specLink: WebSocketSpecLink | undefined;
  unixSocketPath: string | undefined;
  timeoutMs: number | undefined;
  sslVerification: boolean;
}

export function headersToRows(pairs: readonly WebSocketHeaderPair[]): KeyValueRow[] {
  return pairs.map((p) =>
    makeKvRow({
      uid: p.uid,
      key: p.key,
      value: p.value,
      description: p.description ?? '',
      enabled: p.enabled ?? true,
    }),
  );
}

export function rowsToHeaders(rows: KeyValueRow[]): WebSocketHeaderPair[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({
      uid: r.uid,
      key: r.key,
      value: r.value,
      description: r.description?.trim() ? r.description : undefined,
      enabled: r.enabled,
    }));
}

/** Params share the header row anatomy in the Phase B table — the
 *  `hasEquals` URL round-trip marker joins with the URL⇄params sync
 *  (a later phase), so both projections normalize it away for now. */
export function paramsToRows(pairs: readonly WebSocketQueryParam[]): KeyValueRow[] {
  return pairs.map((p) =>
    makeKvRow({
      uid: p.uid,
      key: p.key,
      value: p.value,
      description: p.description ?? '',
      enabled: p.enabled ?? true,
    }),
  );
}

export function rowsToParams(rows: KeyValueRow[]): WebSocketQueryParam[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({
      uid: r.uid,
      key: r.key,
      value: r.value,
      description: r.description?.trim() ? r.description : undefined,
      enabled: r.enabled,
    }));
}

/** Trim the Events grid's trailing ghost + unnamed rows away — the
 *  header/param projection's law applied to the events row shape. */
export function rowsToEvents(rows: WebSocketEventRow[]): WebSocketEventRow[] {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => ({
      uid: r.uid,
      name: r.name,
      ...(r.listen !== undefined ? { listen: r.listen } : {}),
      ...(r.description?.trim() ? { description: r.description } : {}),
    }));
}

export function draftFromWebSocketRequest(req: WebSocketRequest): WebSocketDraft {
  return {
    description: req.description ?? '',
    url: req.url,
    subprotocols: [...req.subprotocols],
    headers: headersToRows(req.headers),
    params: paramsToRows(req.params),
    auth: req.auth ?? { type: 'none' },
    events: (req.events ?? []).map((row) => ({ ...row })),
    message: req.message,
    eventName: req.eventName ?? '',
    namespace: req.namespace ?? '',
    ackEnabled: req.ackEnabled ?? false,
    messageFormat: req.messageFormat ?? 'text',
    specLink: req.specLink,
    unixSocketPath: req.unixSocketPath,
    timeoutMs: req.timeoutMs,
    sslVerification: req.sslVerification ?? true,
  };
}

export function buildWebSocketRequestUpdates(draft: WebSocketDraft): WebSocketRequestUpdates {
  return {
    description: draft.description,
    url: draft.url,
    subprotocols: draft.subprotocols,
    headers: rowsToHeaders(draft.headers),
    params: rowsToParams(draft.params),
    auth: draft.auth,
    events: rowsToEvents(draft.events),
    message: draft.message,
    eventName: draft.eventName,
    namespace: draft.namespace,
    ackEnabled: draft.ackEnabled,
    messageFormat: draft.messageFormat,
    specLink: draft.specLink,
    unixSocketPath: draft.unixSocketPath,
    timeoutMs: draft.timeoutMs,
    sslVerification: draft.sslVerification,
  };
}

/** Project a live `WebSocketRequest` into the same shape
 *  `buildWebSocketRequestUpdates` emits — fingerprint comparison stays
 *  apples-to-apples. */
export function canonicalWebSocketRequestProjection(req: WebSocketRequest): WebSocketRequestUpdates {
  return buildWebSocketRequestUpdates(draftFromWebSocketRequest(req));
}
