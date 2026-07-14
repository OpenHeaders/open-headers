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
 */

import type {
  RequestMutation,
  RequestSnapshot,
  ResponseSnapshot,
  ScriptConsoleEntry,
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptHostRequest,
  ScriptHostResponse,
  TestAssertion,
} from './index';
import { clampScriptTimeoutMs } from './index';

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
  let error: { name: string; message: string; stack?: string } | undefined;
  const timeoutMs = clampScriptTimeoutMs(req.timeoutMs);

  const stamp = (): number => Math.round(performance.now() - startedAt);

  const capturingConsole = buildConsole(consoleLog, stamp);
  const oh = buildScriptApi(req, deps, assertions, capturingConsole, (next) => {
    // Every flush is a COMPLETE diff against the original request, so
    // each one replaces the pending mutation outright. Merging field-wise
    // would resurrect a change a later call reverted (setHeader then
    // removeHeader must end as "no header mutation"). All-empty diffs
    // normalize to undefined so a net-unchanged request reports none.
    const hasChange =
      next.method !== undefined ||
      next.url !== undefined ||
      next.headers !== undefined ||
      next.params !== undefined ||
      next.body !== undefined;
    mutation = hasChange ? next : undefined;
  });

  const extraNames = Object.keys(deps.scopeExtras ?? {});
  const extraValues = extraNames.map((name) => (deps.scopeExtras as Record<string, unknown>)[name]);

  try {
    // Compile user source in its own scope. We intentionally do NOT
    // expose the host global — only `oh` + `console` (+ the host's
    // declared scope extras) are passed as arguments. Anything else the
    // script touches falls back to whatever globals the host's
    // isolation layer left reachable.
    const fn = new Function(
      'oh',
      'console',
      ...extraNames,
      `"use strict";\nreturn (async () => {\n${req.source}\n})();`,
    ) as (...args: unknown[]) => Promise<void>;
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

interface ScriptApi {
  request: RequestSnapshot;
  response?: ResponseSnapshot;
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
  setUrl(url: string): void;
  setMethod(method: RequestSnapshot['method']): void;
  setHeader(key: string, value: string): void;
  removeHeader(key: string): void;
  setQueryParam(key: string, value: string): void;
  removeQueryParam(key: string): void;
  setBody(body: RequestSnapshot['body']): void;
}

interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(expected: string): void;
  toHaveStatus(expected: number): void;
}

function buildScriptApi(
  req: ScriptExecutionRequest,
  deps: ScriptRunnerDeps,
  assertions: TestAssertion[],
  capturingConsole: ScriptConsole,
  emitMutation: (m: RequestMutation) => void,
): ScriptApi {
  const draftHeaders: Array<{ key: string; value: string }> = [...req.request.headers];
  const draftParams: Array<{ key: string; value: string }> = [...req.request.params];
  let draftUrl = req.request.url;
  let draftMethod = req.request.method;
  let draftBody = req.request.body;
  let rpcCounter = 0;

  const nextRpcId = (): string => {
    rpcCounter += 1;
    return `${req.executionId}:${rpcCounter}`;
  };

  const flushMutation = (): void => {
    emitMutation({
      url: draftUrl !== req.request.url ? draftUrl : undefined,
      method: draftMethod !== req.request.method ? draftMethod : undefined,
      headers: arraysShallowEqual(draftHeaders, req.request.headers) ? undefined : [...draftHeaders],
      params: arraysShallowEqual(draftParams, req.request.params) ? undefined : [...draftParams],
      body: bodyChanged(draftBody, req.request.body) ? draftBody : undefined,
    });
  };

  const hostGet = async (name: string): Promise<string | null> => {
    const response = await deps.sendHostRequest({
      executionId: req.executionId,
      rpcId: nextRpcId(),
      op: 'variables.get',
      name,
    });
    if (!response.ok) throw new Error(`oh.variables.get failed: ${response.error}`);
    return (response.value as string | null) ?? null;
  };

  const hostSet = async (name: string, value: string): Promise<void> => {
    const response = await deps.sendHostRequest({
      executionId: req.executionId,
      rpcId: nextRpcId(),
      op: 'variables.set',
      name,
      value,
    });
    if (!response.ok) throw new Error(`oh.variables.set failed: ${response.error}`);
  };

  const hostVault = async (ref: string): Promise<string | null> => {
    const response = await deps.sendHostRequest({
      executionId: req.executionId,
      rpcId: nextRpcId(),
      op: 'vault.get',
      ref,
    });
    if (!response.ok) throw new Error(`oh.vault.get failed: ${response.error}`);
    return (response.value as string | null) ?? null;
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
    const response = await deps.sendHostRequest({
      executionId: req.executionId,
      rpcId: nextRpcId(),
      op: 'sendRequest',
      request: snapshot,
    });
    if (!response.ok) throw new Error(`oh.sendRequest failed: ${response.error}`);
    return response.value as ResponseSnapshot;
  };

  const api: ScriptApi = {
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
    setUrl(url) {
      draftUrl = url;
      flushMutation();
    },
    setMethod(method) {
      draftMethod = method;
      flushMutation();
    },
    setHeader(key, value) {
      const idx = draftHeaders.findIndex((h) => h.key.toLowerCase() === key.toLowerCase());
      if (idx >= 0) draftHeaders[idx] = { key, value };
      else draftHeaders.push({ key, value });
      flushMutation();
    },
    removeHeader(key) {
      const lower = key.toLowerCase();
      for (let i = draftHeaders.length - 1; i >= 0; i -= 1) {
        if (draftHeaders[i]?.key.toLowerCase() === lower) draftHeaders.splice(i, 1);
      }
      flushMutation();
    },
    setQueryParam(key, value) {
      // Query-param keys are case-sensitive (unlike header names) — match
      // exactly. Replace the first row with that key, else append.
      const idx = draftParams.findIndex((p) => p.key === key);
      if (idx >= 0) draftParams[idx] = { key, value };
      else draftParams.push({ key, value });
      flushMutation();
    },
    removeQueryParam(key) {
      for (let i = draftParams.length - 1; i >= 0; i -= 1) {
        if (draftParams[i]?.key === key) draftParams.splice(i, 1);
      }
      flushMutation();
    },
    setBody(body) {
      draftBody = body;
      flushMutation();
    },
  };

  // The `oh` handed to PACKAGE bodies: identical surface (the getter
  // walks the prototype chain, so `oh.request` stays the live draft
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
