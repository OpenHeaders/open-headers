/**
 * Sandboxed script runner (ARCHITECTURE §19).
 *
 * Lives inside `sandbox.html`, which is served by the manifest under
 * `sandbox.pages` — unique opaque origin, no chrome.* access, and
 * CSP allows `'unsafe-eval'` so `new Function(source)` can compile
 * user scripts.
 *
 * We never touch storage / network / extension APIs directly. Every
 * side-effecting `oh.*` call posts a `script.host-request` to the
 * parent offscreen doc and awaits the reply. The offscreen doc is the
 * only thing that speaks to the SW.
 *
 * The sandbox binding is `oh` only. No compatibility aliases — any
 * legacy identifier rewriting lives at import time, not runtime.
 *
 * Scripts execute in a fresh `new Function` scope per execution — we
 * do NOT reuse scope between runs to keep pre-request and test scripts
 * deterministic (no sneaky `globalThis.X = ...` carryover).
 */

import type {
  RequestMutation,
  RequestSnapshot,
  ScriptConsoleEntry,
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptHostRequest,
  ScriptHostResponse,
  TestAssertion,
} from '@openheaders/core/scripts';
import { clampScriptTimeoutMs } from '@openheaders/core/scripts';

// Signal readiness so the broker can fan execute requests in.
window.parent.postMessage({ type: 'sandbox.ready' }, '*');

// Each inbound `script.host-response` resolves the waiting promise.
const pendingHostRpcs = new Map<string, (response: ScriptHostResponse) => void>();

window.addEventListener('message', (ev) => {
  // We can't check origin reliably (opaque sandbox) — structural typing
  // via the `type` tag is the filter.
  const data = ev.data as
    | { type: 'script.execute'; request: ScriptExecutionRequest }
    | { type: 'script.host-response'; response: ScriptHostResponse }
    | undefined;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'script.execute') {
    void runScript(data.request).then((result) => {
      window.parent.postMessage({ type: 'script.result', result }, '*');
    });
    return;
  }

  if (data.type === 'script.host-response') {
    const resolver = pendingHostRpcs.get(data.response.rpcId);
    if (resolver) {
      pendingHostRpcs.delete(data.response.rpcId);
      resolver(data.response);
    }
  }
});

let nextRpcCounter = 0;

function sendHostRequest(request: ScriptHostRequest): Promise<ScriptHostResponse> {
  const p = new Promise<ScriptHostResponse>((resolve) => {
    pendingHostRpcs.set(request.rpcId, resolve);
  });
  window.parent.postMessage({ type: 'script.host-request', request }, '*');
  return p;
}

function nextRpcId(executionId: string): string {
  nextRpcCounter += 1;
  return `${executionId}:${nextRpcCounter}`;
}

async function runScript(req: ScriptExecutionRequest): Promise<ScriptExecutionResult> {
  const startedAt = performance.now();
  const consoleLog: ScriptConsoleEntry[] = [];
  const assertions: TestAssertion[] = [];
  let mutation: RequestMutation | undefined;
  let error: { name: string; message: string; stack?: string } | undefined;
  const timeoutMs = clampScriptTimeoutMs(req.timeoutMs);

  const stamp = (): number => Math.round(performance.now() - startedAt);

  const capturingConsole = buildConsole(consoleLog, stamp);
  const oh = buildScriptApi(req, assertions, capturingConsole, (next) => {
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

  try {
    // Compile user source in its own scope. We intentionally do NOT
    // expose `window` / `self` / `globalThis` — only `oh` + `console`
    // are passed as arguments. Anything else the script touches falls
    // back to the sandboxed window object (no chrome.* access, only
    // postMessage-to-opaque-parent — defense in depth).
    const fn = new Function('oh', 'console', `"use strict";\nreturn (async () => {\n${req.source}\n})();`) as (
      oh: ScriptApi,
      console: Console,
    ) => Promise<void>;
    await withTimeout(fn(oh, capturingConsole), timeoutMs);
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
  response?: import('@openheaders/core/scripts').ResponseSnapshot;
  variables: {
    get(name: string): Promise<string | null>;
    set(name: string, value: string): Promise<void>;
  };
  vault: {
    get(ref: string): Promise<string | null>;
  };
  require(name: string): unknown;
  sendRequest(request: AdHocRequestInput): Promise<import('@openheaders/core/scripts').ResponseSnapshot>;
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
  assertions: TestAssertion[],
  capturingConsole: Console,
  emitMutation: (m: RequestMutation) => void,
): ScriptApi {
  const draftHeaders: Array<{ key: string; value: string }> = [...req.request.headers];
  const draftParams: Array<{ key: string; value: string }> = [...req.request.params];
  let draftUrl = req.request.url;
  let draftMethod = req.request.method;
  let draftBody = req.request.body;

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
    const response = await sendHostRequest({
      executionId: req.executionId,
      rpcId: nextRpcId(req.executionId),
      op: 'variables.get',
      name,
    });
    if (!response.ok) throw new Error(`oh.variables.get failed: ${response.error}`);
    return (response.value as string | null) ?? null;
  };

  const hostSet = async (name: string, value: string): Promise<void> => {
    const response = await sendHostRequest({
      executionId: req.executionId,
      rpcId: nextRpcId(req.executionId),
      op: 'variables.set',
      name,
      value,
    });
    if (!response.ok) throw new Error(`oh.variables.set failed: ${response.error}`);
  };

  const hostVault = async (ref: string): Promise<string | null> => {
    const response = await sendHostRequest({
      executionId: req.executionId,
      rpcId: nextRpcId(req.executionId),
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
    const fn = new Function('module', 'exports', 'oh', 'console', `"use strict";\n${pkg.source}\n`) as (
      module: { exports: unknown },
      exports: unknown,
      oh: ScriptApi,
      console: Console,
    ) => void;
    fn(module, module.exports, packageApi, capturingConsole);
    compiledPackages.set(name, module.exports);
    return module.exports;
  };

  const hostSendRequest = async (
    request: AdHocRequestInput,
  ): Promise<import('@openheaders/core/scripts').ResponseSnapshot> => {
    // Normalize at the user-input boundary — the host's protocol type
    // requires the full snapshot shape.
    const snapshot: RequestSnapshot = {
      method: request.method,
      url: request.url,
      headers: request.headers ?? [],
      params: request.params ?? [],
      body: request.body ?? { type: 'none' },
    };
    const response = await sendHostRequest({
      executionId: req.executionId,
      rpcId: nextRpcId(req.executionId),
      op: 'sendRequest',
      request: snapshot,
    });
    if (!response.ok) throw new Error(`oh.sendRequest failed: ${response.error}`);
    return response.value as import('@openheaders/core/scripts').ResponseSnapshot;
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
        if (draftHeaders[i]!.key.toLowerCase() === lower) draftHeaders.splice(i, 1);
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
        if (draftParams[i]!.key === key) draftParams.splice(i, 1);
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

function buildConsole(log: ScriptConsoleEntry[], stamp: () => number): Console {
  const mk =
    (level: ScriptConsoleEntry['level']) =>
    (...args: unknown[]) => {
      log.push({ level, args: args.map(stringify), timeMs: stamp() });
    };
  const console = {
    log: mk('log'),
    info: mk('info'),
    warn: mk('warn'),
    error: mk('error'),
    debug: mk('debug'),
  } as unknown as Console;
  return console;
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
    if (a[i]!.key !== b[i]!.key || a[i]!.value !== b[i]!.value) return false;
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
    const timer = window.setTimeout(() => {
      reject(new Error(`Script exceeded ${ms} ms timeout`));
    }, ms);
    p.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}
