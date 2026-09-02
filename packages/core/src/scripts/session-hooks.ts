/**
 * Session script hooks — what a live session's hook sees and what it
 * may hand back, per kind. A session execution
 * (`SessionScriptExecution` in `./index`) carries ONE of these inputs;
 * the runner builds the hook's `oh.*` surface from it and folds the
 * script's edits into ONE `SessionScriptMutation` (the HTTP mutation's
 * law: a complete diff replaces the pending one, all-empty normalizes
 * to none).
 *
 * The WebSocket family lands here with its build slice — Before
 * connect at every dial (mutate url / headers / params / subprotocols),
 * Before send per rider send (mutate or drop), On message per captured
 * inbound frame (observe, reply through `oh.send`, assert), After close
 * once at settle (assert). MQTT and gRPC join with theirs.
 */

import type { WsScriptKind } from './slots';

export interface SessionHeader {
  key: string;
  value: string;
}

export interface SessionParam {
  key: string;
  value: string;
}

/**
 * Before connect — the dial as the executor composed it: the user's
 * rows template-resolved and the query params already on the URL, the
 * session credential NOT yet minted (it mints onto what the hook
 * leaves, so a signer covers the mutated URL). `params` is the URL's
 * query parsed back out (the HTTP snapshot's law) — a `params`
 * mutation rewrites the query string wholesale.
 */
export interface WsConnectSnapshot {
  url: string;
  headers: SessionHeader[];
  params: SessionParam[];
  subprotocols: string[];
  /** `0` for the first dial, `n` for the n-th auto-reconnect attempt. */
  attempt: number;
}

/** The connect diff — absent keys mean "no change"; lists replace. */
export interface WsConnectMutation {
  url?: string;
  headers?: SessionHeader[];
  params?: SessionParam[];
  subprotocols?: string[];
}

/**
 * Before send — the rider's message after template resolution, before
 * the frame is composed: the compose text (a socketio event's JSON
 * arguments array; a binary compose's base64 bytes), the frame type,
 * and the socketio addendum when the session speaks it. `index` is the
 * capture position the message takes if it goes out.
 */
export interface WsOutboundMessageSnapshot {
  direction: 'up';
  text: string;
  binary: boolean;
  eventName?: string;
  expectAck?: boolean;
  index: number;
}

/** The send diff — `drop` ends the send with nothing on the wire. */
export interface WsSendMutation {
  text?: string;
  eventName?: string;
  drop?: true;
}

/**
 * On message — one captured INBOUND frame, after the capture: the text
 * decode of a text frame (`null` for a binary one), the bytes as the
 * capture holds them, and the capture index the frame took.
 */
export interface WsInboundMessageSnapshot {
  direction: 'down';
  text: string | null;
  dataBase64: string;
  binary: boolean;
  index: number;
}

/**
 * After close — the session's end record, once at settle for a session
 * that opened: the Close frame verbatim (`code` `null` when the
 * connection severed without one), whether the user stopped it, the
 * capture counts and the whole-session wall time.
 */
export interface WsCloseSnapshot {
  code: number | null;
  reason: string;
  wasClean: boolean;
  stopped: boolean;
  messages: number;
  droppedMessages: number;
  durationMs: number;
}

/** One WebSocket hook's input, discriminated on the slot kind. */
export type WsHookInput =
  | { kind: 'ws-before-connect'; connect: WsConnectSnapshot }
  | { kind: 'ws-before-send'; message: WsOutboundMessageSnapshot }
  | { kind: 'ws-on-message'; message: WsInboundMessageSnapshot }
  | { kind: 'ws-after-close'; close: WsCloseSnapshot };

/** Every session family's hook input — the WebSocket family today. */
export type SessionHookInput = WsHookInput;

/** The kinds whose hook may hand a mutation back. */
export type MutatingWsScriptKind = Extract<WsScriptKind, 'ws-before-connect' | 'ws-before-send'>;

/**
 * The one mutation a session hook folds to — the family's diff under
 * its tag, so the executor applying it never guesses which hook ran.
 */
export type SessionScriptMutation =
  | ({ kind: 'ws-connect' } & WsConnectMutation)
  | ({ kind: 'ws-send' } & WsSendMutation);
