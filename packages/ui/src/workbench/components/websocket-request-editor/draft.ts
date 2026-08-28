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
  WebSocketBinaryEncoding,
  WebSocketEventRow,
  WebSocketHeaderPair,
  WebSocketMessageFormat,
  WebSocketQueryParam,
  WebSocketRequest,
  WebSocketSavedMessage,
  WebSocketSpecLink,
} from '@openheaders/core/types';
import { decodeBase64Bytes, parseUrlQuery } from '@openheaders/core/utils';
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
  /** Saved-messages rail rows (concrete — absent reads as []). */
  savedMessages: WebSocketSavedMessage[];
  /** Concrete in the form — absent on the entity reads as `text`. */
  messageFormat: WebSocketMessageFormat;
  /** Byte spelling of a `binary` compose (concrete — absent reads as
   *  `base64`); the entity carries it only while the format is binary. */
  binaryEncoding: WebSocketBinaryEncoding;
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
  savedMessages: WebSocketSavedMessage[];
  message: string;
  eventName: string;
  namespace: string;
  ackEnabled: boolean;
  messageFormat: WebSocketMessageFormat;
  binaryEncoding: WebSocketBinaryEncoding | undefined;
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

/** Params share the header row anatomy; the `hasEquals` marker rides
 *  both ways so the URL bar keeps `?key=` for a row whose value was
 *  cleared (the URL⇄params sync in `WsTargetRow`). */
export function paramsToRows(pairs: readonly WebSocketQueryParam[]): KeyValueRow[] {
  return pairs.map((p) =>
    makeKvRow({
      uid: p.uid,
      key: p.key,
      value: p.value,
      description: p.description ?? '',
      enabled: p.enabled ?? true,
      hasEquals: p.hasEquals,
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
      ...(r.hasEquals !== undefined ? { hasEquals: r.hasEquals } : {}),
    }));
}

/** Uid for a URL-derived param row — index-keyed and DETERMINISTIC,
 *  since `draftFromWebSocketRequest` feeds the canonical projection
 *  the reprime gate fingerprints (a random uid would make every
 *  projection compare unequal and re-populate the draft each render).
 *  Same shape as `generateUid()` output so `UidSchema` accepts it. */
function urlParamUid(index: number): string {
  return `q${index.toString(36).padStart(7, '0')}`;
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
  // Split any `?…` suffix off the stored URL into structured params so
  // the URL⇄params sync works from a clean base; stored rows keep their
  // metadata and follow the URL-derived ones (URL first, table after).
  const parsed = parseUrlQuery(req.url);
  const urlParams: KeyValueRow[] = parsed.params.map((p, i) =>
    makeKvRow({
      uid: urlParamUid(i),
      key: p.key,
      value: p.value,
      description: '',
      enabled: true,
      hasEquals: p.hasEquals,
    }),
  );
  return {
    description: req.description ?? '',
    url: parsed.base,
    subprotocols: [...req.subprotocols],
    headers: headersToRows(req.headers),
    params: [...urlParams, ...paramsToRows(req.params)],
    auth: req.auth ?? { type: 'none' },
    events: (req.events ?? []).map((row) => ({ ...row })),
    savedMessages: (req.savedMessages ?? []).map((row) => ({ ...row })),
    message: req.message,
    eventName: req.eventName ?? '',
    namespace: req.namespace ?? '',
    ackEnabled: req.ackEnabled ?? false,
    messageFormat: req.messageFormat ?? 'text',
    binaryEncoding: req.binaryEncoding ?? 'base64',
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
    savedMessages: draft.savedMessages,
    message: draft.message,
    eventName: draft.eventName,
    namespace: draft.namespace,
    ackEnabled: draft.ackEnabled,
    messageFormat: draft.messageFormat,
    binaryEncoding: draft.messageFormat === 'binary' ? draft.binaryEncoding : undefined,
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

// ── Saved-messages compose binding ──────────────────────────────────
// The rail's rows are entity rows; the compose is the SELECTED row's
// editor, so every compose edit mirrors back into it within the same
// draft update. All four helpers are pure projections over the same
// field set: message, mode, byte spelling, socketio event name.

/** The compose block captured as one saved row — optional fields
 *  absent at their defaults (the `+` capture and the mirror share it). */
export function composeAsSavedMessage(draft: WebSocketDraft, uid: string, name: string): WebSocketSavedMessage {
  return {
    uid,
    name,
    message: draft.message,
    ...(draft.messageFormat !== 'text' ? { messageFormat: draft.messageFormat } : {}),
    ...(draft.messageFormat === 'binary' && draft.binaryEncoding !== 'base64'
      ? { binaryEncoding: draft.binaryEncoding }
      : {}),
    ...(draft.eventName !== '' ? { eventName: draft.eventName } : {}),
  };
}

/** One saved row filling the whole compose — the click-to-load leg. */
export function loadSavedMessageIntoCompose(draft: WebSocketDraft, row: WebSocketSavedMessage): WebSocketDraft {
  return {
    ...draft,
    message: row.message,
    messageFormat: row.messageFormat ?? 'text',
    binaryEncoding: row.binaryEncoding ?? 'base64',
    eventName: row.eventName ?? '',
  };
}

/** Does the row hold exactly what the compose shows? Stored optional
 *  fields read at their defaults; the byte spelling only counts under
 *  a binary compose. */
export function savedRowMatchesCompose(draft: WebSocketDraft, row: WebSocketSavedMessage): boolean {
  return (
    row.message === draft.message &&
    (row.messageFormat ?? 'text') === draft.messageFormat &&
    (draft.messageFormat !== 'binary' || (row.binaryEncoding ?? 'base64') === draft.binaryEncoding) &&
    (row.eventName ?? '') === draft.eventName
  );
}

/** Mirror the compose into the selected saved row — the write-through
 *  leg. Identity-stable: no selection, a vanished row, or an already-
 *  matching row returns the SAME draft object (no render churn). */
export function mirrorComposeIntoSaved(draft: WebSocketDraft, selectedUid: string | null): WebSocketDraft {
  if (selectedUid === null) return draft;
  const index = draft.savedMessages.findIndex((row) => row.uid === selectedUid);
  if (index === -1) return draft;
  const row = draft.savedMessages[index];
  if (savedRowMatchesCompose(draft, row)) return draft;
  const savedMessages = draft.savedMessages.slice();
  savedMessages[index] = composeAsSavedMessage(draft, row.uid, row.name);
  return { ...draft, savedMessages };
}

/** The next free "Message", "Message (2)", … name among the rows. */
export function nextSavedMessageName(rows: readonly WebSocketSavedMessage[], baseName: string): string {
  const names = new Set(rows.map((m) => m.name));
  let name = baseName;
  let counter = 2;
  while (names.has(name)) name = `${baseName} (${counter++})`;
  return name;
}

/** A timeline frame captured as a saved row: a text frame as its
 *  decoded text (JSON when it parses), a binary frame as base64. */
export function savedMessageFromFrame(
  frame: { dataBase64: string; binary: boolean },
  uid: string,
  name: string,
): WebSocketSavedMessage {
  if (frame.binary) return { uid, name, message: frame.dataBase64, messageFormat: 'binary' };
  const bytes = decodeBase64Bytes(frame.dataBase64);
  const text = bytes === null ? '' : new TextDecoder().decode(bytes);
  let json = false;
  try {
    JSON.parse(text);
    json = true;
  } catch {
    json = false;
  }
  return { uid, name, message: text, ...(json ? { messageFormat: 'json' as const } : {}) };
}
