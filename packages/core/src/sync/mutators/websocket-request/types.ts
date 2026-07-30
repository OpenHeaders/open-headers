/**
 * WebSocketRequest mutator catalog — routing constants.
 *
 * Three set-modeled paths live on the WebSocketRequest entity:
 *
 *   - `headers` — handshake header rows (`{ key, value, description?, enabled? }`)
 *   - `params`  — query-param rows (`{ key, value, description?, enabled?, hasEquals? }`)
 *   - `events`  — Events-tab rows (`{ name, listen?, description? }`, socketio flavor)
 *
 * Every other field — `name`, `description`, `url`, `flavor`,
 * `subprotocols`, `message`, `messageFormat`, `specLink`,
 * `unixSocketPath`, `timeoutMs` — flows through `setField` scalars. `subprotocols`, `specLink` and
 * `auth` are container-valued; they route through the per-leaf
 * flatten-diff at the write site (the same treatment `auth` / `body`
 * get on the HTTP request) so edits share create's leaf
 * representation.
 *
 * No side effects: WebSocket requests don't feed DNR and don't touch
 * the variables resolver.
 */

/** Routing key carried on every WebSocket-request mutation envelope. */
export const WEBSOCKET_REQUEST_ENTITY_TYPE = 'websocketRequest';

/** Set path for handshake header rows. */
export const WEBSOCKET_REQUEST_HEADERS_PATH = 'headers';

/** Set path for query-param rows. */
export const WEBSOCKET_REQUEST_PARAMS_PATH = 'params';

/** Set path for Events-tab rows (socketio flavor). */
export const WEBSOCKET_REQUEST_EVENTS_PATH = 'events';

/**
 * Wire shape for a handshake header row. Mirrors `WebSocketHeaderPair`
 * field-for-field but typed locally so the catalog stays decoupled
 * from `@openheaders/core/types` (the same way other catalogs keep
 * their row shapes local).
 */
export interface WebSocketHeaderPairRow {
  /** Persisted per-row identity; doubles as the sync engine's itemId. */
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled?: boolean;
}

/** Wire shape for a query-param row. See {@link WebSocketHeaderPairRow}. */
export interface WebSocketQueryParamRow {
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled?: boolean;
  hasEquals?: boolean;
}

/** Wire shape for an Events-tab row. See {@link WebSocketHeaderPairRow}. */
export interface WebSocketEventRowRow {
  uid: string;
  name: string;
  listen?: boolean;
  description?: string;
}
