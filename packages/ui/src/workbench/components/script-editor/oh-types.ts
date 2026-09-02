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
 * or the reply verbs, `oh.close`) plus `oh.session`. The editor swaps
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
  | { readonly type: 'graphql'; readonly content: string; readonly graphqlVariables?: string };

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
  | { type: 'graphql'; content: string; graphqlVariables?: string };

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
    default:
      return OH_AMBIENT_DTS;
  }
}
