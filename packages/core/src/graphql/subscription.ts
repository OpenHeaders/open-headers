/**
 * GraphQL subscriptions over WebSocket — the `graphql-transport-ws`
 * protocol's client half as pure functions, the `compile.ts` sibling
 * for the ONE operation kind that leaves the POST: the compile of a
 * GraphQL request into the WebSocket session it rides (the URL
 * derived `http(s)` → `ws(s)` on the same path, the same uid + path
 * so the ancestor chain resolves unchanged, the subprotocol offered,
 * the auth narrowed to the WebSocket mask BY NAME, the HTTP settings
 * knobs the session shares carried over), the subscribe envelope, the
 * frame codec (every message type both ways; the close codes with
 * their protocol meanings), and the client state machine as a reducer
 * over SYMBOLIC effects — the executing host materializes them onto
 * the socket, the display replays the same reducer over the captured
 * frames. One machine, two consumers; no `graphql-ws` in shipped code.
 *
 * Protocol facts (the reference server's, validated in the probe):
 * the client offers `graphql-transport-ws`; `connection_init` (the
 * credential in `payload` — the `connectionParams` convention, since
 * a browser cannot set handshake headers) → `connection_ack`; then ONE
 * `subscribe { id, payload: envelope }` → `next` per event, `error`
 * with the errors[] for a request error, `complete` when the source
 * ends; a `ping` is answered with a `pong` echoing its payload; the
 * client's own `complete { id }` disposes the source. A protocol
 * refusal is a Close: 4400 bad request, 4401 unauthorized (a subscribe
 * before the ack), 4403 forbidden, 4406 subprotocol not acceptable,
 * 4408 no init within the server's deadline, 4409 the id reused,
 * 4429 too many init requests.
 */

import type { AuthConfig, WebSocketAuth, WebSocketRequest } from '../types';
import { censusDocument, wireOperationName } from './census';
import type { CompileOptions, GraphqlRequestLike } from './compile';
import { parseDocument } from './parse';

export const GRAPHQL_WS_SUBPROTOCOL = 'graphql-transport-ws';

/** One subscription per socket — the session IS the subscription. */
export const GRAPHQL_WS_SUBSCRIPTION_ID = '1';

// ── Close codes ──────────────────────────────────────────────────────

export type GraphqlWsCloseMeaning =
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'subprotocol-not-acceptable'
  | 'connection-init-timeout'
  | 'subscriber-already-exists'
  | 'too-many-init-requests';

const CLOSE_MEANINGS: ReadonlyMap<number, GraphqlWsCloseMeaning> = new Map([
  [4400, 'bad-request'],
  [4401, 'unauthorized'],
  [4403, 'forbidden'],
  [4406, 'subprotocol-not-acceptable'],
  [4408, 'connection-init-timeout'],
  [4409, 'subscriber-already-exists'],
  [4429, 'too-many-init-requests'],
]);

/** The protocol's meaning of a Close code, or null for a code outside
 *  its vocabulary (the plain WebSocket codes stay their own). */
export function graphqlWsCloseMeaning(code: number): GraphqlWsCloseMeaning | null {
  return CLOSE_MEANINGS.get(code) ?? null;
}

// ── The envelope ─────────────────────────────────────────────────────

/** The `subscribe` frame's payload — the POST body's shape verbatim. */
export interface GraphqlWsSubscribePayload {
  readonly query: string;
  readonly variables?: unknown;
  readonly operationName?: string;
}

/**
 * The envelope from its text parts — the HTTP composition's rule:
 * `variables` embeds parsed when the text is valid JSON, else stays
 * off the wire (better `{query}` than a malformed envelope);
 * `operationName` rides only when set.
 */
export function graphqlWsSubscribePayload(
  query: string,
  variablesText: string | undefined,
  operationName: string | undefined,
): GraphqlWsSubscribePayload {
  const payload: { query: string; variables?: unknown; operationName?: string } = { query };
  const trimmed = variablesText?.trim();
  if (trimmed) {
    try {
      payload.variables = JSON.parse(trimmed);
    } catch {
      // Left off the wire.
    }
  }
  if (operationName) payload.operationName = operationName;
  return payload;
}

// ── The compile ──────────────────────────────────────────────────────

/** The session's protocol plan — what the executing host resolves
 *  with the other Connect-time templates and hands the controller:
 *  the envelope's TEXT parts (templates unresolved). */
export interface GraphqlWsSubscriptionPlan {
  readonly query: string;
  readonly variables?: string;
  readonly operationName?: string;
}

export type GraphqlSubscriptionCompile =
  | { readonly ok: true; readonly request: WebSocketRequest; readonly plan: GraphqlWsSubscriptionPlan }
  | { readonly ok: false; readonly error: string };

/** `http(s)` → `ws(s)` on the same authority and path; a `ws(s)` URL
 *  passes as typed; anything else is null. Templates may sit anywhere
 *  after the scheme — only the scheme is read here. */
export function subscriptionUrlOf(url: string): string | null {
  const trimmed = url.trim();
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  const match = /^http(s?):\/\//i.exec(trimmed);
  if (match === null) return null;
  return `ws${match[1].toLowerCase()}://${trimmed.slice(match[0].length)}`;
}

/** The request's auth narrowed to the WebSocket session mask — the
 *  types the session credential can mint; null names a type the mask
 *  refuses (a challenge flow, a signed HTTP scheme). */
function websocketAuthOf(auth: AuthConfig): WebSocketAuth | null {
  switch (auth.type) {
    case 'none':
    case 'inherit':
    case 'bearer':
    case 'basic':
    case 'api-key':
    case 'oauth2':
    case 'jwt':
    case 'aws-sigv4':
      return auth;
    default:
      return null;
  }
}

/**
 * Compile a GraphQL request into the WebSocket session its picked
 * operation rides — the derived `WebSocketRequest` (raw flavor, the
 * subprotocol offered, no reconnect, no heartbeat: the protocol's ping
 * is answered, never initiated) and the subscribe plan. The operation
 * pick is `compileGraphqlRequest`'s (the census's rule). A refusal
 * names its cause: a URL outside `http(s)` / `ws(s)`, an auth type the
 * WebSocket mask cannot carry.
 */
export function compileGraphqlSubscription(
  input: GraphqlRequestLike,
  options: CompileOptions = {},
): GraphqlSubscriptionCompile {
  const url = subscriptionUrlOf(input.url);
  if (url === null) return { ok: false, error: 'The URL must start with http://, https://, ws:// or wss://.' };
  const auth = websocketAuthOf(input.auth);
  if (auth === null) {
    return { ok: false, error: `${input.auth.type} authentication cannot ride a WebSocket session.` };
  }
  const requested = options.operationName ?? input.operationName;
  const parsed = parseDocument(input.query);
  const operationName =
    parsed.document === null ? requested : wireOperationName(censusDocument(parsed.document), requested);
  const request: WebSocketRequest = {
    schemaVersion: input.schemaVersion,
    uid: input.uid,
    path: input.path,
    ...(input.pathSegment !== undefined ? { pathSegment: input.pathSegment } : {}),
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    url,
    flavor: 'raw',
    subprotocols: [GRAPHQL_WS_SUBPROTOCOL],
    headers: [...input.headers],
    params: [],
    auth,
    message: '',
    ...(input.unixSocketPath !== undefined ? { unixSocketPath: input.unixSocketPath } : {}),
    ...(input.resolveToAddress !== undefined ? { resolveToAddress: input.resolveToAddress } : {}),
    ...(input.proxyMode !== undefined ? { proxyMode: input.proxyMode } : {}),
    ...(input.proxyUrl !== undefined ? { proxyUrl: input.proxyUrl } : {}),
    ...(input.proxyCredentialRef !== undefined ? { proxyCredentialRef: input.proxyCredentialRef } : {}),
    ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    ...(input.followRedirects !== undefined ? { followRedirects: input.followRedirects } : {}),
    ...(input.maxRedirects !== undefined ? { maxRedirects: input.maxRedirects } : {}),
    ...(input.sslVerification !== undefined ? { sslVerification: input.sslVerification } : {}),
    ...(input.clientCertificateRef !== undefined ? { clientCertificateRef: input.clientCertificateRef } : {}),
    ...(input.tlsMinVersion !== undefined ? { tlsMinVersion: input.tlsMinVersion } : {}),
    ...(input.tlsMaxVersion !== undefined ? { tlsMaxVersion: input.tlsMaxVersion } : {}),
    ...(input.tlsCipherSuites !== undefined ? { tlsCipherSuites: input.tlsCipherSuites } : {}),
    ...(input.sniServerName !== undefined ? { sniServerName: input.sniServerName } : {}),
  };
  return {
    ok: true,
    request,
    plan: {
      query: input.query,
      ...(input.variables !== undefined ? { variables: input.variables } : {}),
      ...(operationName !== undefined && operationName !== '' ? { operationName } : {}),
    },
  };
}

// ── The frame codec ──────────────────────────────────────────────────

export type GraphqlWsClientMessage =
  | { readonly type: 'connection_init'; readonly payload?: Record<string, unknown> }
  | { readonly type: 'ping'; readonly payload?: unknown }
  | { readonly type: 'pong'; readonly payload?: unknown }
  | { readonly type: 'subscribe'; readonly id: string; readonly payload: GraphqlWsSubscribePayload }
  | { readonly type: 'complete'; readonly id: string };

/** A `next` payload — the execution result envelope as the server
 *  sent it (`data` / `errors[]` / `extensions`), read tolerantly. */
export type GraphqlWsExecutionResult = Readonly<Record<string, unknown>>;

export type GraphqlWsServerMessage =
  | { readonly type: 'connection_ack'; readonly payload?: unknown }
  | { readonly type: 'ping'; readonly payload?: unknown }
  | { readonly type: 'pong'; readonly payload?: unknown }
  | { readonly type: 'next'; readonly id: string; readonly payload: GraphqlWsExecutionResult }
  | { readonly type: 'error'; readonly id: string; readonly payload: readonly unknown[] }
  | { readonly type: 'complete'; readonly id: string };

/** One frame's text, the fields in the protocol's order. */
export function encodeGraphqlWsMessage(message: GraphqlWsClientMessage): string {
  switch (message.type) {
    case 'connection_init':
      return JSON.stringify(message.payload === undefined ? { type: 'connection_init' } : message);
    case 'ping':
    case 'pong':
      return JSON.stringify(message.payload === undefined ? { type: message.type } : message);
    case 'subscribe':
      return JSON.stringify({ id: message.id, type: 'subscribe', payload: message.payload });
    case 'complete':
      return JSON.stringify({ id: message.id, type: 'complete' });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFrame(text: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return isRecord(parsed) ? parsed : null;
}

/**
 * A server frame decoded, or null when the text is not one of the
 * protocol's messages (unreadable JSON, an unknown type, a message
 * missing its id or carrying a payload of the wrong shape) — the
 * capture still holds the frame verbatim; the machine ignores it.
 */
export function decodeGraphqlWsServerMessage(text: string): GraphqlWsServerMessage | null {
  const frame = parseFrame(text);
  if (frame === null) return null;
  const { type, id, payload } = frame;
  switch (type) {
    case 'connection_ack':
    case 'ping':
    case 'pong':
      return payload === undefined ? { type } : { type, payload };
    case 'next':
      return typeof id === 'string' && isRecord(payload) ? { type, id, payload } : null;
    case 'error':
      return typeof id === 'string' && Array.isArray(payload) ? { type, id, payload } : null;
    case 'complete':
      return typeof id === 'string' ? { type, id } : null;
    default:
      return null;
  }
}

/** A client frame decoded — the display's replay reads the captured
 *  ↑ frames for the client's own `complete`. */
export function decodeGraphqlWsClientMessage(text: string): GraphqlWsClientMessage | null {
  const frame = parseFrame(text);
  if (frame === null) return null;
  const { type, id, payload } = frame;
  switch (type) {
    case 'connection_init':
      return payload === undefined ? { type } : isRecord(payload) ? { type, payload } : null;
    case 'ping':
    case 'pong':
      return payload === undefined ? { type } : { type, payload };
    case 'subscribe':
      return typeof id === 'string' && isRecord(payload) && typeof payload.query === 'string'
        ? {
            type,
            id,
            payload: {
              query: payload.query,
              ...(payload.variables !== undefined ? { variables: payload.variables } : {}),
              ...(typeof payload.operationName === 'string' ? { operationName: payload.operationName } : {}),
            },
          }
        : null;
    case 'complete':
      return typeof id === 'string' ? { type, id } : null;
    default:
      return null;
  }
}

// ── The client state machine ─────────────────────────────────────────

/**
 * `idle` before the socket opens; `connecting` once `connection_init`
 * left (awaiting the ack); `subscribed` once the ack arrived and the
 * `subscribe` left; `completed` when the source ended (the server's
 * `complete`, or the client's own on Stop); `errored` on the server's
 * `error` message; `closed` when the socket closed under a live
 * phase — a protocol refusal (4401, 4406, …) or the server going away.
 * A terminal phase keeps its name through the socket's close; the
 * close record rides `close` either way.
 */
export type GraphqlWsPhase = 'idle' | 'connecting' | 'subscribed' | 'completed' | 'errored' | 'closed';

export interface GraphqlWsClientState {
  readonly phase: GraphqlWsPhase;
  /** `next` frames received. */
  readonly events: number;
  /** The latest `next` payload, or null before the first. */
  readonly latest: GraphqlWsExecutionResult | null;
  /** The `error` message's errors[] — set with the `errored` phase. */
  readonly errors: readonly unknown[] | null;
  /** The client sent its own `complete` (Stop). */
  readonly stopped: boolean;
  /** The socket's Close as recorded; null while open or when none. */
  readonly close: { readonly code: number; readonly reason: string } | null;
}

export type GraphqlWsClientInput =
  | { readonly kind: 'open' }
  | { readonly kind: 'message'; readonly text: string }
  | { readonly kind: 'stop' }
  | { readonly kind: 'close'; readonly code: number; readonly reason: string };

/** What the host does next — symbolic, so the reducer stays plan-free
 *  and the display replays it effect-blind. */
export type GraphqlWsClientEffect =
  | { readonly kind: 'init' }
  | { readonly kind: 'subscribe' }
  | { readonly kind: 'pong'; readonly payload?: unknown }
  | { readonly kind: 'complete' }
  | { readonly kind: 'close' };

export interface GraphqlWsClientStep {
  readonly state: GraphqlWsClientState;
  readonly effects: readonly GraphqlWsClientEffect[];
}

export const GRAPHQL_WS_INITIAL_STATE: GraphqlWsClientState = {
  phase: 'idle',
  events: 0,
  latest: null,
  errors: null,
  stopped: false,
  close: null,
};

function isTerminal(phase: GraphqlWsPhase): boolean {
  return phase === 'completed' || phase === 'errored' || phase === 'closed';
}

/** One transition. Frames that are not protocol messages, messages for
 *  another id, and anything after a terminal phase are ignored — the
 *  state is returned unchanged with no effects. */
export function reduceGraphqlWsClient(state: GraphqlWsClientState, input: GraphqlWsClientInput): GraphqlWsClientStep {
  const same: GraphqlWsClientStep = { state, effects: [] };
  switch (input.kind) {
    case 'open':
      return state.phase === 'idle' ? { state: { ...state, phase: 'connecting' }, effects: [{ kind: 'init' }] } : same;
    case 'stop': {
      if (isTerminal(state.phase) || state.phase === 'idle') return same;
      if (state.phase === 'subscribed') {
        return {
          state: { ...state, phase: 'completed', stopped: true },
          effects: [{ kind: 'complete' }, { kind: 'close' }],
        };
      }
      return { state: { ...state, stopped: true }, effects: [{ kind: 'close' }] };
    }
    case 'close': {
      const close = { code: input.code, reason: input.reason };
      if (state.close !== null) return same;
      return { state: { ...state, phase: isTerminal(state.phase) ? state.phase : 'closed', close }, effects: [] };
    }
    case 'message': {
      if (isTerminal(state.phase) || state.phase === 'idle') return same;
      const message = decodeGraphqlWsServerMessage(input.text);
      if (message === null) return same;
      switch (message.type) {
        case 'ping':
          return {
            state,
            effects: [message.payload === undefined ? { kind: 'pong' } : { kind: 'pong', payload: message.payload }],
          };
        case 'pong':
          return same;
        case 'connection_ack':
          return state.phase === 'connecting'
            ? { state: { ...state, phase: 'subscribed' }, effects: [{ kind: 'subscribe' }] }
            : same;
        case 'next':
          return state.phase === 'subscribed' && message.id === GRAPHQL_WS_SUBSCRIPTION_ID
            ? { state: { ...state, events: state.events + 1, latest: message.payload }, effects: [] }
            : same;
        case 'error':
          return state.phase === 'subscribed' && message.id === GRAPHQL_WS_SUBSCRIPTION_ID
            ? { state: { ...state, phase: 'errored', errors: message.payload }, effects: [{ kind: 'close' }] }
            : same;
        case 'complete':
          return state.phase === 'subscribed' && message.id === GRAPHQL_WS_SUBSCRIPTION_ID
            ? { state: { ...state, phase: 'completed' }, effects: [{ kind: 'close' }] }
            : same;
      }
    }
  }
}

/** One captured frame as the display replays it — the executor's
 *  capture, text-decoded. */
export interface GraphqlWsCapturedFrame {
  readonly direction: 'up' | 'down';
  readonly text: string;
}

/**
 * The machine replayed over a session's capture: the ↓ frames drive
 * the transitions, an ↑ `complete` is the client's Stop, and the
 * Close record (when the session settled) lands last. `opened` false
 * = the handshake never settled; the state stays `idle` with the
 * close record.
 */
export function replayGraphqlWsCapture(
  opened: boolean,
  frames: readonly GraphqlWsCapturedFrame[],
  close: { readonly code: number; readonly reason: string } | null,
): GraphqlWsClientState {
  let state = GRAPHQL_WS_INITIAL_STATE;
  if (opened) state = reduceGraphqlWsClient(state, { kind: 'open' }).state;
  for (const frame of frames) {
    if (frame.direction === 'down') {
      state = reduceGraphqlWsClient(state, { kind: 'message', text: frame.text }).state;
      continue;
    }
    const sent = decodeGraphqlWsClientMessage(frame.text);
    if (sent?.type === 'complete') state = reduceGraphqlWsClient(state, { kind: 'stop' }).state;
  }
  if (close !== null)
    state = reduceGraphqlWsClient(state, { kind: 'close', code: close.code, reason: close.reason }).state;
  return state;
}
