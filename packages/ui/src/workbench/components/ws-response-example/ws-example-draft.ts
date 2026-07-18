/**
 * WebSocket example editor draft model + the pure capture projections —
 * the `grpc-example-draft` sibling for the WebSocketRequest family.
 *
 * The editable half is the captured REQUEST block (an example doubles
 * as an authored record): url, subprotocols, header/param rows, the
 * compose message, the socketio event fields, the concrete
 * SSL-verification flag. The flavor is the capture's fact — identity
 * chrome, never editable. The response block is session capture —
 * messages, close, handshake facts — and stays a read-only fact
 * rendered through the result pane. Two pure projections feed save and
 * derived-dirty; the fingerprint is uid-free because rows mint fresh
 * row uids on every populate.
 */

import type {
  CapturedWsRequest,
  CapturedWsResponse,
  ExecutedWsSnapshot,
  WebSocketFlavor,
  WsResponseExample,
} from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import type { KeyValueRow } from '../request-editor/KeyValueTable';
import { headersToRows, paramsToRows, rowsToHeaders, rowsToParams } from '../websocket-request-editor/draft';

export interface WsExampleDraft {
  url: string;
  subprotocols: string[];
  headers: KeyValueRow[];
  params: KeyValueRow[];
  message: string;
  /** Socket.IO event name (concrete — absent on the capture reads ''). */
  eventName: string;
  /** Socket.IO namespace (concrete — absent reads as '', the root). */
  namespace: string;
  /** Socket.IO ack opt-in (concrete — absent reads as off). */
  ackEnabled: boolean;
  sslVerification: boolean;
  timeoutMs: number | undefined;
}

export function wsExampleToDraft(example: WsResponseExample): WsExampleDraft {
  return {
    url: example.request.url,
    subprotocols: [...example.request.subprotocols],
    headers: headersToRows(example.request.headers),
    params: paramsToRows(example.request.params),
    message: example.request.message,
    eventName: example.request.eventName ?? '',
    namespace: example.request.namespace ?? '',
    ackEnabled: example.request.ackEnabled ?? false,
    sslVerification: example.request.sslVerification,
    timeoutMs: example.request.timeoutMs,
  };
}

/**
 * The persisted request block from a compose shape — the WebSocket
 * editor's CURRENT draft at "Save Response" time (authored values,
 * variable refs unresolved) or the example editor's own draft at save.
 * Both speak this structural subset; the flavor rides in as the
 * capture's fact. The socketio compose fields persist only when they
 * carry content — the entity's own optionality.
 */
export function capturedWsRequestFromDraft(draft: WsExampleDraft, flavor: WebSocketFlavor): CapturedWsRequest {
  return {
    url: draft.url,
    flavor,
    ...(draft.namespace === '' ? {} : { namespace: draft.namespace }),
    subprotocols: [...draft.subprotocols],
    headers: rowsToHeaders(draft.headers),
    params: rowsToParams(draft.params),
    message: draft.message,
    ...(draft.eventName === '' ? {} : { eventName: draft.eventName }),
    ...(draft.ackEnabled ? { ackEnabled: true } : {}),
    sslVerification: draft.sslVerification,
    ...(draft.timeoutMs === undefined ? {} : { timeoutMs: draft.timeoutMs }),
  };
}

/**
 * The persisted response block from a settled session snapshot — the
 * handshake facts, the direction-tagged capture, and the close record
 * verbatim. Volatile execution internals (`connected`, `executedOn`,
 * `error`) stay behind; callers only capture sessions that opened.
 */
export function capturedWsResponseFromSnapshot(snapshot: ExecutedWsSnapshot): CapturedWsResponse {
  return {
    protocol: snapshot.protocol,
    extensions: snapshot.extensions,
    messages: snapshot.messages.map((m) => ({
      direction: m.direction,
      dataBase64: m.dataBase64,
      binary: m.binary,
    })),
    droppedMessages: snapshot.droppedMessages,
    close: snapshot.close === null ? null : { ...snapshot.close },
    ...(snapshot.stopped === undefined ? {} : { stopped: snapshot.stopped }),
    durationMs: snapshot.durationMs,
  };
}

/** Uid-free structural fingerprint over everything editable. */
export function wsExampleDraftFingerprint(draft: WsExampleDraft): string {
  const stripRow = (r: KeyValueRow) => ({
    key: r.key,
    value: r.value,
    description: r.description?.trim() ? r.description : undefined,
    enabled: r.enabled,
  });
  return stableStringify({
    url: draft.url,
    subprotocols: draft.subprotocols,
    headers: draft.headers.filter((r) => r.key.trim()).map(stripRow),
    params: draft.params.filter((r) => r.key.trim()).map(stripRow),
    message: draft.message,
    eventName: draft.eventName,
    namespace: draft.namespace,
    ackEnabled: draft.ackEnabled,
    sslVerification: draft.sslVerification,
    timeoutMs: draft.timeoutMs,
  });
}

/** Canonical-side fingerprint — same projection path as the form's. */
export function wsExampleSignature(example: WsResponseExample): string {
  return wsExampleDraftFingerprint(wsExampleToDraft(example));
}
