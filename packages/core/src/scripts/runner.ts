/**
 * Script runner core — the transport-agnostic half of a script runtime
 * (ARCHITECTURE §19). One execution takes a `ScriptExecutionRequest`,
 * compiles the user source in a fresh `new Function` scope, exposes the
 * `oh.*` script API, and returns the `ScriptExecutionResult` envelope.
 *
 * Hosts wrap this in their own isolation + transport:
 *   • the desktop's Safe mode runs it inside a hidden sandboxed
 *     renderer, `oh.*` host RPCs riding `window.postMessage`;
 *   • the desktop's Developer mode runs it inside a `utilityProcess`
 *     worker, the same envelopes riding `process.parentPort` — and
 *     injects Node's `require` into the script scope via
 *     {@link ScriptRunnerDeps.scopeExtras}.
 *
 * The core itself never touches storage, network, or host APIs: every
 * side-effecting `oh.*` call is reflected through the injected
 * `sendHostRequest`, and the host's broker is the only thing that
 * speaks to the engine. Scripts execute in a fresh scope per run — no
 * `globalThis.X = ...` carryover between pre-request and test scripts.
 *
 * The `oh` surface is ONE core (`variables`, `vault`, `require`,
 * `sendRequest`, `test`, `expect`, `session`) plus a family half the
 * execution's kind picks: the HTTP pair sees `oh.request` /
 * `oh.response` and the request mutators; a WebSocket hook sees its
 * input — `oh.connect` with the dial mutators, `oh.message` with the
 * send mutators or the reply verbs, `oh.close` — and folds its edits
 * into one `sessionMutation` under the HTTP mutation's law (a complete
 * diff replaces the pending one, all-empty normalizes to none); an
 * MQTT hook is the twin on the CONNECT / PUBLISH plane (`oh.connect`
 * with the client id / credential / will / subscription / user-property
 * mutators, `oh.message` with the publish mutators or `oh.publish`,
 * `oh.close`).
 *
 * Sessions: an execution carrying `sessionId` is one hook call of a
 * live session (a WebSocket, MQTT or gRPC session's connect / send /
 * message / close scripts). The runtime keeps ONE context per session
 * — the plain object behind `oh.session`, and the hook sources
 * compiled once — until the host sends `script.session-end`
 * ({@link endScriptSession}). Every hook call still gets a fresh call
 * scope; `oh.session` is the only carrier across calls, by design.
 */

import type {
  HttpScriptExecution,
  RequestMutation,
  RequestSnapshot,
  ResponseSnapshot,
  ScriptConsoleEntry,
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptHostRequest,
  ScriptHostResponse,
  SessionScriptExecution,
  SessionSendResult,
  TestAssertion,
} from './index';
import { clampScriptTimeoutMs, isSessionScriptExecution } from './index';
import type {
  MqttCloseSnapshot,
  MqttConnectSnapshot,
  MqttConnectSubscription,
  MqttConnectWill,
  MqttInboundMessageSnapshot,
  MqttOutboundMessageSnapshot,
  MqttScriptMessageProperties,
  MqttScriptPayloadFormat,
  MqttSessionQos,
  SessionHeader,
  SessionParam,
  SessionPublishMessage,
  SessionScriptMutation,
  WsCloseSnapshot,
  WsConnectSnapshot,
  WsInboundMessageSnapshot,
  WsOutboundMessageSnapshot,
} from './session-hooks';

/** Minimal console surface handed to scripts — platform-neutral (the
 *  DOM `Console` type isn't available in every host build). */
export interface ScriptConsole {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface ScriptRunnerDeps {
  /** Reflect one `oh.*` host RPC to the broker and await its reply. */
  sendHostRequest(request: ScriptHostRequest): Promise<ScriptHostResponse>;
  /**
   * Extra identifiers injected into the compiled script's scope (and
   * package bodies). The Safe runtimes pass none — anything beyond
   * `oh` + `console` stays a ReferenceError. The Developer worker
   * passes Node's `require` here; full-runtime access is its point.
   */
  scopeExtras?: Record<string, unknown>;
}

/** A hook compiled once: the user source in its own scope, called per
 *  execution with `oh`, `console` and the host's scope extras. */
type CompiledHook = (...args: unknown[]) => Promise<void>;

/** One live session's runtime state — see the module doc. */
interface ScriptSessionContext {
  /** The object behind `oh.session` — the session's whole script state. */
  state: Record<string, unknown>;
  /** Hook sources compiled once for the session, keyed by the source
   *  itself: every level's script of one hook keeps its own entry, and
   *  an edited source simply compiles a new one. */
  compiled: Map<string, CompiledHook>;
}

const sessions = new Map<string, ScriptSessionContext>();

function sessionContextFor(sessionId: string): ScriptSessionContext {
  let context = sessions.get(sessionId);
  if (context === undefined) {
    context = { state: {}, compiled: new Map() };
    sessions.set(sessionId, context);
  }
  return context;
}

/**
 * Drop a session's runtime context — its `oh.session` state and its
 * compiled hooks. The host sends `script.session-end` when the session
 * settles; an unknown id is a no-op (the session never ran a hook, or
 * the runtime respawned since).
 */
export function endScriptSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Compile user source in its own scope. We intentionally do NOT expose
 * the host global — only `oh` + `console` (+ the host's declared scope
 * extras) are passed as arguments. Anything else the script touches
 * falls back to whatever globals the host's isolation layer left
 * reachable.
 */
function compileHook(source: string, extraNames: readonly string[]): CompiledHook {
  return new Function(
    'oh',
    'console',
    ...extraNames,
    `"use strict";\nreturn (async () => {\n${source}\n})();`,
  ) as CompiledHook;
}

/** The session's compiled hook for `source`, compiling on first sight. */
function compiledHookFor(context: ScriptSessionContext, source: string, extraNames: readonly string[]): CompiledHook {
  let hook = context.compiled.get(source);
  if (hook === undefined) {
    hook = compileHook(source, extraNames);
    context.compiled.set(source, hook);
  }
  return hook;
}

/**
 * Run one script execution request to completion. Never rejects for a
 * script-level fault — syntax errors, throws, and timeouts fold into a
 * failed result that still carries whatever the script produced first.
 */
export async function executeScript(
  req: ScriptExecutionRequest,
  deps: ScriptRunnerDeps,
): Promise<ScriptExecutionResult> {
  const startedAt = performance.now();
  const consoleLog: ScriptConsoleEntry[] = [];
  const assertions: TestAssertion[] = [];
  let mutation: RequestMutation | undefined;
  let sessionMutation: SessionScriptMutation | undefined;
  let error: { name: string; message: string; stack?: string } | undefined;
  const timeoutMs = clampScriptTimeoutMs(req.timeoutMs);
  const sessionId = isSessionScriptExecution(req) ? req.sessionId : undefined;
  const session = sessionId !== undefined ? sessionContextFor(sessionId) : null;

  const stamp = (): number => Math.round(performance.now() - startedAt);

  const capturingConsole = buildConsole(consoleLog, stamp);
  const oh = buildScriptApi(
    req,
    deps,
    assertions,
    capturingConsole,
    {
      // Every flush is a COMPLETE diff against the original input, so
      // each one replaces the pending mutation outright. Merging
      // field-wise would resurrect a change a later call reverted
      // (setHeader then removeHeader must end as "no header mutation").
      // All-empty diffs normalize to undefined so a net-unchanged input
      // reports none — the family builders hand `undefined` for those.
      emitMutation: (next) => {
        mutation = next;
      },
      emitSessionMutation: (next) => {
        sessionMutation = next;
      },
    },
    session?.state,
  );

  const extraNames = Object.keys(deps.scopeExtras ?? {});
  const extraValues = extraNames.map((name) => (deps.scopeExtras as Record<string, unknown>)[name]);

  try {
    // A syntax error surfaces here, from the compile, and folds into
    // the failed result like a throw — a session's cache only ever
    // holds hooks that compiled.
    const fn =
      session === null ? compileHook(req.source, extraNames) : compiledHookFor(session, req.source, extraNames);
    await withTimeout(fn(oh, capturingConsole, ...extraValues), timeoutMs);
  } catch (err) {
    if (err instanceof Error) {
      error = { name: err.name, message: err.message, stack: err.stack };
    } else {
      error = { name: 'Error', message: String(err) };
    }
    // Surface an uncaught script error as a failed assertion so the
    // response panel can show it inline even if the script produced
    // no explicit oh.test() calls.
    assertions.push({
      name: 'script error',
      passed: false,
      message: error.message,
    });
  }

  return {
    executionId: req.executionId,
    succeeded: !error,
    error,
    mutation,
    sessionMutation,
    assertions,
    consoleLog,
    durationMs: Math.round(performance.now() - startedAt),
  };
}

// ── oh.* API ──────────────────────────────────────────────────────

/** What `oh.sendRequest` accepts from user code — headers / params /
 *  body are optional (the ambient `oh.d.ts` advertises them as such)
 *  and get defaulted before the snapshot crosses to the host. */
type AdHocRequestInput = Pick<RequestSnapshot, 'method' | 'url'> &
  Partial<Pick<RequestSnapshot, 'headers' | 'params' | 'body'>>;

/** The half of `oh` every family shares. */
interface ScriptApiCore {
  /** The live session's shared state — present only on a session hook
   *  call (see the module doc). Mutate its fields; the object itself is
   *  the session's and cannot be reassigned. */
  readonly session?: Record<string, unknown>;
  variables: {
    get(name: string): Promise<string | null>;
    set(name: string, value: string): Promise<void>;
  };
  vault: {
    get(ref: string): Promise<string | null>;
  };
  require(name: string): unknown;
  sendRequest(request: AdHocRequestInput): Promise<ResponseSnapshot>;
  test(name: string, fn: () => void | Promise<void>): Promise<void>;
  expect(actual: unknown): Expectation;
}

/** The HTTP pair's `oh` — the request view and its mutators. */
interface HttpScriptApi extends ScriptApiCore {
  request: RequestSnapshot;
  response?: ResponseSnapshot;
  setUrl(url: string): void;
  setMethod(method: RequestSnapshot['method']): void;
  setHeader(key: string, value: string): void;
  removeHeader(key: string): void;
  setQueryParam(key: string, value: string): void;
  removeQueryParam(key: string): void;
  setBody(body: RequestSnapshot['body']): void;
}

/** Before connect — the dial view and the same mutator verbs the HTTP
 *  request carries, plus the subprotocol offer. */
interface WsConnectScriptApi extends ScriptApiCore {
  readonly connect: WsConnectSnapshot;
  setUrl(url: string): void;
  setHeader(key: string, value: string): void;
  removeHeader(key: string): void;
  setQueryParam(key: string, value: string): void;
  removeQueryParam(key: string): void;
  setSubprotocols(subprotocols: readonly string[]): void;
}

/** Before send — the outgoing message view, rewrite or drop. */
interface WsSendScriptApi extends ScriptApiCore {
  readonly message: WsOutboundMessageSnapshot;
  setMessage(text: string): void;
  setEvent(eventName: string): void;
  drop(): void;
}

/** On message — the captured inbound frame and the reply verbs. */
interface WsInboundScriptApi extends ScriptApiCore {
  readonly message: WsInboundMessageSnapshot;
  send(text: string): Promise<void>;
  sendBinary(base64: string): Promise<void>;
  emit(eventName: string, args?: readonly unknown[], options?: { expectAck?: boolean }): Promise<void>;
}

/** After close — the end record, read-only. */
interface WsCloseScriptApi extends ScriptApiCore {
  readonly close: WsCloseSnapshot;
}

/** What `oh.setWill` accepts — the will's payload as text, or as
 *  bytes when `format` says base64; `null` drops the will. */
interface MqttWillInput {
  topic: string;
  payload: string;
  format?: 'text' | 'base64';
  qos?: MqttSessionQos;
  retain?: boolean;
}

/** Before connect (MQTT) — the CONNECT view and its mutators. */
interface MqttConnectScriptApi extends ScriptApiCore {
  readonly connect: MqttConnectSnapshot;
  setClientId(clientId: string): void;
  setUsername(username: string): void;
  setPassword(password: string): void;
  setWill(will: MqttWillInput | null): void;
  setSubscriptions(subscriptions: readonly MqttConnectSubscription[]): void;
  addSubscription(topicFilter: string, options?: Partial<Omit<MqttConnectSubscription, 'topicFilter'>>): void;
  removeSubscription(topicFilter: string): void;
  setUserProperty(key: string, value: string): void;
  removeUserProperty(key: string): void;
}

/** Before publish — the outgoing PUBLISH view, rewrite or drop. */
interface MqttPublishScriptApi extends ScriptApiCore {
  readonly message: MqttOutboundMessageSnapshot;
  setTopic(topic: string): void;
  setPayload(payload: string, format?: MqttScriptPayloadFormat): void;
  setQos(qos: MqttSessionQos): void;
  setRetain(retain: boolean): void;
  setProperties(properties: MqttScriptMessageProperties): void;
  setUserProperty(key: string, value: string): void;
  removeUserProperty(key: string): void;
  drop(): void;
}

/** What `oh.publish` accepts beside the topic and payload. */
type MqttPublishOptions = Omit<SessionPublishMessage, 'topic' | 'payload'>;

/** On message (MQTT) — the captured inbound PUBLISH and the reply verb. */
interface MqttInboundScriptApi extends ScriptApiCore {
  readonly message: MqttInboundMessageSnapshot;
  publish(topic: string, payload: string, options?: MqttPublishOptions): Promise<void>;
}

/** After close (MQTT) — the end record, read-only. */
interface MqttCloseScriptApi extends ScriptApiCore {
  readonly close: MqttCloseSnapshot;
}

type ScriptApi =
  | HttpScriptApi
  | WsConnectScriptApi
  | WsSendScriptApi
  | WsInboundScriptApi
  | WsCloseScriptApi
  | MqttConnectScriptApi
  | MqttPublishScriptApi
  | MqttInboundScriptApi
  | MqttCloseScriptApi;

/** A family's own half — what it adds over the core. */
type HttpFamily = Omit<HttpScriptApi, keyof ScriptApiCore>;
type WsConnectFamily = Omit<WsConnectScriptApi, keyof ScriptApiCore>;
type WsSendFamily = Omit<WsSendScriptApi, keyof ScriptApiCore>;
type WsInboundFamily = Omit<WsInboundScriptApi, keyof ScriptApiCore>;
type MqttConnectFamily = Omit<MqttConnectScriptApi, keyof ScriptApiCore>;
type MqttPublishFamily = Omit<MqttPublishScriptApi, keyof ScriptApiCore>;
type MqttInboundFamily = Omit<MqttInboundScriptApi, keyof ScriptApiCore>;

interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(expected: string): void;
  toHaveStatus(expected: number): void;
}

interface MutationSinks {
  emitMutation: (m: RequestMutation | undefined) => void;
  emitSessionMutation: (m: SessionScriptMutation | undefined) => void;
}

function buildScriptApi(
  req: ScriptExecutionRequest,
  deps: ScriptRunnerDeps,
  assertions: TestAssertion[],
  capturingConsole: ScriptConsole,
  sinks: MutationSinks,
  sessionState: Record<string, unknown> | undefined,
): ScriptApi {
  let rpcCounter = 0;
  const nextRpcId = (): string => {
    rpcCounter += 1;
    return `${req.executionId}:${rpcCounter}`;
  };
  const sendHost = (request: ScriptHostRequest): Promise<ScriptHostResponse> => deps.sendHostRequest(request);

  const hostGet = async (name: string): Promise<string | null> => {
    const response = await sendHost({ executionId: req.executionId, rpcId: nextRpcId(), op: 'variables.get', name });
    if (!response.ok) throw new Error(`oh.variables.get failed: ${response.error}`);
    return (response.value as string | null) ?? null;
  };

  const hostSet = async (name: string, value: string): Promise<void> => {
    const response = await sendHost({
      executionId: req.executionId,
      rpcId: nextRpcId(),
      op: 'variables.set',
      name,
      value,
    });
    if (!response.ok) throw new Error(`oh.variables.set failed: ${response.error}`);
  };

  const hostVault = async (ref: string): Promise<string | null> => {
    const response = await sendHost({ executionId: req.executionId, rpcId: nextRpcId(), op: 'vault.get', ref });
    if (!response.ok) throw new Error(`oh.vault.get failed: ${response.error}`);
    return (response.value as string | null) ?? null;
  };

  const hostSendRequest = async (request: AdHocRequestInput): Promise<ResponseSnapshot> => {
    // Normalize at the user-input boundary — the host's protocol type
    // requires the full snapshot shape.
    const snapshot: RequestSnapshot = {
      method: request.method,
      url: request.url,
      headers: request.headers ?? [],
      params: request.params ?? [],
      body: request.body ?? { type: 'none' },
    };
    const response = await sendHost({
      executionId: req.executionId,
      rpcId: nextRpcId(),
      op: 'sendRequest',
      request: snapshot,
    });
    if (!response.ok) throw new Error(`oh.sendRequest failed: ${response.error}`);
    return response.value as ResponseSnapshot;
  };

  // ── oh.require ──────────────────────────────────────────────────
  // Packages arrive pre-resolved on the execution request, so require
  // is synchronous. Each package compiles lazily on first require and
  // memoizes its `module.exports` for the rest of THIS execution —
  // fresh scope per run, same as the top-level script. Packages see
  // the full `oh` surface except `require` itself (no package-to-
  // package imports), through `packageApi` below.
  const extraNames = Object.keys(deps.scopeExtras ?? {});
  const extraValues = extraNames.map((name) => (deps.scopeExtras as Record<string, unknown>)[name]);
  const compiledPackages = new Map<string, unknown>();
  const requirePackage = (name: string): unknown => {
    if (compiledPackages.has(name)) return compiledPackages.get(name);
    const pkg = req.packages?.find((p) => p.name === name);
    if (!pkg) {
      const known = (req.packages ?? []).map((p) => p.name);
      throw new Error(
        `oh.require: package "${name}" not found${known.length > 0 ? ` — available: ${known.join(', ')}` : ' — no packages in this workspace'}`,
      );
    }
    const module = { exports: {} as unknown };
    // Package bodies run synchronously (no async wrapper) — require
    // must return `module.exports` in the same tick.
    const fn = new Function('module', 'exports', 'oh', 'console', ...extraNames, `"use strict";\n${pkg.source}\n`) as (
      ...args: unknown[]
    ) => void;
    fn(module, module.exports, packageApi, capturingConsole, ...extraValues);
    compiledPackages.set(name, module.exports);
    return module.exports;
  };

  const core: ScriptApiCore = {
    // A getter with no setter: `oh.session = {}` throws under strict
    // mode instead of silently detaching the script from the session.
    get session() {
      return sessionState;
    },
    variables: {
      get: hostGet,
      set: async (name, value) => {
        await hostSet(name, value);
      },
    },
    vault: {
      get: hostVault,
    },
    require: requirePackage,
    sendRequest: hostSendRequest,
    async test(name, fn) {
      const t0 = performance.now();
      try {
        await fn();
        assertions.push({ name, passed: true, durationMs: Math.round(performance.now() - t0) });
      } catch (err) {
        assertions.push({
          name,
          passed: false,
          message: err instanceof Error ? err.message : String(err),
          durationMs: Math.round(performance.now() - t0),
        });
      }
    },
    expect: makeExpectation,
  };

  const api: ScriptApi = isSessionScriptExecution(req)
    ? buildSessionApi(core, req, sinks, {
        send: (message) =>
          sendHost({ executionId: req.executionId, rpcId: nextRpcId(), op: 'session.send', ...message }),
        publish: (message) =>
          sendHost({ executionId: req.executionId, rpcId: nextRpcId(), op: 'session.publish', ...message }),
      })
    : buildHttpApi(core, req, sinks);

  // The `oh` handed to PACKAGE bodies: identical surface (the getters
  // walk the prototype chain, so `oh.request` stays the live draft
  // view) except `require`, which refuses — packages can't require
  // other packages.
  const packageApi: ScriptApi = Object.create(api, {
    require: {
      value: () => {
        throw new Error('oh.require is not available inside packages — packages cannot require other packages');
      },
    },
  }) as ScriptApi;

  return api;
}

/**
 * A family's `oh`: the family members as an own literal (its getters
 * stay getters — a spread would freeze them to values) over the core
 * as its prototype, so `oh.session` and the shared verbs resolve up
 * the chain the way the package `oh` resolves to the script's.
 */
function withCore<F extends object>(core: ScriptApiCore, family: F): ScriptApiCore & F {
  return Object.setPrototypeOf(family, core) as ScriptApiCore & F;
}

// ── The HTTP pair ─────────────────────────────────────────────────

function buildHttpApi(core: ScriptApiCore, req: HttpScriptExecution, sinks: MutationSinks): HttpScriptApi {
  const draftHeaders: Array<{ key: string; value: string }> = [...req.request.headers];
  const draftParams: Array<{ key: string; value: string }> = [...req.request.params];
  let draftUrl = req.request.url;
  let draftMethod = req.request.method;
  let draftBody = req.request.body;

  const flushMutation = (): void => {
    const next: RequestMutation = {
      url: draftUrl !== req.request.url ? draftUrl : undefined,
      method: draftMethod !== req.request.method ? draftMethod : undefined,
      headers: arraysShallowEqual(draftHeaders, req.request.headers) ? undefined : [...draftHeaders],
      params: arraysShallowEqual(draftParams, req.request.params) ? undefined : [...draftParams],
      body: bodyChanged(draftBody, req.request.body) ? draftBody : undefined,
    };
    const hasChange =
      next.method !== undefined ||
      next.url !== undefined ||
      next.headers !== undefined ||
      next.params !== undefined ||
      next.body !== undefined;
    sinks.emitMutation(hasChange ? next : undefined);
  };

  const family: HttpFamily = {
    get request() {
      return {
        ...req.request,
        url: draftUrl,
        method: draftMethod,
        headers: [...draftHeaders],
        params: [...draftParams],
        body: draftBody,
      };
    },
    response: req.response,
    setUrl(url) {
      draftUrl = url;
      flushMutation();
    },
    setMethod(method) {
      draftMethod = method;
      flushMutation();
    },
    setHeader(key, value) {
      setHeaderRow(draftHeaders, key, value);
      flushMutation();
    },
    removeHeader(key) {
      removeHeaderRows(draftHeaders, key);
      flushMutation();
    },
    setQueryParam(key, value) {
      setParamRow(draftParams, key, value);
      flushMutation();
    },
    removeQueryParam(key) {
      removeParamRows(draftParams, key);
      flushMutation();
    },
    setBody(body) {
      draftBody = body;
      flushMutation();
    },
  };
  return withCore(core, family);
}

// ── The session hooks ─────────────────────────────────────────────

/** The `session.send` op minus the envelope — what a reply verb hands over. */
type SessionSendMessage = Omit<Extract<ScriptHostRequest, { op: 'session.send' }>, 'executionId' | 'rpcId' | 'op'>;
/** The `session.publish` op minus the envelope — the MQTT reply verb's. */
type SessionPublishRequest = Omit<
  Extract<ScriptHostRequest, { op: 'session.publish' }>,
  'executionId' | 'rpcId' | 'op'
>;

/** The session write ops a hook's reply verbs reach the host through. */
interface SessionHostOps {
  send(message: SessionSendMessage): Promise<ScriptHostResponse>;
  publish(message: SessionPublishRequest): Promise<ScriptHostResponse>;
}

function buildSessionApi(
  core: ScriptApiCore,
  req: SessionScriptExecution,
  sinks: MutationSinks,
  ops: SessionHostOps,
): ScriptApi {
  const hook = req.hook;
  switch (hook.kind) {
    case 'ws-before-connect':
      return buildWsConnectApi(core, hook.connect, sinks);
    case 'ws-before-send':
      return buildWsSendApi(core, hook.message, sinks);
    case 'ws-on-message':
      return buildWsInboundApi(core, hook.message, req.sessionId, ops.send);
    case 'ws-after-close':
      return withCore(core, { close: hook.close });
    case 'mqtt-before-connect':
      return buildMqttConnectApi(core, hook.connect, sinks);
    case 'mqtt-before-publish':
      return buildMqttPublishApi(core, hook.message, sinks);
    case 'mqtt-on-message':
      return buildMqttInboundApi(core, hook.message, req.sessionId, ops.publish);
    case 'mqtt-after-close':
      return withCore(core, { close: hook.close });
    default: {
      const unreachable: never = hook;
      throw new Error(`unknown session hook ${(unreachable as { kind: string }).kind}`);
    }
  }
}

function buildWsConnectApi(core: ScriptApiCore, connect: WsConnectSnapshot, sinks: MutationSinks): WsConnectScriptApi {
  const draftHeaders: SessionHeader[] = [...connect.headers];
  const draftParams: SessionParam[] = [...connect.params];
  let draftUrl = connect.url;
  let draftSubprotocols: string[] = [...connect.subprotocols];

  const flush = (): void => {
    const next = {
      url: draftUrl !== connect.url ? draftUrl : undefined,
      headers: arraysShallowEqual(draftHeaders, connect.headers) ? undefined : [...draftHeaders],
      params: arraysShallowEqual(draftParams, connect.params) ? undefined : [...draftParams],
      subprotocols: stringListsEqual(draftSubprotocols, connect.subprotocols) ? undefined : [...draftSubprotocols],
    };
    const hasChange =
      next.url !== undefined ||
      next.headers !== undefined ||
      next.params !== undefined ||
      next.subprotocols !== undefined;
    sinks.emitSessionMutation(hasChange ? { kind: 'ws-connect', ...next } : undefined);
  };

  const family: WsConnectFamily = {
    get connect() {
      return {
        url: draftUrl,
        headers: [...draftHeaders],
        params: [...draftParams],
        subprotocols: [...draftSubprotocols],
        attempt: connect.attempt,
      };
    },
    setUrl(url) {
      draftUrl = url;
      flush();
    },
    setHeader(key, value) {
      setHeaderRow(draftHeaders, key, value);
      flush();
    },
    removeHeader(key) {
      removeHeaderRows(draftHeaders, key);
      flush();
    },
    setQueryParam(key, value) {
      setParamRow(draftParams, key, value);
      flush();
    },
    removeQueryParam(key) {
      removeParamRows(draftParams, key);
      flush();
    },
    setSubprotocols(subprotocols) {
      draftSubprotocols = [...subprotocols];
      flush();
    },
  };
  return withCore(core, family);
}

function buildWsSendApi(
  core: ScriptApiCore,
  message: WsOutboundMessageSnapshot,
  sinks: MutationSinks,
): WsSendScriptApi {
  let draftText = message.text;
  let draftEvent = message.eventName;
  let dropped = false;

  const flush = (): void => {
    const next = {
      text: draftText !== message.text ? draftText : undefined,
      eventName: draftEvent !== message.eventName ? draftEvent : undefined,
      ...(dropped ? { drop: true as const } : {}),
    };
    const hasChange = next.text !== undefined || next.eventName !== undefined || dropped;
    sinks.emitSessionMutation(hasChange ? { kind: 'ws-send', ...next } : undefined);
  };

  const family: WsSendFamily = {
    get message() {
      return {
        ...message,
        text: draftText,
        ...(draftEvent !== undefined ? { eventName: draftEvent } : {}),
      };
    },
    setMessage(text) {
      draftText = text;
      flush();
    },
    setEvent(eventName) {
      draftEvent = eventName;
      flush();
    },
    drop() {
      dropped = true;
      flush();
    },
  };
  return withCore(core, family);
}

function buildWsInboundApi(
  core: ScriptApiCore,
  message: WsInboundMessageSnapshot,
  sessionId: string,
  sendSession: (message: SessionSendMessage) => Promise<ScriptHostResponse>,
): WsInboundScriptApi {
  const deliver = async (verb: string, payload: Omit<SessionSendMessage, 'sessionId'>): Promise<void> => {
    const response = await sendSession({ sessionId, ...payload });
    if (!response.ok) throw new Error(`${verb} failed: ${response.error}`);
    const result = response.value as SessionSendResult;
    if (!result.success) throw new Error(`${verb} failed: ${result.error ?? 'the session refused the message'}`);
  };
  const family: WsInboundFamily = {
    message,
    send: (text: string) => deliver('oh.send', { messageText: text }),
    sendBinary: (base64: string) => deliver('oh.sendBinary', { messageText: base64, binary: { encoding: 'base64' } }),
    emit: (eventName: string, args: readonly unknown[] = [], options: { expectAck?: boolean } = {}) =>
      deliver('oh.emit', {
        messageText: JSON.stringify(args),
        socketio: { eventName, expectAck: options.expectAck === true },
      }),
  };
  return withCore(core, family);
}

// ── The MQTT hooks ────────────────────────────────────────────────

function buildMqttConnectApi(
  core: ScriptApiCore,
  connect: MqttConnectSnapshot,
  sinks: MutationSinks,
): MqttConnectScriptApi {
  let draftClientId = connect.clientId;
  let draftUsername = connect.username;
  let draftPassword = connect.password;
  let draftWill: MqttConnectWill | null = connect.will === null ? null : { ...connect.will };
  let draftSubscriptions: MqttConnectSubscription[] = connect.subscriptions.map((s) => ({ ...s }));
  const draftUserProperties: SessionHeader[] = [...connect.userProperties];

  const flush = (): void => {
    const next = {
      clientId: draftClientId !== connect.clientId ? draftClientId : undefined,
      username: draftUsername !== connect.username ? draftUsername : undefined,
      password: draftPassword !== connect.password ? draftPassword : undefined,
      ...(jsonEqual(draftWill, connect.will) ? {} : { will: draftWill }),
      subscriptions: jsonEqual(draftSubscriptions, connect.subscriptions) ? undefined : [...draftSubscriptions],
      userProperties: arraysShallowEqual(draftUserProperties, connect.userProperties)
        ? undefined
        : [...draftUserProperties],
    };
    const hasChange =
      next.clientId !== undefined ||
      next.username !== undefined ||
      next.password !== undefined ||
      'will' in next ||
      next.subscriptions !== undefined ||
      next.userProperties !== undefined;
    sinks.emitSessionMutation(hasChange ? { kind: 'mqtt-connect', ...next } : undefined);
  };

  const family: MqttConnectFamily = {
    get connect() {
      return {
        url: connect.url,
        protocolVersion: connect.protocolVersion,
        clientId: draftClientId,
        username: draftUsername,
        password: draftPassword,
        will: draftWill === null ? null : { ...draftWill },
        subscriptions: draftSubscriptions.map((s) => ({ ...s })),
        userProperties: [...draftUserProperties],
        attempt: connect.attempt,
      };
    },
    setClientId(clientId) {
      draftClientId = clientId;
      flush();
    },
    setUsername(username) {
      draftUsername = username;
      flush();
    },
    setPassword(password) {
      draftPassword = password;
      flush();
    },
    setWill(will) {
      draftWill =
        will === null
          ? null
          : {
              topic: will.topic,
              payloadBase64: will.format === 'base64' ? will.payload : utf8ToBase64(will.payload),
              qos: will.qos ?? 0,
              retain: will.retain ?? false,
            };
      flush();
    },
    setSubscriptions(subscriptions) {
      draftSubscriptions = subscriptions.map((s) => ({ ...s }));
      flush();
    },
    addSubscription(topicFilter, options = {}) {
      const next: MqttConnectSubscription = { ...options, topicFilter, qos: options.qos ?? 0 };
      const idx = draftSubscriptions.findIndex((s) => s.topicFilter === topicFilter);
      if (idx >= 0) draftSubscriptions[idx] = next;
      else draftSubscriptions.push(next);
      flush();
    },
    removeSubscription(topicFilter) {
      draftSubscriptions = draftSubscriptions.filter((s) => s.topicFilter !== topicFilter);
      flush();
    },
    setUserProperty(key, value) {
      setParamRow(draftUserProperties, key, value);
      flush();
    },
    removeUserProperty(key) {
      removeParamRows(draftUserProperties, key);
      flush();
    },
  };
  return withCore(core, family);
}

function buildMqttPublishApi(
  core: ScriptApiCore,
  message: MqttOutboundMessageSnapshot,
  sinks: MutationSinks,
): MqttPublishScriptApi {
  let draftTopic = message.topic;
  let draftPayload = message.payload;
  let draftFormat = message.format;
  let draftQos = message.qos;
  let draftRetain = message.retain;
  let draftProperties: MqttScriptMessageProperties | undefined =
    message.properties === undefined ? undefined : { ...message.properties };
  let dropped = false;

  const flush = (): void => {
    const next = {
      topic: draftTopic !== message.topic ? draftTopic : undefined,
      payload: draftPayload !== message.payload ? draftPayload : undefined,
      format: draftFormat !== message.format ? draftFormat : undefined,
      qos: draftQos !== message.qos ? draftQos : undefined,
      retain: draftRetain !== message.retain ? draftRetain : undefined,
      properties: jsonEqual(draftProperties ?? null, message.properties ?? null) ? undefined : (draftProperties ?? {}),
      ...(dropped ? { drop: true as const } : {}),
    };
    const hasChange =
      next.topic !== undefined ||
      next.payload !== undefined ||
      next.format !== undefined ||
      next.qos !== undefined ||
      next.retain !== undefined ||
      next.properties !== undefined ||
      dropped;
    sinks.emitSessionMutation(hasChange ? { kind: 'mqtt-publish', ...next } : undefined);
  };

  const editProperties = (edit: (rows: SessionHeader[]) => void): void => {
    const rows = [...(draftProperties?.userProperties ?? [])];
    edit(rows);
    draftProperties = { ...(draftProperties ?? {}), userProperties: rows };
    flush();
  };

  const family: MqttPublishFamily = {
    get message() {
      return {
        ...message,
        topic: draftTopic,
        payload: draftPayload,
        format: draftFormat,
        qos: draftQos,
        retain: draftRetain,
        ...(draftProperties !== undefined ? { properties: { ...draftProperties } } : {}),
      };
    },
    setTopic(topic) {
      draftTopic = topic;
      flush();
    },
    setPayload(payload, format) {
      draftPayload = payload;
      if (format !== undefined) draftFormat = format;
      flush();
    },
    setQos(qos) {
      draftQos = qos;
      flush();
    },
    setRetain(retain) {
      draftRetain = retain;
      flush();
    },
    setProperties(properties) {
      draftProperties = { ...properties };
      flush();
    },
    setUserProperty(key, value) {
      editProperties((rows) => setParamRow(rows, key, value));
    },
    removeUserProperty(key) {
      editProperties((rows) => removeParamRows(rows, key));
    },
    drop() {
      dropped = true;
      flush();
    },
  };
  return withCore(core, family);
}

function buildMqttInboundApi(
  core: ScriptApiCore,
  message: MqttInboundMessageSnapshot,
  sessionId: string,
  publishSession: (message: SessionPublishRequest) => Promise<ScriptHostResponse>,
): MqttInboundScriptApi {
  const family: MqttInboundFamily = {
    message,
    publish: async (topic: string, payload: string, options: MqttPublishOptions = {}) => {
      const response = await publishSession({ sessionId, message: { ...options, topic, payload } });
      if (!response.ok) throw new Error(`oh.publish failed: ${response.error}`);
      const result = response.value as SessionSendResult;
      if (!result.success) throw new Error(`oh.publish failed: ${result.error ?? 'the session refused the message'}`);
    },
  };
  return withCore(core, family);
}

// ── Row edits the HTTP request and the WebSocket dial share ───────

function setHeaderRow(rows: Array<{ key: string; value: string }>, key: string, value: string): void {
  const idx = rows.findIndex((h) => h.key.toLowerCase() === key.toLowerCase());
  if (idx >= 0) rows[idx] = { key, value };
  else rows.push({ key, value });
}

function removeHeaderRows(rows: Array<{ key: string; value: string }>, key: string): void {
  const lower = key.toLowerCase();
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]?.key.toLowerCase() === lower) rows.splice(i, 1);
  }
}

/** Query-param keys are case-sensitive (unlike header names) — match
 *  exactly. Replace the first row with that key, else append. */
function setParamRow(rows: Array<{ key: string; value: string }>, key: string, value: string): void {
  const idx = rows.findIndex((p) => p.key === key);
  if (idx >= 0) rows[idx] = { key, value };
  else rows.push({ key, value });
}

function removeParamRows(rows: Array<{ key: string; value: string }>, key: string): void {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]?.key === key) rows.splice(i, 1);
  }
}

function makeExpectation(actual: unknown): Expectation {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`expected ${stringify(actual)} to be ${stringify(expected)}`);
      }
    },
    toEqual(expected) {
      if (!deepEqual(actual, expected)) {
        throw new Error(`expected ${stringify(actual)} to equal ${stringify(expected)}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`expected ${stringify(actual)} to be truthy`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`expected ${stringify(actual)} to be falsy`);
    },
    toContain(expected) {
      if (typeof actual !== 'string' || !actual.includes(expected)) {
        throw new Error(`expected ${stringify(actual)} to contain ${stringify(expected)}`);
      }
    },
    toHaveStatus(expected) {
      const status = (actual as { status?: number } | null | undefined)?.status;
      if (status !== expected) {
        throw new Error(`expected response status to be ${expected}, got ${stringify(status)}`);
      }
    },
  };
}

function buildConsole(log: ScriptConsoleEntry[], stamp: () => number): ScriptConsole {
  const mk =
    (level: ScriptConsoleEntry['level']) =>
    (...args: unknown[]) => {
      log.push({ level, args: args.map(stringify), timeMs: stamp() });
    };
  return {
    log: mk('log'),
    info: mk('info'),
    warn: mk('warn'),
    error: mk('error'),
    debug: mk('debug'),
  };
}

function stringify(v: unknown): string {
  try {
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  if (Array.isArray(aObj) !== Array.isArray(bObj)) return false;
  const keysA = Object.keys(aObj);
  const keysB = Object.keys(bObj);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!deepEqual(aObj[k], bObj[k])) return false;
  }
  return true;
}

function arraysShallowEqual(
  a: Array<{ key: string; value: string }>,
  b: Array<{ key: string; value: string }>,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.key !== b[i]?.key || a[i]?.value !== b[i]?.value) return false;
  }
  return true;
}

function stringListsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Structural equality over plain data (the MQTT will / subscription /
 *  property blocks) — JSON compare is exact for these shapes and runs
 *  once per mutator call. */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** UTF-8 text → base64 — the will payload's byte spelling, without a
 *  platform module (every runtime the runner lives in has `btoa`). */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bodyChanged(a: RequestSnapshot['body'], b: RequestSnapshot['body']): boolean {
  if (a.type !== b.type) return true;
  // Same discriminator: structural compare per variant. JSON compare
  // is accurate enough — bodies are pure data and the diff path runs
  // once per script mutation (not in a hot loop).
  return JSON.stringify(a) !== JSON.stringify(b);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Script exceeded ${ms} ms timeout`));
    }, ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
