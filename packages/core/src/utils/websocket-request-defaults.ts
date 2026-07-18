/**
 * Empty-WebSocketRequest seed factory. Mirrors `grpc-request-defaults.ts`:
 * one source of truth for the freshly-created WebSocket request shape
 * so every creation gesture stays byte-identical.
 *
 * Defaults:
 *   - url: empty (user fills the ws/wss target)
 *   - flavor: caller-supplied — the creation menu's two entries
 *     (WebSocket / Socket.IO) pre-set it
 *   - subprotocols / headers / params / message: empty
 */

import type { WebSocketFlavor, WebSocketRequest } from '../types';

export interface BuildEmptyWebSocketRequestInput {
  uid: string;
  /** Full request path: `${parentPath}/${pathSegment}`. */
  path: string;
  name: string;
  flavor: WebSocketFlavor;
}

export function buildEmptyWebSocketRequest(input: BuildEmptyWebSocketRequestInput): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: input.uid,
    path: input.path,
    name: input.name,
    url: '',
    flavor: input.flavor,
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
  };
}
