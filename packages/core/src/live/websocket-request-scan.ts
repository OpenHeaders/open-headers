/**
 * Pure collector for every templatable string in a WebSocket request,
 * grouped by the entity field it belongs to.
 *
 * Keep in lock-step with the WebSocket executor (`ws-exec/execute.ts`):
 * every string it feeds through the session's `resolve` — at Connect
 * and on the compose Send rider — is a candidate for `{{VAR}}`
 * resolution and must be visible here. The flavor lens is the
 * executor's: the Socket.IO namespace, handshake path and event name
 * ride the socketio flavor alone, the heartbeat frame the raw flavor
 * alone; a header or query row switched off never reaches the
 * handshake. The subprotocol offer is plain strings, never templated.
 *
 * The input is the entity's FIELD LIST, so the persisted entity and
 * the editor's save projection (plus the flavor the projection does
 * not carry — it is identity) satisfy it alike.
 */

import type { WebSocketRequest } from '../types';
import { collectAuthTemplateStrings, collectPairTemplateStrings } from './auth-scan';

export type WebSocketTemplateSource = Pick<
  WebSocketRequest,
  | 'url'
  | 'flavor'
  | 'headers'
  | 'params'
  | 'auth'
  | 'namespace'
  | 'handshakePath'
  | 'heartbeatMessage'
  | 'message'
  | 'eventName'
  | 'sniServerName'
>;

/** The templates by the entity field they ride, in wire order. */
export interface WebSocketTemplateGroups {
  /** The dial target — the URL and, on the socketio flavor, the
   *  namespace and handshake path that complete it. */
  url: string[];
  headers: string[];
  params: string[];
  auth: string[];
  /** The compose the Send rider emits — the message and, on the
   *  socketio flavor, the event name. */
  message: string[];
  /** The session knobs — the raw flavor's heartbeat frame, the SNI override. */
  settings: string[];
}

export function collectWebSocketTemplateGroups(request: WebSocketTemplateSource): WebSocketTemplateGroups {
  const socketio = request.flavor === 'socketio';

  const url: string[] = [];
  if (request.url) url.push(request.url);
  if (socketio) {
    if (request.namespace) url.push(request.namespace);
    if (request.handshakePath) url.push(request.handshakePath);
  }

  const headers: string[] = [];
  collectPairTemplateStrings(request.headers, headers);

  const params: string[] = [];
  collectPairTemplateStrings(request.params, params);

  const auth: string[] = [];
  if (request.auth) collectAuthTemplateStrings(request.auth, auth);

  const message: string[] = [];
  if (request.message) message.push(request.message);
  if (socketio && request.eventName) message.push(request.eventName);

  const settings: string[] = [];
  if (!socketio && request.heartbeatMessage) settings.push(request.heartbeatMessage);
  if (request.sniServerName) settings.push(request.sniServerName);

  return { url, headers, params, auth, message, settings };
}

/** Flat, order-preserving list of every templatable string in `request`. */
export function collectWebSocketRequestTemplateStrings(request: WebSocketTemplateSource): string[] {
  const g = collectWebSocketTemplateGroups(request);
  return [...g.url, ...g.headers, ...g.params, ...g.auth, ...g.message, ...g.settings];
}
