/**
 * Offscreen host — SW-side owner of the single offscreen document
 * that runs user-provided pre-request / test scripts (ARCHITECTURE
 * §19). One doc for the whole extension; one sandboxed iframe inside
 * it; one `oh.*` surface.
 *
 * Lifecycle:
 *   • Created on first `runScript(...)` via `chrome.offscreen.createDocument`.
 *     Idempotent — concurrent callers share the same spawn promise.
 *   • An idle timer closes the doc {@link IDLE_CLOSE_MS} after the
 *     last in-flight script settles. Re-spawns on next call.
 *   • If the doc is already alive but the next call lands during a
 *     spawn race, we queue on the creation promise and proceed.
 *
 * Security posture:
 *   • Scripts never touch storage or chrome.* directly — every
 *     side-effecting `oh.*` call crosses the SW via a typed host RPC.
 *   • Host RPCs are scoped to the ACTIVE workspace at the moment the
 *     RPC arrives — scripts can't reach into another workspace's
 *     vault or variables.
 *   • The sandbox iframe runs under a manifest-declared sandboxed
 *     origin (see `manifests/chrome/manifest.json` > `sandbox.pages`)
 *     so the CSP relaxation to allow `new Function(...)` is scoped to
 *     the sandbox page only.
 *
 * Firefox has no `chrome.offscreen` API; callers on Firefox get a
 * `unsupported-runtime` rejection from `runScript` and surface the
 * limitation per-rule in the UI.
 */

import type {
  RequestSnapshot,
  ResponseSnapshot,
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptHostRequest,
  ScriptHostResponse,
  ScriptKind,
} from '@openheaders/core/scripts';
import type { V5 } from '@openheaders/core/types';
import { resolveTemplate, VariableResolver } from '@openheaders/core/variables';
import { logger } from '@utils/logger';
import { recordLog } from './observability-log';

// The absolute request executor import is deferred via a getter to
// dodge the cycle: executor → offscreen-host (via oh.sendRequest) and
// offscreen-host → executor (to run an ad-hoc request). Both are SW-
// local so static imports would collapse the cycle at module eval,
// producing a temporal-dead-zone reference. The getter defers the
// binding until first use — by then the executor module has finished
// initializing.
let executeRequestDraftRef:
  | ((req: V5.Request) => Promise<import('./request-executor').ExecutedRequestSnapshot>)
  | null = null;
export function __setExecuteRequestDraft(fn: typeof executeRequestDraftRef): void {
  executeRequestDraftRef = fn;
}

import {
  getActiveEnvironmentId,
  getDefaultEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
  setWorkspaceVariables,
} from './environment-store';
import { getTokenBundle as getOAuthTokenBundle } from './oauth-token-store';
import { getRequestCollections } from './request-store';
import { getCollections as getRuleCollections } from './rule-store';

const OFFSCREEN_URL = 'offscreen.html';
const IDLE_CLOSE_MS = 30_000;
const SCRIPT_EXECUTE_TRANSPORT_TIMEOUT_MS = 60_000;

// ── Capability probe ──────────────────────────────────────────────

export function isOffscreenSupported(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.offscreen !== 'undefined' &&
    typeof chrome.offscreen.createDocument === 'function'
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────

let spawnPromise: Promise<void> | null = null;
let inFlight = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureOffscreen(): Promise<void> {
  if (!isOffscreenSupported()) {
    throw new OffscreenUnavailableError();
  }
  if (spawnPromise) return spawnPromise;

  spawnPromise = (async () => {
    // `hasDocument` may not exist on older Chrome — guard it.
    const hasDocument =
      typeof chrome.offscreen.hasDocument === 'function' ? await chrome.offscreen.hasDocument() : false;
    if (hasDocument) return;
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['IFRAME_SCRIPTING' as chrome.offscreen.Reason],
        justification: 'Runs user-provided pre-request and test scripts in a sandboxed iframe (ARCHITECTURE §19).',
      });
      logger.info('OffscreenHost', 'Offscreen document created');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // `Only a single offscreen document may be created.` — treat as
      // success; another caller raced us and won. The real failure
      // modes are denied permission / reason invalid / URL rejected.
      if (!/single offscreen document/i.test(message)) {
        spawnPromise = null;
        throw err;
      }
    }
  })();

  try {
    await spawnPromise;
  } catch (err) {
    spawnPromise = null;
    throw err;
  }
  return;
}

function scheduleIdleClose(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void teardown('idle');
  }, IDLE_CLOSE_MS);
}

export async function teardown(reason: 'idle' | 'shutdown'): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  spawnPromise = null;
  if (!isOffscreenSupported()) return;
  try {
    const hasDocument =
      typeof chrome.offscreen.hasDocument === 'function' ? await chrome.offscreen.hasDocument() : false;
    if (hasDocument) {
      await chrome.offscreen.closeDocument();
      logger.info('OffscreenHost', `Offscreen document closed (${reason})`);
    }
  } catch (err) {
    logger.info('OffscreenHost', `Teardown failed (${reason}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

export class OffscreenUnavailableError extends Error {
  constructor() {
    super('chrome.offscreen API is unavailable in this runtime (Firefox, or MV2 build)');
    this.name = 'OffscreenUnavailableError';
  }
}

// ── Public API ────────────────────────────────────────────────────

export interface RunScriptOptions {
  kind: ScriptKind;
  source: string;
  request: RequestSnapshot;
  response?: ResponseSnapshot;
  credentialRef?: string;
  timeoutMs?: number;
}

let nextExecCounter = 0;

function nextExecutionId(): string {
  nextExecCounter += 1;
  // Include SW boot moment so two boots can't collide via module-local
  // counter reset.
  return `exec-${Date.now().toString(36)}-${nextExecCounter}`;
}

export async function runScript(opts: RunScriptOptions): Promise<ScriptExecutionResult> {
  if (!opts.source?.trim()) {
    // No-op source → no-op result. Saves an offscreen spawn for the
    // common "no script configured" path.
    return {
      executionId: nextExecutionId(),
      succeeded: true,
      assertions: [],
      consoleLog: [],
      durationMs: 0,
    };
  }

  await ensureOffscreen();
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  inFlight += 1;

  const request: ScriptExecutionRequest = {
    executionId: nextExecutionId(),
    kind: opts.kind,
    source: opts.source,
    request: opts.request,
    response: opts.response,
    credentialRef: opts.credentialRef,
    timeoutMs: opts.timeoutMs,
  };

  try {
    const result = await sendExecuteToOffscreen(request);
    return result;
  } finally {
    inFlight -= 1;
    if (inFlight <= 0) scheduleIdleClose();
  }
}

async function sendExecuteToOffscreen(request: ScriptExecutionRequest): Promise<ScriptExecutionResult> {
  const transport = new Promise<ScriptExecutionResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`offscreen script.execute transport timed out after ${SCRIPT_EXECUTE_TRANSPORT_TIMEOUT_MS}ms`));
    }, SCRIPT_EXECUTE_TRANSPORT_TIMEOUT_MS);

    chrome.runtime
      .sendMessage({ target: 'offscreen', type: 'script.execute', request })
      .then((reply: unknown) => {
        clearTimeout(timer);
        if (!reply || typeof reply !== 'object') {
          reject(new Error('offscreen returned no reply for script.execute'));
          return;
        }
        resolve(reply as ScriptExecutionResult);
      })
      .catch((err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
  });

  try {
    return await transport;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordLog({
      subsystem: 'scripts',
      op: 'execute',
      level: 'error',
      message: `script.execute transport failed: ${message}`,
      context: { scriptKind: request.kind, executionId: request.executionId },
    });
    return {
      executionId: request.executionId,
      succeeded: false,
      error: { name: 'OffscreenTransportError', message },
      assertions: [],
      consoleLog: [],
      durationMs: 0,
    };
  }
}

// ── Host RPC (oh.variables / oh.vault / oh.sendRequest) ───────────

/**
 * Handle an incoming host-request from the offscreen doc. Wired by
 * `message-handler.ts` — messages with `{ target: 'background', type:
 * 'script.host-request' }` land here. Always resolves with a
 * `ScriptHostResponse` — never throws — so the broker can forward it
 * back to the sandbox without additional error handling.
 */
export async function handleScriptHostRequest(request: ScriptHostRequest): Promise<ScriptHostResponse> {
  try {
    switch (request.op) {
      case 'variables.get':
        return okReply(request, await resolveVariableByName(request.name));
      case 'variables.set':
        await writeWorkspaceVariable(request.name, request.value);
        return okReply(request, null);
      case 'vault.get':
        return okReply(request, await resolveVaultRef(request.ref));
      case 'sendRequest':
        return okReply(request, await dispatchAdHocRequest(request.request));
      default: {
        const unreachable: never = request;
        return errorReply(
          (unreachable as ScriptHostRequest).executionId,
          (unreachable as ScriptHostRequest).rpcId,
          'unknown host op',
        );
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorReply(request.executionId, request.rpcId, message);
  }
}

function okReply(request: ScriptHostRequest, value: unknown): ScriptHostResponse {
  return {
    executionId: request.executionId,
    rpcId: request.rpcId,
    ok: true,
    value,
  };
}

function errorReply(executionId: string, rpcId: string, error: string): ScriptHostResponse {
  return { executionId, rpcId, ok: false, error };
}

async function resolveVariableByName(name: string): Promise<string | null> {
  const resolver = buildHostResolver();
  const { result, errors } = resolveTemplate(`{{${name}}}`, (n) => resolver.resolve(n, {}));
  if (errors.length > 0 || result === `{{${name}}}`) return null;
  return result;
}

function buildHostResolver(): VariableResolver {
  const resolver = new VariableResolver();
  resolver.setVault(getVault());
  resolver.setEnvironments(getEnvironments());
  resolver.setActiveEnvironmentId(getActiveEnvironmentId());
  resolver.setDefaultEnvironmentId(getDefaultEnvironmentId());
  resolver.setWorkspaceVariables(getWorkspaceVariables());
  for (const c of getRuleCollections()) resolver.setCollectionVariables(c.uid, c.variables ?? []);
  for (const c of getRequestCollections()) resolver.setCollectionVariables(c.uid, c.variables ?? []);
  return resolver;
}

async function writeWorkspaceVariable(name: string, value: string): Promise<void> {
  const current = getWorkspaceVariables();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('oh.variables.set: empty variable name');
  const idx = current.variables.findIndex((v) => v.name === trimmed);
  const nextVariables: V5.Variable[] =
    idx >= 0
      ? [...current.variables.slice(0, idx), { ...current.variables[idx]!, value }, ...current.variables.slice(idx + 1)]
      : [...current.variables, { name: trimmed, value, type: 'default' }];
  await setWorkspaceVariables({ variables: nextVariables });
}

async function resolveVaultRef(ref: string): Promise<string | null> {
  // The sandbox can request either a named vault secret or an OAuth
  // credentialRef. Named secrets are the common case; OAuth bundles
  // surface their access token as the value (the common need — signing
  // an outbound ad-hoc request).
  const vault = getVault();
  const named = vault.secrets?.find((s) => s.name === ref);
  // String-kind only — `oh.vault(name)` returns a literal credential.
  // TOTP-kind entries are request-time, not script-time; surface as
  // null so script authors fall back to OAuth bundle resolution.
  if (named && named.kind === 'string') return named.value;
  const bundle = await getOAuthTokenBundle(ref);
  return bundle?.accessToken ?? null;
}

async function dispatchAdHocRequest(snapshot: RequestSnapshot): Promise<ResponseSnapshot> {
  if (!executeRequestDraftRef) {
    throw new Error('oh.sendRequest unavailable — request executor not wired');
  }
  const request: V5.Request = {
    schemaVersion: 5,
    uid: `script-${Date.now().toString(36)}`,
    path: 'scripts/ad-hoc',
    name: 'script ad-hoc',
    method: snapshot.method,
    url: snapshot.url,
    headers: snapshot.headers.map((h) => ({ key: h.key, value: h.value, enabled: true })),
    params: snapshot.params.map((p) => ({ key: p.key, value: p.value, enabled: true })),
    auth: { type: 'none' },
    body: snapshot.body,
  };
  const result = await executeRequestDraftRef(request);
  return {
    status: result.status,
    statusText: result.statusText,
    url: result.url,
    headers: result.headers,
    body: result.body,
    durationMs: result.durationMs,
  };
}
