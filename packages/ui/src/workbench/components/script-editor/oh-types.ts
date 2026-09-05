/**
 * Ambient type declarations for the script sandbox's `oh.*` API,
 * fed to Monaco's TypeScript language service via
 * `monaco.languages.typescript.javascriptDefaults.addExtraLib(...)`.
 *
 * The runtime surface is defined by the shared runner core
 * (`@openheaders/core/scripts/runner`) — this file MUST stay in sync
 * with it. No implementation here, only types, because Monaco just
 * needs shape information for completions, hovers, and error
 * squigglies.
 *
 * One declaration per script KIND: the core (`variables`, `vault`,
 * `require`, `sendRequest`, `test`, `expect`) is shared verbatim; the
 * HTTP pair adds `oh.request` / `oh.response` and the request
 * mutators; each WebSocket hook adds its own view and verbs
 * (`oh.connect` + the dial mutators, `oh.message` + the send mutators
 * or the reply verbs, `oh.close`) plus `oh.session`; the MQTT hooks
 * are the twin on the CONNECT / PUBLISH plane; the gRPC hooks bracket
 * one call (`oh.invoke` + the metadata and message mutators,
 * `oh.message` as the decoded frame, `oh.response`). The editor swaps
 * the declaration with the rail selection (`setScriptAmbientKind`).
 *
 * The surface is split into NAMED interfaces (`OpenHeaders`,
 * `OhRequest`, `OhResponse`, …) rather than an inline anonymous type
 * so the completion popup renders `const oh: OpenHeaders` instead of
 * unfurling the full object literal.
 */

import type { ScriptKind } from '@openheaders/core/scripts';

const OH_PRELUDE = `
type OhHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

interface OhHeader { key: string; value: string; }
interface OhParam { key: string; value: string; }

interface OhFormField {
  readonly key: string;
  readonly value: string;
  readonly description?: string;
  readonly enabled?: boolean;
}

interface OhMultipartTextPart {
  readonly kind: 'text';
  readonly name: string;
  readonly value: string;
  readonly description?: string;
  readonly enabled?: boolean;
}

interface OhMultipartFilePart {
  readonly kind: 'file';
  readonly name: string;
  readonly fileRefs: ReadonlyArray<unknown>;
  readonly description?: string;
  readonly enabled?: boolean;
}

type OhMultipartPart = OhMultipartTextPart | OhMultipartFilePart;

type OhRequestBody =
  | { readonly type: 'none' }
  | { readonly type: 'json'; readonly content: string }
  | { readonly type: 'xml'; readonly content: string }
  | { readonly type: 'text'; readonly content: string; readonly rawFormat?: 'text' | 'javascript' | 'html' }
  | { readonly type: 'form'; readonly formParts: ReadonlyArray<OhFormField> }
  | { readonly type: 'multipart'; readonly multipartParts: ReadonlyArray<OhMultipartPart> }
  | {
      readonly type: 'graphql';
      readonly content: string;
      readonly graphqlVariables?: string;
      readonly operationName?: string;
    };

/** The outgoing request. Mutable in pre-request scripts via
 *  \`oh.setUrl\` / \`oh.setHeader\` / \`oh.setMethod\` / \`oh.setBody\`;
 *  read-only in post-response scripts. */
interface OhRequest {
  readonly method: OhHttpMethod;
  readonly url: string;
  readonly headers: ReadonlyArray<OhHeader>;
  readonly params: ReadonlyArray<OhParam>;
  readonly body: OhRequestBody;
}

/** The incoming response. Populated only in post-response scripts;
 *  \`undefined\` during pre-request runs. */
interface OhResponse {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly headers: ReadonlyArray<OhHeader>;
  /** Response body. UTF-8 text verbatim; a binary payload arrives
   *  base64-encoded with \`bodyEncoding\` set — lossless either way. */
  readonly body: string;
  /** \`'base64'\` when \`body\` carries base64-encoded bytes (the payload
   *  is not UTF-8 text). Absent = text. Check before \`JSON.parse\`;
   *  decode with \`atob(oh.response.body)\` when you want the bytes. */
  readonly bodyEncoding?: 'base64';
  readonly durationMs: number;
}

/** Read / write to the workspace variable scope. \`get\` walks the full
 *  4-scope chain (vault > env > collection > workspace) and returns the
 *  resolved value; \`set\` writes to the workspace scope. */
interface OhVariables {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
}

/** Read-only access to vault secrets. Works for both named vault keys
 *  and OAuth credential references — the latter returns the current
 *  access token (refreshed if expired). */
interface OhVault {
  get(ref: string): Promise<string | null>;
}

/** Chai-ish assertion builder. Each matcher throws a descriptive
 *  Error on mismatch — the enclosing \`oh.test\` catches it and records
 *  the failure. */
interface OhExpectation {
  /** Strict equality (\`===\`). */
  toBe(expected: unknown): void;
  /** Recursive structural equality for plain objects + arrays. */
  toEqual(expected: unknown): void;
  /** Truthy check. */
  toBeTruthy(): void;
  /** Falsy check. */
  toBeFalsy(): void;
  /** Substring match (requires a string receiver). */
  toContain(expected: string): void;
  /** Asserts \`response.status === expected\`. */
  toHaveStatus(expected: number): void;
}

type OhAdHocRequestBody =
  | { type: 'none' }
  | { type: 'json'; content: string }
  | { type: 'xml'; content: string }
  | { type: 'text'; content: string; rawFormat?: 'text' | 'javascript' | 'html' }
  | { type: 'form'; formParts: Array<OhFormField> }
  | { type: 'multipart'; multipartParts: Array<OhMultipartPart> }
  | { type: 'graphql'; content: string; graphqlVariables?: string; operationName?: string };

interface OhAdHocRequest {
  method: OhHttpMethod;
  url: string;
  headers?: Array<OhHeader>;
  params?: Array<OhParam>;
  body?: OhAdHocRequestBody;
}

interface OhAdHocResponse {
  status: number;
  statusText: string;
  url: string;
  headers: Array<OhHeader>;
  /** UTF-8 text verbatim, or base64 when \`bodyEncoding\` is set. */
  body: string;
  /** \`'base64'\` when \`body\` carries base64-encoded bytes (the payload
   *  is not UTF-8 text). Absent = text. */
  bodyEncoding?: 'base64';
  durationMs: number;
}

type OhBodyInit = OhAdHocRequestBody;

/** The half of \`oh\` every script shares. */
interface OpenHeadersCore {
  readonly variables: OhVariables;
  readonly vault: OhVault;

  /** Load a workspace script package by name (synchronous). Returns the
   *  package's \`module.exports\`. Packages come from the Package
   *  Library and cannot require other packages. */
  require(name: string): any;

  /** Fire an ad-hoc HTTP request through the executor. Respects the
   *  workspace's host-access, cookie-jar, and proxy settings. */
  sendRequest(request: OhAdHocRequest): Promise<OhAdHocResponse>;

  /** Register an assertion. The callback runs synchronously — throw
   *  (or call \`oh.expect(...).toBe(...)\`) to fail. Both pass and fail
   *  outcomes surface in the Tests view. */
  test(name: string, fn: () => void | Promise<void>): Promise<void>;

  expect(actual: unknown): OhExpectation;
}
`;

const OH_HTTP = `
/**
 * The \`oh\` global exposed inside pre-request + post-response scripts.
 * Same name in both.
 */
interface OpenHeaders extends OpenHeadersCore {
  readonly request: OhRequest;
  readonly response?: OhResponse;

  // ── Pre-request mutators (no-op in post-response scripts) ───────
  setUrl(url: string): void;
  setMethod(method: OhHttpMethod): void;
  setHeader(key: string, value: string): void;
  removeHeader(key: string): void;
  /** Query-param keys are case-sensitive (unlike header names) —
   *  replaces the first row with that exact key, else appends. */
  setQueryParam(key: string, value: string): void;
  removeQueryParam(key: string): void;
  setBody(body: OhBodyInit): void;
}

declare const oh: OpenHeaders;
`;

const OH_SESSION_PRELUDE = `
/** State shared by every hook call of this session — a counter across
 *  messages, a challenge kept from connect to the first reply. Mutate
 *  its fields; the object itself cannot be reassigned. */
interface OhSessionState { [key: string]: any }
`;

const OH_WS_CONNECT = `
/** The dial as composed: the user's rows resolved, the query params on
 *  the URL and parsed out beside it, the session credential NOT yet
 *  minted (it mints onto what the script leaves). */
interface OhWsConnect {
  readonly url: string;
  readonly headers: ReadonlyArray<OhHeader>;
  readonly params: ReadonlyArray<OhParam>;
  readonly subprotocols: ReadonlyArray<string>;
  /** \`0\` for the first dial, \`n\` for the n-th auto-reconnect attempt. */
  readonly attempt: number;
}

/** The \`oh\` global inside a WebSocket Before connect script — runs at
 *  every dial, reconnect attempts included. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly connect: OhWsConnect;
  setUrl(url: string): void;
  setHeader(key: string, value: string): void;
  removeHeader(key: string): void;
  /** Query-param keys are case-sensitive — replaces the first row with
   *  that exact key, else appends; rewrites the URL's query. */
  setQueryParam(key: string, value: string): void;
  removeQueryParam(key: string): void;
  /** Replace the \`Sec-WebSocket-Protocol\` offer, preference order. */
  setSubprotocols(subprotocols: ReadonlyArray<string>): void;
}

declare const oh: OpenHeaders;
`;

const OH_WS_SEND = `
/** The outgoing message after template resolution: the compose text
 *  (a Socket.IO event's JSON arguments array; a binary compose's base64
 *  bytes), the frame type, the Socket.IO addendum on that flavor. */
interface OhWsOutboundMessage {
  readonly direction: 'up';
  readonly text: string;
  readonly binary: boolean;
  readonly eventName?: string;
  readonly expectAck?: boolean;
  /** The capture position the message takes if it goes out. */
  readonly index: number;
}

/** The \`oh\` global inside a WebSocket Before send script — runs once
 *  per Send; heartbeat and protocol frames never pass here. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly message: OhWsOutboundMessage;
  /** Replace the outgoing text (a binary frame: its base64 bytes). */
  setMessage(text: string): void;
  /** Rename the Socket.IO event (that flavor only). */
  setEvent(eventName: string): void;
  /** Drop the message — nothing reaches the wire and Send reports it. */
  drop(): void;
}

declare const oh: OpenHeaders;
`;

const OH_WS_MESSAGE = `
/** One captured inbound frame, after the capture: the text decode of a
 *  text frame (\`null\` for a binary one), the bytes as the capture
 *  holds them, the capture index it took. */
interface OhWsInboundMessage {
  readonly direction: 'down';
  readonly text: string | null;
  readonly dataBase64: string;
  readonly binary: boolean;
  readonly index: number;
}

/** The \`oh\` global inside a WebSocket On message script — runs once per
 *  captured inbound frame; the capture never waits for it. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly message: OhWsInboundMessage;
  /** Send a text frame into this session — captured like any ↑
   *  message, never re-entering Before send. */
  send(text: string): Promise<void>;
  /** Send a binary frame — the bytes as base64. */
  sendBinary(base64: string): Promise<void>;
  /** Emit a Socket.IO event (that flavor only); \`args\` become the
   *  packet's arguments array. */
  emit(eventName: string, args?: ReadonlyArray<unknown>, options?: { expectAck?: boolean }): Promise<void>;
}

declare const oh: OpenHeaders;
`;

const OH_WS_CLOSE = `
/** The session's end record: the Close frame verbatim (\`code\` \`null\`
 *  when the connection severed without one), whether the user stopped
 *  it, the capture counts and the whole-session wall time. */
interface OhWsClose {
  readonly code: number | null;
  readonly reason: string;
  readonly wasClean: boolean;
  readonly stopped: boolean;
  readonly messages: number;
  readonly droppedMessages: number;
  readonly durationMs: number;
}

/** The \`oh\` global inside a WebSocket After close script — runs once
 *  when a session that opened settles. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly close: OhWsClose;
}

declare const oh: OpenHeaders;
`;

const OH_MQTT_PRELUDE = `
type OhMqttQos = 0 | 1 | 2;

/** The compose spellings a script reads and writes: UTF-8 text (JSON is
 *  text) or the bytes as base64 — a hex compose re-spells as base64. */
type OhMqttPayloadFormat = 'text' | 'json' | 'base64';

/** The 5.0 per-message properties — ignored on a 3.1.1 session. */
interface OhMqttMessageProperties {
  userProperties?: Array<OhHeader>;
  responseTopic?: string;
  /** Text — travels as its UTF-8 bytes. */
  correlationData?: string;
  messageExpiryInterval?: number;
  contentType?: string;
  payloadFormatIndicator?: boolean;
}
`;

const OH_MQTT_CONNECT = `
/** The last will as the CONNECT registers it — the payload as bytes
 *  (base64), the QoS and RETAIN flags. */
interface OhMqttWill {
  readonly topic: string;
  readonly payloadBase64: string;
  readonly qos: OhMqttQos;
  readonly retain: boolean;
}

/** One open-time subscription — the Topics row as resolved. */
interface OhMqttSubscription {
  topicFilter: string;
  qos: OhMqttQos;
  noLocal?: boolean;
  retainAsPublished?: boolean;
  retainHandling?: 0 | 1 | 2;
  subscriptionId?: number;
  userProperties?: Array<OhHeader>;
}

/** The CONNECT as composed: the client id (the entity's, or the
 *  per-connect generated one), the Basic credential's pair (\`''\` =
 *  none), the will, the rows that SUBSCRIBE at open, the CONNECT user
 *  properties (5.0). Templates already resolved. */
interface OhMqttConnect {
  readonly url: string;
  readonly protocolVersion: '5.0' | '3.1.1';
  readonly clientId: string;
  readonly username: string;
  readonly password: string;
  readonly will: OhMqttWill | null;
  readonly subscriptions: ReadonlyArray<OhMqttSubscription>;
  readonly userProperties: ReadonlyArray<OhHeader>;
  /** \`0\` for the first dial, \`n\` for the n-th auto-reconnect attempt. */
  readonly attempt: number;
}

/** What \`oh.setWill\` accepts — the payload as text, or as bytes when
 *  \`format\` says base64. */
interface OhMqttWillInput {
  topic: string;
  payload: string;
  format?: 'text' | 'base64';
  qos?: OhMqttQos;
  retain?: boolean;
}

/** The \`oh\` global inside an MQTT Before connect script — runs at
 *  every dial, reconnect attempts included. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly connect: OhMqttConnect;
  setClientId(clientId: string): void;
  setUsername(username: string): void;
  setPassword(password: string): void;
  /** Replace the will; \`null\` registers none. */
  setWill(will: OhMqttWillInput | null): void;
  /** Replace the open-time subscription list. */
  setSubscriptions(subscriptions: ReadonlyArray<OhMqttSubscription>): void;
  /** Add (or replace by filter) one open-time subscription. */
  addSubscription(topicFilter: string, options?: Partial<Omit<OhMqttSubscription, 'topicFilter'>>): void;
  removeSubscription(topicFilter: string): void;
  /** CONNECT user properties (5.0) — keys are case-sensitive. */
  setUserProperty(key: string, value: string): void;
  removeUserProperty(key: string): void;
}

declare const oh: OpenHeaders;
`;

const OH_MQTT_PUBLISH = `
/** The outgoing PUBLISH after template resolution: the topic, the
 *  payload in the script spelling (\`format\` says which), the flags,
 *  the 5.0 properties when the compose carries any. */
interface OhMqttOutboundMessage {
  readonly direction: 'up';
  readonly topic: string;
  readonly payload: string;
  readonly format: OhMqttPayloadFormat;
  readonly qos: OhMqttQos;
  readonly retain: boolean;
  readonly properties?: OhMqttMessageProperties;
  /** The event-log position the message takes if it goes out. */
  readonly index: number;
}

/** The \`oh\` global inside an MQTT Before publish script — runs once
 *  per Send; the driver's own protocol frames never pass here. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly message: OhMqttOutboundMessage;
  setTopic(topic: string): void;
  /** Replace the payload — text by default; pass \`'base64'\` for bytes. */
  setPayload(payload: string, format?: OhMqttPayloadFormat): void;
  setQos(qos: OhMqttQos): void;
  setRetain(retain: boolean): void;
  /** Replace the 5.0 property block wholesale. */
  setProperties(properties: OhMqttMessageProperties): void;
  setUserProperty(key: string, value: string): void;
  removeUserProperty(key: string): void;
  /** Drop the message — nothing reaches the wire and Send reports it. */
  drop(): void;
}

declare const oh: OpenHeaders;
`;

const OH_MQTT_MESSAGE = `
/** One captured inbound PUBLISH, after the capture: the topic (an alias
 *  resolved), the payload bytes and their UTF-8 decode (\`null\` when the
 *  bytes are not text), the flags as facts, the 5.0 properties the
 *  packet carried, the event-log index it took. */
interface OhMqttInboundMessage {
  readonly direction: 'down';
  readonly topic: string;
  readonly payloadBase64: string;
  readonly text: string | null;
  readonly qos: OhMqttQos;
  readonly retain: boolean;
  readonly dup: boolean;
  readonly properties?: OhMqttMessageProperties;
  readonly index: number;
}

interface OhMqttPublishOptions {
  format?: OhMqttPayloadFormat;
  qos?: OhMqttQos;
  retain?: boolean;
  properties?: OhMqttMessageProperties;
}

/** The \`oh\` global inside an MQTT On message script — runs once per
 *  captured inbound PUBLISH; the capture never waits for it. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly message: OhMqttInboundMessage;
  /** Publish into this session — captured like any ↑ message, never
   *  re-entering Before publish. */
  publish(topic: string, payload: string, options?: OhMqttPublishOptions): Promise<void>;
}

declare const oh: OpenHeaders;
`;

const OH_MQTT_CLOSE = `
/** The session's end record: how the (last) connection ended — the
 *  clean client DISCONNECT, the broker's DISCONNECT with its verbatim
 *  reason, \`null\` for a severed connection — the CONNACK facts,
 *  whether the user stopped it, the capture counts both directions and
 *  the whole-session wall time. */
interface OhMqttClose {
  readonly end: { by: 'client' } | { by: 'broker'; reasonCode: number | null } | null;
  readonly connack: { sessionPresent: boolean; reasonCode: number } | null;
  readonly stopped: boolean;
  readonly published: number;
  readonly received: number;
  readonly droppedMessages: number;
  readonly durationMs: number;
}

/** The \`oh\` global inside an MQTT After close script — runs once when
 *  a session that opened settles. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly close: OhMqttClose;
}

declare const oh: OpenHeaders;
`;

const OH_GRPC_INVOKE = `
/** The call as composed: the target authority, the method, the
 *  metadata rows resolved (the session credential NOT yet minted — it
 *  mints onto what the script leaves), the composed message text. A
 *  unary or server-streaming call encodes the text at invoke; a
 *  client or bidi call opens an empty request stream and its Send
 *  writes the compose fresh, so \`setMessage\` lands nowhere there. */
interface OhGrpcInvoke {
  readonly target: string;
  readonly service: string;
  readonly method: string;
  readonly shape: 'unary' | 'server-streaming' | 'client-streaming' | 'bidi-streaming';
  readonly metadata: ReadonlyArray<OhHeader>;
  readonly messageText: string;
}

/** The \`oh\` global inside a gRPC Before invoke script — runs once
 *  before the call leaves. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly invoke: OhGrpcInvoke;
  /** Metadata keys match case-insensitively — replaces the row with
   *  that key, else appends. */
  setMetadata(key: string, value: string): void;
  removeMetadata(key: string): void;
  /** Replace the message text — JSON against the method's request type. */
  setMessage(text: string): void;
}

declare const oh: OpenHeaders;
`;

const OH_GRPC_MESSAGE = `
/** One captured frame, either direction, after the capture: the
 *  message decoded through the linked spec as the method's request
 *  type (↑) or response type (↓) — \`null\` when the bytes did not
 *  decode as it, or the frame is compressed — the bytes as captured,
 *  the capture index it took. */
interface OhGrpcFrame {
  readonly direction: 'up' | 'down';
  readonly type: string | null;
  readonly value: any;
  readonly dataBase64: string;
  readonly compressed: boolean;
  readonly index: number;
}

/** The \`oh\` global inside a gRPC On message script — runs once per
 *  captured frame, sent and received alike; the capture never waits
 *  for it. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly message: OhGrpcFrame;
}

declare const oh: OpenHeaders;
`;

const OH_GRPC_RESPONSE = `
/** The call's end record: the HTTP/2 status, the gRPC status as the
 *  reply carried it (\`null\` when it carried none) with its message
 *  and where it was found, the initial metadata and the trailers
 *  verbatim, the frame counts both directions, whether the user
 *  stopped the call, the whole-call wall time. */
interface OhGrpcResponse {
  readonly httpStatus: number;
  readonly status: number | null;
  readonly statusMessage?: string;
  readonly statusSource: 'trailers' | 'headers' | null;
  readonly headers: ReadonlyArray<OhHeader>;
  readonly trailers: ReadonlyArray<OhHeader>;
  readonly sent: number;
  readonly received: number;
  readonly stopped: boolean;
  readonly durationMs: number;
}

/** The \`oh\` global inside a gRPC After response script — runs once
 *  when a call that produced a response settles. */
interface OpenHeaders extends OpenHeadersCore {
  readonly session: OhSessionState;
  readonly response: OhGrpcResponse;
}

declare const oh: OpenHeaders;
`;

/** The HTTP pair's declaration — what the editor bootstraps with. */
export const OH_AMBIENT_DTS = `${OH_PRELUDE}${OH_HTTP}`;

/** The declaration for one slot kind — the editor swaps it in with the
 *  rail selection. Kinds whose hooks have not landed read the HTTP
 *  surface until their slice defines theirs. */
export function ohAmbientDts(kind: ScriptKind): string {
  switch (kind) {
    case 'ws-before-connect':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_WS_CONNECT}`;
    case 'ws-before-send':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_WS_SEND}`;
    case 'ws-on-message':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_WS_MESSAGE}`;
    case 'ws-after-close':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_WS_CLOSE}`;
    case 'mqtt-before-connect':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_MQTT_PRELUDE}${OH_MQTT_CONNECT}`;
    case 'mqtt-before-publish':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_MQTT_PRELUDE}${OH_MQTT_PUBLISH}`;
    case 'mqtt-on-message':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_MQTT_PRELUDE}${OH_MQTT_MESSAGE}`;
    case 'mqtt-after-close':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_MQTT_CLOSE}`;
    case 'grpc-before-invoke':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_GRPC_INVOKE}`;
    case 'grpc-on-message':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_GRPC_MESSAGE}`;
    case 'grpc-after-response':
      return `${OH_PRELUDE}${OH_SESSION_PRELUDE}${OH_GRPC_RESPONSE}`;
    default:
      return OH_AMBIENT_DTS;
  }
}
